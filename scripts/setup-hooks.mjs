// Runs on `npm install` (as the "prepare" script) so a fresh clone gets the
// pre-commit hook wired up automatically, with no manual step to forget.
import { execSync } from "node:child_process";

try {
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
  execSync("git config core.hooksPath .githooks");
  console.log("setup-hooks: git hooks path set to .githooks (pre-commit runs `npm run check`)");
} catch {
  // Not inside a git checkout (e.g. installed as a dependency elsewhere) --
  // nothing to hook into.
}
