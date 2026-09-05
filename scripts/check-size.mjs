// Narrative (main) is tracking-only, unbounded. Classic is capped on the
// PUBLISHED ARTIFACT (stripped, same as bin/build-site.sh), never on its
// own commented source -- hf7y/chezz#90.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripHtml } from "./strip-html.mjs";

const SOFT_TARGET_BYTES = 50_000;
const HARD_CAP_BYTES = 100_000;
const CLASSIC_BRANCH = process.env.CLASSIC_BRANCH || "chezz-classic";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: "utf8" });
}

const { size: narrativeSize } = statSync(path.join(root, "index1.html"));
console.log(
  `check-size: index1.html (narrative) is ${narrativeSize} bytes ` +
  `(tracking only — no byte limit on the narrative build)`
);

run("git", ["fetch", "--depth=1", "origin", `+refs/heads/${CLASSIC_BRANCH}:refs/remotes/origin/${CLASSIC_BRANCH}`]);
const classicSource = run("git", ["show", `origin/${CLASSIC_BRANCH}:index1.html`]);
const classicArtifact = stripHtml(classicSource);
const artifactSize = Buffer.byteLength(classicArtifact);

console.log(
  `check-size: classic artifact (stripped ${CLASSIC_BRANCH}:index1.html) is ` +
  `${artifactSize} bytes (ENFORCED: soft target ${SOFT_TARGET_BYTES}, hard cap ${HARD_CAP_BYTES})`
);

if (artifactSize > HARD_CAP_BYTES) {
  console.error(
    `check-size: classic's built artifact is over the ${HARD_CAP_BYTES}-byte hard cap ` +
    `by ${artifactSize - HARD_CAP_BYTES} bytes. Do NOT trim to fit -- ` +
    `file an issue (\`gh issue create --repo hf7y/chezz\`) to raise the threshold.`
  );
  process.exit(1);
}
if (artifactSize > SOFT_TARGET_BYTES) {
  console.warn(`check-size: classic artifact is over the ${SOFT_TARGET_BYTES}-byte soft target by ${artifactSize - SOFT_TARGET_BYTES} bytes`);
}
