// hf7y/chezz#40: the /exec deployment is ANYONE_ANONYMOUS and its id is public
// by construction, so `resolve` and `sweep-status` -- the two writes that can
// falsify the record, and the two the browser never makes -- are gated on a
// server-side WRITE_TOKEN script property.
//
// Code.gs is Apps Script, not a module, so it is evaluated here against stubs
// for the three globals it touches. That is enough to pin the polarity of the
// gate, which is the whole defect: a check that passes when unconfigured is
// not a check.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../leaderboard/Code.gs", import.meta.url), "utf8");

// Evaluate Code.gs with a stubbed Apps Script runtime and return doPost plus a
// record of which privileged handler (if any) actually ran.
function load(writeToken) {
  const calls = [];
  const output = payload => ({ setMimeType: () => payload });
  const sandbox = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => (key === "WRITE_TOKEN" ? writeToken : null),
        setProperty: () => calls.push("sweep-status"),
      }),
    },
    ContentService: { createTextOutput: output, MimeType: { JSON: "json" } },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        calls.push("resolve");
        throw new Error("STOP: resolveBugReport_ was reached");
      },
    },
  };
  const fn = new Function(...Object.keys(sandbox), `${SOURCE}\nreturn doPost;`);
  const doPost = fn(...Object.values(sandbox));
  const post = body => {
    try {
      return JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }));
    } catch (err) {
      if (String(err.message).startsWith("STOP")) return { reached: true };
      throw err;
    }
  };
  return { post, calls };
}

const RESOLVE = { type: "resolve", timestamp: "2026-08-19T04:22:11.000Z", status: "resolved" };
const SWEEP = { type: "sweep-status", fetched: 1, fixed: 1, reclassified: 0, leftOpen: 0 };

test("with no WRITE_TOKEN set, privileged writes are refused -- the gate fails CLOSED", () => {
  const { post, calls } = load(null);
  expect(post(RESOLVE)).toEqual({ ok: false, error: "unauthorized" });
  expect(post(SWEEP)).toEqual({ ok: false, error: "unauthorized" });
  expect(calls).toEqual([]);
});

test("an anonymous caller cannot resolve a report or overwrite sweep-status", () => {
  const { post, calls } = load("s3cret-token-value");
  expect(post(RESOLVE)).toEqual({ ok: false, error: "unauthorized" });
  expect(post({ ...RESOLVE, token: "wrong" })).toEqual({ ok: false, error: "unauthorized" });
  expect(post({ ...SWEEP, token: "s3cret-token-valu" })).toEqual({ ok: false, error: "unauthorized" });
  expect(calls).toEqual([]);
});

test("the holder of the token still gets through", () => {
  const { post, calls } = load("s3cret-token-value");
  expect(post({ ...SWEEP, token: "s3cret-token-value" })).toEqual({ ok: true });
  expect(post({ ...RESOLVE, token: "s3cret-token-value" })).toEqual({ reached: true });
  expect(calls).toEqual(["sweep-status", "resolve"]);
});

test("score and bug submission stay open -- the browser calls them and can carry no secret", () => {
  // `reached: true` means the handler ran -- with no token and no WRITE_TOKEN
  // set, which is exactly what an anonymous player submission looks like.
  const { post } = load(null);
  expect(post({ type: "bug", description: "x" })).toEqual({ reached: true });
  expect(post({ type: "score", name: "x", floor: 1, rank: 1 })).toEqual({ reached: true });
});
