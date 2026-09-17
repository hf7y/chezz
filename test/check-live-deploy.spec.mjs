/* Covers scripts/check-live-deploy.mjs -- the domain-serving check: does a
 * player actually reach nightly-builds/ through every live domain right now.
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
import {
  checkDomain,
  checkRedirectsToCanonical,
  DOMAINS,
  GAME_PATHS,
  NARRATIVE_REDIRECT_PATHS,
  NETLIFY_CANONICAL_URL,
  REPORT_ENDPOINT,
} from "../scripts/check-live-deploy.mjs";

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

test("every live domain is wired into the check, and the retired one is not", () => {
  const names = DOMAINS.map((d) => d.name);
  expect(names).toContain("hf7y.com");
  expect(names).toContain("hf7y.github.io");
  expect(names).not.toContain("zach.audio");
  for (const d of DOMAINS) {
    expect(d.url).toContain("/nightly-builds/");
  }
});

test("both Narrative and Classic public routes are checked after every deploy", () => {
  const routes = Object.fromEntries(GAME_PATHS.map((path) => [path.name, path.url]));
  expect(routes["hf7y.com narrative"]).toBe("https://hf7y.com/chezz/");
  expect(routes["hf7y.com classic"]).toBe("https://hf7y.com/chezz/classic.html");
});

// hf7y/chezz#128: the report box posts to a relative /.netlify/functions/report,
// which 404s anywhere but the canonical Netlify domain.
test("the report endpoint is checked against the canonical Netlify domain", () => {
  expect(REPORT_ENDPOINT.url).toBe(
    "https://chezz.hf7y.com/.netlify/functions/report?scope=sweep-status"
  );
});

test("a page whose body names the canonical URL passes the redirect check", async () => {
  const fakeFetch = async () => ({
    status: 200,
    text: async () => `<meta http-equiv="refresh" content="0; url=${NETLIFY_CANONICAL_URL}">`,
  });
  const result = await checkRedirectsToCanonical({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(true);
});

test("a page that serves real content instead of a redirect fails loud (#128)", async () => {
  const fakeFetch = async () => ({ status: 200, text: async () => "<title>Chezz</title>" });
  const result = await checkRedirectsToCanonical({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain(NETLIFY_CANONICAL_URL);
});

test("a non-200 response fails the redirect check too", async () => {
  const fakeFetch = async () => ({ status: 404, text: async () => "" });
  const result = await checkRedirectsToCanonical({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("404");
});

test("both non-canonical Narrative routes are checked, not just one", () => {
  const names = NARRATIVE_REDIRECT_PATHS.map((p) => p.name);
  expect(names).toContain("hf7y.com narrative redirect");
  expect(names).toContain("hf7y.github.io narrative redirect");
});
