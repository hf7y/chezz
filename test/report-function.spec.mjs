import { test, expect } from "@playwright/test";
import report from "../netlify/functions/report.js";

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
    return new Response("[]", { status: 200 });
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
