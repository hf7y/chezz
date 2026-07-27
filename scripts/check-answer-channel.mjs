// The answer channel is the load-bearing half of autopilot: automation asks a
// question in `.scheduler/QUESTIONS.md`, Zach replies inline with `> `, and the
// next unattended run reads the reply and acts on it. That loop only works if
// the file Zach writes into is the SAME file the run reads.
//
// Twice it hasn't been, and both times the loss was silent:
//   2026-07-25 (`7beef04`) — Zach's 10:00 edit landed in a header-only stub at
//     the stale `.claude/` path; the real questions were elsewhere.
//   2026-07-27 — the scheduler's `questions/chezz.md` symlink pointed at a
//     checkout 6 commits behind origin/main, so the three questions filed that
//     day were invisible to him and the four he COULD see were stale. This is
//     why the milestone's "QUESTIONS.md `> `-reply round-trips" bullet had
//     never actually been demonstrated.
//
// Both are the same defect in different clothes, and neither announced itself.
// This check states the invariant directly — what the human reads == what the
// run reads — so a third variant fails loud instead of quietly eating a reply.
//
// Deliberately NOT part of `npm run check`: `check` runs in the pre-commit
// hook, and a stale checkout somewhere else on the machine must not block the
// very commit that fixes it. It is wired into the two standing run modes
// instead (`.claude/commands/nightly-batch.md`, `bug-sweep.md`), which is where
// acting on a missed answer actually matters.
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// One source for the scheduler location: env override, else the known path.
// If it isn't there (fresh clone, CI, another machine) this is not a failure —
// but it says so out loud rather than exiting 0 as though it had checked.
const schedulerDir =
  process.env.CHEZZ_SCHEDULER_DIR ||
  "/home/zach/Documents/Project Archive/scheduler";

// The pairs Zach actually reads/writes through, and what they must match.
const CHANNELS = [
  { human: "questions/chezz.md", run: ".scheduler/QUESTIONS.md" },
  { human: "focus/chezz.md", run: ".scheduler/FOCUS.md" },
];

if (!existsSync(schedulerDir)) {
  console.log(
    `check-answer-channel: SKIPPED — no scheduler checkout at ${schedulerDir}. ` +
    `Set CHEZZ_SCHEDULER_DIR to point at one. Nothing was verified.`
  );
  process.exit(0);
}

const problems = [];

for (const { human, run } of CHANNELS) {
  const humanPath = path.join(schedulerDir, human);
  const runPath = path.join(root, run);

  if (!existsSync(humanPath)) {
    problems.push(
      `${human} does not resolve to a file (dangling symlink or missing). ` +
      `Anything Zach writes there is lost.`
    );
    continue;
  }

  const humanText = readFileSync(humanPath, "utf8");
  const runText = readFileSync(runPath, "utf8");

  if (humanText === runText) continue;

  const target = realpathSync(humanPath);
  problems.push(
    `${human} and ${run} DIFFER.\n` +
    `      Zach writes into: ${target} (${humanText.length} bytes)\n` +
    `      this run reads:   ${runPath} (${runText.length} bytes)\n` +
    `      They are different files with different content, so a reply left ` +
    `in the first will never reach the second.`
  );
}

if (problems.length === 0) {
  console.log(
    "check-answer-channel: OK — the files Zach writes answers into are " +
    "byte-identical to the ones this run reads."
  );
  process.exit(0);
}

console.error("check-answer-channel: THE ANSWER CHANNEL IS BROKEN\n");
for (const p of problems) console.error(`  - ${p}\n`);
console.error(
  `  Remedy: the symlinked checkout is usually just behind origin/main.\n` +
  `  If its tree is clean and it is 0 commits ahead, a fast-forward is\n` +
  `  lossless and fixes this:\n` +
  `      git -C <that checkout> fetch origin && git -C <that checkout> merge --ff-only origin/main\n` +
  `  Re-run this check to confirm. If it is NOT a clean fast-forward, it may\n` +
  `  hold an unpushed reply from Zach — read it before touching anything.`
);
process.exit(1);
