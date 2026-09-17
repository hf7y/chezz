// netlify/functions/report.js has no browser UI of its own, so the other
// report-* specs only pin what the game's fetch call sends, never what the
// function does with it. Calls the function directly (mocking the global
// `Netlify` binding and `fetch`, the only two things it reads from its
// runtime) to pin two things with no other coverage:
// - CORS: chezz-classic's shell (hf7y/chezz#130) calls this by absolute URL
//   from a different origin than chezz.hf7y.com, so a response the caller
//   can't read is as broken as a 404.
// - kind mapping: narrative's and classic's UI both send kind: "feature"
//   for an idea (never "idea" itself), which used to fall through to "bug"
//   and needed a later triage pass to notice and relabel (hf7y/chezz#120,
//   #123, #124).
import { test, expect } from "@playwright/test";
import report from "../netlify/functions/report.js";

// Captures the body of whichever request the function sends to the GitHub
// API, and answers it with a fixed successful issue-creation response.
async function withMockGithub(run) {
  let posted = null;
  globalThis.Netlify = { env: { get: () => "test-token" } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).includes("api.github.com")) return realFetch(url, init);
    if (init.method === "POST") {
      posted = JSON.parse(init.body);
      return new Response(JSON.stringify({ number: 1, html_url: "https://x" }), { status: 200 });
    }
    return new Response("[]", { status: 200 }); // GET (sweep-status/bugs): an empty issue list
  };
  try {
    const res = await run();
    return { res, posted };
  } finally {
    delete globalThis.Netlify;
    globalThis.fetch = realFetch;
  }
}

test("every response carries a permissive CORS header", async () => {
  const req = new Request("https://chezz.hf7y.com/.netlify/functions/report?scope=sweep-status");
  const { res } = await withMockGithub(() => report(req));
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
});

function postReq(kind) {
  return new Request("https://chezz.hf7y.com/.netlify/functions/report", {
    method: "POST",
    body: JSON.stringify({ type: "bug", kind, name: "abc123", url: "https://x", description: "test report" }),
  });
}

test("kind: feature is filed with the idea label, not bug (hf7y/chezz#120/#123/#124)", async () => {
  const { posted } = await withMockGithub(() => report(postReq("feature")));
  expect(posted.labels).toContain("idea");
  expect(posted.labels).not.toContain("bug");
});

test("kind: bug is still filed with the bug label", async () => {
  const { posted } = await withMockGithub(() => report(postReq("bug")));
  expect(posted.labels).toContain("bug");
  expect(posted.labels).not.toContain("idea");
});
