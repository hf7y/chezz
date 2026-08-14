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
 *   - FOCUS.md half: unchanged, still the symlink byte-compare, so the old
 *     stale/dangling fixtures still apply to it and are kept.
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
import { isStamped, isAnswered } from "../scripts/answered-issues.mjs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPT = path.join(ROOT, "scripts", "check-answer-channel.mjs");
const REAL_QUESTIONS = path.join(ROOT, ".scheduler", "QUESTIONS.md");
const REAL_FOCUS = path.join(ROOT, ".scheduler", "FOCUS.md");

/* Runs the guard against a fabricated scheduler checkout and returns both the
 * exit code and the combined output -- the exit code alone would let a check
 * that fails for the WRONG reason pass this suite. */
function runGuard(schedulerDir, extraEnv = {}) {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, CHEZZ_SCHEDULER_DIR: schedulerDir, ...extraEnv },
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

/* A scheduler checkout whose two files are symlinks, exactly as the real one
 * is. `questions`/`focus` override what they point at; default is the live
 * in-repo file, i.e. a correctly-wired channel. */
function fakeScheduler({ questions, focus } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "chezz-answer-channel-"));
  mkdirSync(path.join(dir, "questions"));
  mkdirSync(path.join(dir, "focus"));

  const link = (subdir, override, realTarget) => {
    const linkPath = path.join(dir, subdir, "chezz.md");
    if (override === undefined) {
      symlinkSync(realTarget, linkPath);
    } else if (override === null) {
      symlinkSync(path.join(dir, "deleted-target.md"), linkPath); // dangling
    } else {
      const target = path.join(dir, `${subdir}-content.md`);
      writeFileSync(target, override);
      symlinkSync(target, linkPath);
    }
  };
  link("questions", questions, REAL_QUESTIONS);
  link("focus", focus, REAL_FOCUS);
  return dir;
}

test("passes when the human's copy is byte-identical to the run's copy", () => {
  const dir = fakeScheduler();
  try {
    const { code, output } = runGuard(dir);
    expect(output).toContain("OK");
    expect(code).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* The questions half's whole reason to exist: an unreachable API and a quiet
 * night both produce zero answers, so "could not look" must never be reported
 * as "nothing to do". This replaces the old stale-QUESTIONS.md fixture, which
 * tested a comparison the issues channel no longer performs. */
test("fails loud when the issues API cannot be reached (the questions half)", () => {
  const dir = fakeScheduler();
  try {
    const { code, output } = runGuard(dir, { CHEZZ_ISSUES_REPO: UNREACHABLE_REPO });
    // 2 (BLIND), not 1 (BROKEN) and emphatically not 0: "could not look" is
    // its own outcome, and a caller must be able to branch on it.
    expect(code).toBe(2);
    expect(output).toContain("COULD NOT LOOK");
    expect(output).toContain(UNREACHABLE_REPO);
    // It must distinguish the two indistinguishable-looking cases by name,
    // and say what gh actually reported, or the reader can't act on it.
    expect(output).toContain('CANNOT tell "no answers tonight" from "could not look"');
    expect(output).toContain("gh said:");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* A reachable repo must NOT be reported as broken -- the negative control for
 * the test above, so an always-failing questions half can't pass this suite. */
test("reports the questions half OK against the real issues repo", () => {
  const dir = fakeScheduler();
  try {
    const { output } = runGuard(dir);
    expect(output).toContain("questions channel OK");
    expect(output).toContain("question issue(s) across all states");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* THE REGRESSION. Zach answered #3 on 2026-07-29 and #4/#5/#6 on 2026-08-11,
 * by commenting and leaving them OPEN. The label-gated guard reported "0 of
 * them answered" every night regardless. These four are real, live issues on
 * hf7y/chezz; if a run ever again reports zero answers while they sit there,
 * this fails. */
test("sees the real answers Zach left in comments on open, unlabelled issues", () => {
  const dir = fakeScheduler();
  try {
    const { code, output } = runGuard(dir);
    expect(code).toBe(0);
    expect(output).toMatch(/[1-9]\d* still OPEN and awaiting this run/);
    expect(output).toContain("carrying an answer from hf7y");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test("fails loud when the human's FOCUS.md is stale, not just QUESTIONS.md", () => {
  const dir = fakeScheduler({ focus: "# stale focus\n" });
  try {
    const { code, output } = runGuard(dir);
    expect(code).toBe(1);
    expect(output).toContain("focus/chezz.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* The 2026-07-25 stub-loss shape. Now aimed at focus/chezz.md, the half that
 * still uses a symlink -- questions/chezz.md no longer exists to dangle. */
test("fails loud when the FOCUS symlink dangles (the 2026-07-25 stub-loss shape)", () => {
  const dir = fakeScheduler({ focus: null });
  try {
    const { code, output } = runGuard(dir);
    expect(code).toBe(1);
    expect(output).toContain("does not resolve to a file");
    expect(output).toContain("is lost");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* One broken half must not mask the other: a run that fixes only what the
 * first message named would still be flying blind on the second. */
test("reports both channels at once rather than stopping at the first", () => {
  const dir = fakeScheduler({ focus: "# stale\n" });
  try {
    const { code, output } = runGuard(dir, { CHEZZ_ISSUES_REPO: UNREACHABLE_REPO });
    expect(code).toBe(1);
    expect(output).toContain(UNREACHABLE_REPO);
    expect(output).toContain("focus/chezz.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skips audibly when there is no scheduler checkout, rather than exiting 0 silently", () => {
  const { code, output } = runGuard(path.join(tmpdir(), "chezz-no-such-scheduler"));
  expect(code).toBe(0);
  expect(output).toContain("SKIPPED");
  expect(output).toContain("Nothing was verified");
});
