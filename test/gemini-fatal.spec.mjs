/* Covers the "stop paying to learn the same fact" guard in
 * tools/generate-pieces.mjs.
 *
 * Witness for why this exists (2026-07-28, first live run of the pipeline):
 * every one of the 18 pieces failed with the SAME account-level 429 --
 * `generate_content_free_tier_requests, limit: 0`, i.e. the image model has no
 * free tier at all -- and the loop dutifully made all 18 calls anyway. That run
 * cost nothing precisely because the account was unbilled. On a billed key the
 * identical bug pays 18x to discover one fact about the account, which is the
 * failure mode worth a regression test: it is silent, it only ever shows up on
 * a real key, and its cost scales with the piece list.
 *
 * A 429 is NOT fatal in general -- ordinary rate limiting is exactly what the
 * per-piece retry path is for. The distinguishing signal is a stated limit of
 * zero: no quota exists to wait for.
 */
import { test, expect } from "@playwright/test";

import { isFatalApiError } from "../tools/generate-pieces.mjs";

const REAL_429 = `{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, "
  }
}`;

test("the exact 429 that burned 18 calls is classified fatal", () => {
  expect(isFatalApiError(429, REAL_429)).toBe(true);
});

test("the token-count variant of the same rejection is fatal too", () => {
  // The same run produced two spellings of the metric; both carried limit: 0.
  expect(isFatalApiError(429, "Quota exceeded for metric: ...free_tier_input_token_count, limit: 0, ")).toBe(true);
});

test("a bad or unauthorized key is fatal", () => {
  expect(isFatalApiError(401, "")).toBe(true);
  expect(isFatalApiError(403, "PERMISSION_DENIED")).toBe(true);
});

test("ordinary rate limiting is NOT fatal -- it must stay retryable", () => {
  // The regression that would matter most: treating every 429 as fatal turns a
  // transient hiccup on piece 3 into an abandoned run of 18.
  expect(isFatalApiError(429, "Quota exceeded ... limit: 60, please retry")).toBe(false);
  expect(isFatalApiError(429, "rate limited")).toBe(false);
});

test("a limit of 0 inside a larger number does not false-positive", () => {
  // `limit: 10` must not match a naive substring check for "limit: 0".
  expect(isFatalApiError(429, "Quota exceeded ... limit: 10, ")).toBe(false);
  expect(isFatalApiError(429, "Quota exceeded ... limit: 1000, ")).toBe(false);
});

test("per-call failures stay per-call", () => {
  expect(isFatalApiError(400, "invalid argument")).toBe(false);
  expect(isFatalApiError(500, "internal")).toBe(false);
  expect(isFatalApiError(503, "overloaded")).toBe(false);
});

test("importing the module does not start a generation run", () => {
  // The import at the top of this file is the assertion: tools/generate-pieces
  // auto-runs main() when invoked as a script, and without its import.meta
  // guard, merely loading it here would begin calling a paid image API.
  expect(typeof isFatalApiError).toBe("function");
});
