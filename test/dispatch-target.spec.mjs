/* Covers scripts/check-dispatch-target.mjs -- the link between Code.gs's
 * GH_WORKFLOW_FILE and an actual workflow file. Both halves are pure given
 * their input, so the parse is pinned against fixture strings and the
 * existence check is pinned against the real repo.
 */
import { test, expect } from "@playwright/test";
import { dispatchTarget, checkDispatchTarget } from "../scripts/check-dispatch-target.mjs";

test("the workflow Code.gs dispatches actually exists", () => {
  const result = checkDispatchTarget();
  expect(result.detail ?? "").toBe("");
  expect(result.ok).toBe(true);
});

test("GH_WORKFLOW_FILE is parsed out of Code.gs, not guessed", () => {
  expect(dispatchTarget(`const GH_WORKFLOW_FILE = "sweep.yml";`)).toBe("sweep.yml");
  expect(dispatchTarget(`const GH_WORKFLOW_FILE = 'other.yml';`)).toBe("other.yml");
  expect(dispatchTarget(`// const GH_WORKFLOW_FILE = "commented.yml";`)).toBe(null);
});

test("a missing workflow is reported, not silently passed", () => {
  const result = checkDispatchTarget("no-such-workflow.yml");
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("no-such-workflow.yml");
});

test("an unparseable Code.gs fails loud rather than reading as OK", () => {
  expect(checkDispatchTarget(dispatchTarget("nothing here")).ok).toBe(false);
});
