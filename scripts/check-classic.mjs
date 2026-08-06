// Item 12 (FOCUS.md priority queue): "a durable, from-the-main-job
// mechanism" for chezz-classic's own lighter test suite -- called from the
// SAME scheduler job as narrative's `npm run check`, not a new one, per
// Zach's answer ("something lighter... called from the same scheduler
// job"). Before this, verifying a chezz-classic port meant an ad hoc
// `git worktree add` + manual `npm run check` + manual teardown, done by
// hand each time (see the 2026-08-06 nightly reports, second/third
// dispatch) -- this makes that a one-command, always-torn-down step any
// run can call.
//
// Deliberately NOT folded into `npm run check` itself: that script is also
// the pre-commit hook, and it runs on every commit to `main`, most of which
// never touch chezz-classic. Running classic's full Playwright suite on
// every narrative-only commit would slow every commit for no reason. This
// is its own script, run explicitly once per nightly/bug-sweep pass.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BRANCH = process.env.CHEZZ_CLASSIC_BRANCH || "chezz-classic";

// PID/random-qualified, never a predictable generic name -- this host's
// /tmp is shared across several differently-scheduled projects and a
// generic name already caused a real collision once (hf7y/senechal#107,
// see the monkey-host-infra-gaps memory). mkdtemp gives us both properties
// for free.
const worktreeDir = mkdtempSync(path.join(tmpdir(), "chezz-classic-check-"));

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });
}

let exitCode = 0;
let worktreeAdded = false;
try {
  console.log(`check-classic: fetching origin/${BRANCH}...`);
  run("git", ["fetch", "origin", BRANCH]);

  console.log(`check-classic: checking out ${BRANCH} @ FETCH_HEAD into ${worktreeDir}...`);
  // --detach: this is a disposable read-only checkout for testing, not a
  // second place to develop from -- a real edit belongs in a branch
  // checkout a human or another run controls, not this script's tmpdir.
  run("git", ["worktree", "add", "--detach", worktreeDir, "FETCH_HEAD"]);
  worktreeAdded = true;

  // Same repo, same package.json dependencies (only a few narrative-only
  // npm scripts differ -- verified by diffing package.json across
  // branches) -- reuse the already-installed, already-browser-fetched
  // node_modules instead of a slow, redundant `npm ci`.
  const mainNodeModules = path.join(root, "node_modules");
  if (existsSync(mainNodeModules)) {
    symlinkSync(mainNodeModules, path.join(worktreeDir, "node_modules"), "dir");
  } else {
    throw new Error(`no node_modules at ${mainNodeModules} to reuse -- run npm install on main first`);
  }

  console.log(`check-classic: running npm run check on ${BRANCH}...`);
  run("npm", ["run", "check"], { cwd: worktreeDir, stdio: "inherit" });
  console.log(`check-classic: ${BRANCH} suite green.`);
} catch (err) {
  exitCode = 1;
  console.error(`check-classic: FAILED -- ${err.message || err}`);
} finally {
  try {
    if (worktreeAdded) {
      run("git", ["worktree", "remove", "--force", worktreeDir]);
    } else {
      // git never registered this dir as a worktree (failed before or
      // during `git worktree add`), so `git worktree remove` would itself
      // fail on it -- just delete the empty/partial mkdtemp dir directly.
      rmSync(worktreeDir, { recursive: true, force: true });
    }
  } catch (cleanupErr) {
    console.error(
      `check-classic: worktree cleanup at ${worktreeDir} failed (${cleanupErr.message || cleanupErr}) -- ` +
      `remove it by hand with: git worktree remove --force ${worktreeDir}`
    );
    exitCode = 1;
  }
}

process.exit(exitCode);
