/* Covers scripts/check-live-deploy.mjs -- the domain-serving trigger check
 * FOCUS.md's "PARKED WITH A TRIGGER 2026-07-28" block named for the hf7y
 * domain move and priority queue item 9 left unwired: does a player actually
 * reach nightly-builds/ through both live domains right now.
 *
 * Only checkDomain() is pinned here, via a fake fetch -- it's the part with
 * no side effects and a clear contract (status code in, ok/detail out). The
 * gh-issue filing/closing halves shell out to `gh` against a real repo and
 * aren't exercised here; check-answer-channel.spec.mjs's UNREACHABLE_REPO
 * pattern doesn't apply cleanly because this script also WRITES (creates/
 * closes issues), and a test fixture that actually opened issues against
 * hf7y/chezz would leave debris behind rather than clean up after itself.
 * Known limit, not an oversight.
 */
import { test, expect } from "@playwright/test";
import { checkDomain, DOMAINS } from "../scripts/check-live-deploy.mjs";

test("a 200 response is reported ok", async () => {
  const fakeFetch = async () => ({ status: 200 });
  const result = await checkDomain({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(true);
});

test("a non-200 response is reported not-ok, with the status in the detail", async () => {
  const fakeFetch = async () => ({ status: 404 });
  const result = await checkDomain({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("404");
});

test("a network error (fetch throws) is reported not-ok, not an uncaught exception", async () => {
  const fakeFetch = async () => { throw new Error("getaddrinfo ENOTFOUND example.test"); };
  const result = await checkDomain({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("ENOTFOUND");
});

test("both live domains FOCUS.md item 9 names are wired into the check", () => {
  const names = DOMAINS.map((d) => d.name);
  expect(names).toContain("hf7y.github.io");
  expect(names).toContain("zach.audio");
  for (const d of DOMAINS) {
    expect(d.url).toContain("/nightly-builds/");
  }
});
