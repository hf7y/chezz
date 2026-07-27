/* Covers scripts/check-answer-channel.mjs -- the guard on the autopilot answer
 * channel (automation asks in .scheduler/QUESTIONS.md, Zach replies inline with
 * `> `, the next unattended run acts on it).
 *
 * This exists because the channel has broken silently twice, both times by the
 * human's copy and the run's copy drifting apart:
 *   2026-07-25 (`7beef04`) -- his edit landed in a header-only stub.
 *   2026-07-27 -- the scheduler's questions/chezz.md symlink pointed at a
 *     checkout 6 commits behind origin/main, hiding the three questions filed
 *     that day and showing four stale ones.
 *
 * The failing cases below are the point of the file. A guard that only proves
 * it can say OK hasn't been tested at all -- so each drift mode gets its own
 * fixture and each one must exit non-zero with a message that names the defect.
 */
import { test, expect } from "@playwright/test";
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
function runGuard(schedulerDir) {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, CHEZZ_SCHEDULER_DIR: schedulerDir },
    });
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.status, output: `${err.stdout || ""}${err.stderr || ""}` };
  }
}

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

test("fails loud when the human's QUESTIONS.md is stale (the 2026-07-27 defect)", () => {
  // A real stale copy: the true file minus the questions added most recently.
  const stale = "# Questions for the user\n\nolder content only\n";
  const dir = fakeScheduler({ questions: stale });
  try {
    const { code, output } = runGuard(dir);
    expect(code).toBe(1);
    expect(output).toContain("ANSWER CHANNEL IS BROKEN");
    expect(output).toContain("questions/chezz.md");
    // It must say WHERE, or the reader can't act on it.
    expect(output).toContain("Zach writes into:");
    expect(output).toContain("merge --ff-only origin/main");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test("fails loud when the symlink dangles (the 2026-07-25 stub-loss shape)", () => {
  const dir = fakeScheduler({ questions: null });
  try {
    const { code, output } = runGuard(dir);
    expect(code).toBe(1);
    expect(output).toContain("does not resolve to a file");
    expect(output).toContain("is lost");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports both channels at once rather than stopping at the first", () => {
  const dir = fakeScheduler({ questions: "# stale\n", focus: "# stale\n" });
  try {
    const { code, output } = runGuard(dir);
    expect(code).toBe(1);
    expect(output).toContain("questions/chezz.md");
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
