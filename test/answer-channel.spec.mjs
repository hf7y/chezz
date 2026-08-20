/* Covers scripts/check-answer-channel.mjs -- the guard on the autopilot answer
 * channel (automation asks, Zach replies, the next unattended run acts on it).
 *
 * This exists because the channel has broken silently twice, both times by the
 * human's copy and the run's copy drifting apart:
 *   2026-07-25 (`7beef04`) -- his edit landed in a header-only stub.
 *   2026-07-27 -- the scheduler's questions/chezz.md symlink pointed at a
 *     checkout 6 commits behind origin/main, hiding the three questions filed
 *     that day and showing four stale ones.
 *
 * 2026-07-28: QUESTIONS MOVED TO GITHUB ISSUES, so the guard now has two halves
 * with different shapes, and this file was updated on 2026-07-29 to match --
 * the merge that moved the channel left three tests here still asserting the
 * retired QUESTIONS.md byte-compare, and they failed the suite.
 *   - questions half: no file, no symlink, nothing to drift. The invariant is
 *     "this run can REACH the issues API", so its failure fixture is an
 *     unreachable repo rather than a stale copy.
 *   - FOCUS.md half: was still the symlink byte-compare, so the old
 *     stale/dangling fixtures applied to it and were kept.
 *
 * 2026-08-15: THE FILE CHANNEL IS GONE (realisateur#293). FOCUS.md was the
 * last half on it and both copies are deleted, so the guard has one half and
 * no on-disk state at all. The drift fixtures below went with it -- there is
 * nothing left to drift. What replaced them is the LAST test in this file:
 * the guard must not reach for a coordination file again, because the whole
 * class of silent loss above was the on-disk copy, not any one instance of
 * it. The loud-failure coverage those fixtures carried is unchanged and
 * lives on the issues half, which is now the only channel.
 *
 * The failing cases below are the point of the file. A guard that only proves
 * it can say OK hasn't been tested at all -- so each drift mode gets its own
 * fixture and each one must exit non-zero with a message that names the defect.
 *
 * 2026-08-14: a THIRD loss, and this file did not catch it either. The
 * questions half counted an answer as the `answered` LABEL, which nothing
 * has ever applied -- so "reports the questions half OK" below passed
 * happily while four issues held real answers from Zach. The label is gone
 * from the predicate; `scripts/answered-issues.mjs` reads COMMENTS across
 * ALL states, and gets its own fixtures here so this file can fail for the
 * right reason next time.
 */
import { test, expect } from "@playwright/test";
import { isStamped, isAnswered, stamped } from "../scripts/answered-issues.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPT = path.join(ROOT, "scripts", "check-answer-channel.mjs");

/* Runs the guard and returns both the exit code and the combined output --
 * the exit code alone would let a check that fails for the WRONG reason pass
 * this suite. */
function runGuard(extraEnv = {}) {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, ...extraEnv },
    });
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.status, output: `${err.stdout || ""}${err.stderr || ""}` };
  }
}

/* A repo that cannot resolve, for failing the questions half on purpose. The
 * owner is deliberately nonsense so this can never accidentally hit something
 * real, and never mutates anything: the guard only ever lists issues. */
const UNREACHABLE_REPO = "hf7y-no-such-owner-9c3f/no-such-repo";

test("passes with no on-disk state of any kind", () => {
  const { code, output } = runGuard();
  expect(output).toContain("OK");
  expect(code).toBe(0);
});

/* The questions half's whole reason to exist: an unreachable API and a quiet
 * night both produce zero answers, so "could not look" must never be reported
 * as "nothing to do". This replaces the old stale-QUESTIONS.md fixture, which
 * tested a comparison the issues channel no longer performs. */
test("fails loud when the issues API cannot be reached", () => {
  const { code, output } = runGuard({ CHEZZ_ISSUES_REPO: UNREACHABLE_REPO });
  // 2 (BLIND), emphatically not 0: "could not look" is its own outcome, and
  // a caller must be able to branch on it.
  expect(code).toBe(2);
  expect(output).toContain("COULD NOT LOOK");
  expect(output).toContain(UNREACHABLE_REPO);
  // It must distinguish the two indistinguishable-looking cases by name,
  // and say what gh actually reported, or the reader can't act on it.
  expect(output).toContain('CANNOT tell "no answers tonight" from "could not look"');
  expect(output).toContain("gh said:");
});

/* A reachable repo must NOT be reported as broken -- the negative control for
 * the test above, so an always-failing questions half can't pass this suite. */
test("reports the questions channel OK against the real issues repo", () => {
  const { output } = runGuard();
  expect(output).toContain("questions channel OK");
  expect(output).toContain("question issue(s) across all states");
});

/* THE REGRESSION. Zach answered #3 on 2026-07-29 and #4/#5/#6 on 2026-08-11,
 * by commenting and leaving them OPEN. The label-gated guard reported "0 of
 * them answered" every night regardless. These four are real, live issues on
 * hf7y/chezz; if a run ever again reports zero answers while they sit there,
 * this fails. */
test("sees the real answers Zach left in comments on open, unlabelled issues", () => {
  const { code, output } = runGuard();
  expect(code).toBe(0);
  expect(output).toMatch(/[1-9]\d* still OPEN and awaiting this run/);
  expect(output).toContain("carrying an answer from hf7y");
});

/* The predicate itself, on fixtures -- the live test above proves it works
 * today, these prove WHY, and keep working with no network. */
const STAMP = "<!-- agent: chezz/nightly 2026-08-14T00:00:00Z -->";
const issue = (comments, { labels = [], state = "OPEN" } = {}) => ({
  state,
  labels: labels.map((name) => ({ name })),
  comments: comments.map(([login, body]) => ({ author: { login }, body })),
});

test("isStamped only reads the last non-blank line", () => {
  expect(isStamped(`did the thing\n\n${STAMP}`)).toBe(true);
  expect(isStamped(`did the thing\n\n${STAMP}\n\n`)).toBe(true);
  // A stamp QUOTED out of an earlier comment must not launder a human reply
  // into an agent one -- vim-arcade#77's whole reason for last-line-only.
  expect(isStamped(`> ${STAMP}\n\nyes, do it`)).toBe(false);
  expect(isStamped("")).toBe(false);
});

test("an unstamped owner comment is an answer, label or no label, open or closed", () => {
  expect(isAnswered(issue([["hf7y", "do it"]]), "hf7y")).toBe(true);
  expect(isAnswered(issue([["hf7y", "do it"]], { state: "CLOSED" }), "hf7y")).toBe(true);
});

test("the agent's own stamped comment is not an answer", () => {
  expect(isAnswered(issue([["hf7y", `asking: which way?\n\n${STAMP}`]]), "hf7y")).toBe(false);
  expect(isAnswered(issue([]), "hf7y")).toBe(false);
  expect(isAnswered(issue([["somebody-else", "drive-by"]]), "hf7y")).toBe(false);
});

test("the `answered` label still works as an optional override", () => {
  expect(isAnswered(issue([], { labels: ["question", "answered"] }), "hf7y")).toBe(true);
});

/* THE RETARGETED REGRESSION. Every silent loss this file exists to prevent
 * had the same cause: a COPY of the channel on disk, which then went stale.
 * The copies are gone (realisateur#293, 2026-08-15) and the fixtures that
 * fabricated them went with them -- so this is what stands in their place.
 * If the guard ever reaches for a coordination file again, the whole class
 * comes back, and this fails before it can. */
test("the guard keeps no on-disk copy of the channel", () => {
  const source = readFileSync(SCRIPT, "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  expect(code).not.toMatch(/\.scheduler|FOCUS\.md|QUESTIONS\.md|BLOCKERS\.md/);
  expect(code).not.toContain("CHEZZ_SCHEDULER_DIR");
});

// hf7y/chezz#21: this project's own automation had never stamped a comment it
// posted, so ecosim's Zach-blocked sensor read agent replies as answers from
// Zach and reported BLIND_NO_STAMP_DISCIPLINE instead of a ratio. The writer
// and the reader of the stamp grammar now live in one file; these pin that
// they agree.
test("a stamp this project writes is a stamp this project recognises", () => {
  const body = stamped("check-live-deploy: everything is serving again.", "check-live-deploy");
  expect(isStamped(body)).toBe(true);
  expect(body.split("\n").pop()).toMatch(/^<!-- agent: chezz\/check-live-deploy \S+ -->$/);
});

test("a stamped agent comment is never mistaken for Zach's answer", () => {
  const agentReply = stamped("Acted on tonight; leaving open.", "nightly-batch");
  expect(isAnswered(issue([["hf7y", agentReply]]), "hf7y")).toBe(false);
  expect(isAnswered(issue([["hf7y", agentReply], ["hf7y", "do the thing"]]), "hf7y")).toBe(true);
});
