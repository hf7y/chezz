// The answer channel is the load-bearing half of autopilot: automation asks a
// question, Zach replies, and the next unattended run reads the reply and acts
// on it. That loop only works if the place Zach writes is the SAME place the
// run reads.
//
// Twice under the FILE channel it wasn't, and both times the loss was silent:
//   2026-07-25 (`7beef04`) — Zach's 10:00 edit landed in a header-only stub at
//     the stale `.claude/` path; the real questions were elsewhere.
//   2026-07-27 — the scheduler's `questions/chezz.md` symlink pointed at a
//     checkout 6 commits behind origin/main, so the three questions filed that
//     day were invisible to him and the four he COULD see were stale.
//
// 2026-07-28: QUESTIONS MOVED TO GITHUB ISSUES (human-directed, "move the full
// chezz over to test the github issues pipeline"). The failure above was never
// really about symlink hygiene — it was about keeping a COPY of question state
// on disk at all. The replacement keeps none: `scheduler -q chezz` renders the
// open `question`-labelled issues fresh from the API into a throwaway buffer
// and deletes it on exit. There is nothing left to drift.
//
// So the invariant this file asserts has changed shape, but not purpose. It is
// no longer "two files match"; it is **"this run can actually reach the place
// Zach's answers live."** That still has to fail LOUD, for exactly the old
// reason: an unreachable API and a genuinely quiet night both look like zero
// answers, and a reply never seen is indistinguishable from one never written.
//
// FOCUS.md is still on the file/symlink channel and is still checked the old
// way — only questions moved.
//
// Deliberately NOT part of `npm run check`: `check` runs in the pre-commit
// hook, and a network blip or an expired token must not block the very commit
// that fixes it. It is wired into the two standing run modes instead
// (`.claude/commands/nightly-batch.md`, `bug-sweep.md`), which is where acting
// on a missed answer actually matters.
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// One source for the scheduler location: env override, else the known path.
const schedulerDir =
  process.env.CHEZZ_SCHEDULER_DIR ||
  "/home/zach/Documents/Project Archive/scheduler";

// One source for the repo whose issues carry chezz's questions. Derived from
// the same conf field `scheduler` itself derives it from, so the two cannot
// disagree; the literal below is only the fallback for a checkout with no
// scheduler beside it.
const ISSUES_REPO = process.env.CHEZZ_ISSUES_REPO || "hf7y/chezz";

const problems = [];

// --- half 1: questions, on the issues channel --------------------------
//
// Three things have to hold, and each is checked separately so the message
// names which one broke rather than a generic "gh failed".
function checkIssuesChannel() {
  let out;
  try {
    out = execFileSync(
      "gh",
      ["issue", "list", "--repo", ISSUES_REPO, "--label", "question",
       "--state", "open", "--limit", "200", "--json", "number,labels"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
    );
  } catch (err) {
    const detail = (err.stderr || err.message || "").toString().trim();
    problems.push(
      `cannot reach the GitHub issues for ${ISSUES_REPO}, where Zach's answers live.\n` +
      `      This run CANNOT tell "no answers tonight" from "could not look".\n` +
      `      gh said: ${detail || "(no output)"}\n` +
      `      Check: gh auth status   (note it can show one FAILING account\n` +
      `      alongside a working one — read the whole output before concluding\n` +
      `      the credential is dead; that misreading cost two days in 07/2026).`
    );
    return;
  }

  let issues;
  try {
    issues = JSON.parse(out);
  } catch {
    problems.push(`gh returned output that is not JSON for ${ISSUES_REPO}. Raw: ${out.slice(0, 200)}`);
    return;
  }

  const answered = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "answered")
  );
  console.log(
    `check-answer-channel: questions channel OK — ${ISSUES_REPO} reachable, ` +
    `${issues.length} open question(s), ${answered.length} of them answered ` +
    `and awaiting this run` +
    (answered.length
      ? `: #${answered.map((i) => i.number).join(", #")}`
      : ".")
  );
}

// --- half 2: FOCUS.md, still on the file channel -----------------------
function checkFocusChannel() {
  if (!existsSync(schedulerDir)) {
    console.log(
      `check-answer-channel: FOCUS pair SKIPPED — no scheduler checkout at ` +
      `${schedulerDir}. Set CHEZZ_SCHEDULER_DIR to point at one. Nothing was verified.`
    );
    return;
  }
  const humanPath = path.join(schedulerDir, "focus/chezz.md");
  const runPath = path.join(root, ".scheduler/FOCUS.md");

  if (!existsSync(humanPath)) {
    problems.push(
      `focus/chezz.md does not resolve to a file (dangling symlink or missing). ` +
      `Anything Zach writes there is lost.\n` +
      `      Remedy: the symlinked checkout is usually just behind origin/main.\n` +
      `      If its tree is clean and 0 commits ahead, a fast-forward is lossless:\n` +
      `          git -C <that checkout> fetch origin && git -C <that checkout> merge --ff-only origin/main`
    );
    return;
  }

  const humanText = readFileSync(humanPath, "utf8");
  const runText = readFileSync(runPath, "utf8");
  if (humanText === runText) {
    console.log("check-answer-channel: FOCUS pair OK — byte-identical.");
    return;
  }

  problems.push(
    `focus/chezz.md and .scheduler/FOCUS.md DIFFER.\n` +
    `      Zach writes into: ${realpathSync(humanPath)} (${humanText.length} bytes)\n` +
    `      this run reads:   ${runPath} (${runText.length} bytes)\n` +
    `      A note left in the first will never reach the second.`
  );
}

checkIssuesChannel();
checkFocusChannel();

if (problems.length === 0) process.exit(0);

console.error("\ncheck-answer-channel: THE ANSWER CHANNEL IS BROKEN\n");
for (const p of problems) console.error(`  - ${p}\n`);
process.exit(1);
