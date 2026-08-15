// The Apps Script backend fires a sweep by POSTing workflow_dispatch to a
// workflow named by filename: leaderboard/Code.gs's GH_WORKFLOW_FILE. Nothing
// links the two -- rename or delete the workflow and the dispatch becomes a
// 404 that Code.gs logs into the Apps Script console and nobody reads, while
// the debounce state stays intact and the sheet keeps collecting reports that
// never trigger anything.
//
// So: assert the file Code.gs names actually exists. Cheap, offline, and part
// of `npm run check` -- unlike check-live-deploy.mjs, this touches no network.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function dispatchTarget(source = readFileSync(path.join(ROOT, "leaderboard/Code.gs"), "utf8")) {
  const match = source.match(/^\s*const\s+GH_WORKFLOW_FILE\s*=\s*["']([^"']+)["']/m);
  return match?.[1] ?? null;
}

export function checkDispatchTarget(target = dispatchTarget()) {
  if (!target) return { ok: false, detail: "GH_WORKFLOW_FILE not found in leaderboard/Code.gs" };
  const workflow = path.join(ROOT, ".github/workflows", target);
  if (!existsSync(workflow)) {
    return { ok: false, target, detail: `.github/workflows/${target} does not exist` };
  }
  return { ok: true, target };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = checkDispatchTarget();
  if (!result.ok) {
    console.error(`check-dispatch-target: ${result.detail}`);
    console.error("The player-report sweep dispatch would 404. Update GH_WORKFLOW_FILE");
    console.error("in leaderboard/Code.gs (and redeploy it with clasp), or restore the workflow.");
    process.exit(1);
  }
  console.log(`check-dispatch-target: OK — Code.gs dispatches ${result.target}, which exists.`);
}
