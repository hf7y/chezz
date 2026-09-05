// Narrative (main) is tracking-only, unbounded. Classic is capped on the
// PUBLISHED ARTIFACT (stripped, same as bin/build-site.sh), never on its
// own commented source -- hf7y/chezz#90.
//
// The artifact itself is BUILT, not just fetched -- hf7y/chezz#89:
// build-classic-artifact.mjs splices narrative's current engine functions
// into classic's own shell, so this measures the artifact the same way a
// fix to the shared engine would actually reach it, not a stale branch
// snapshot.
import { statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripHtml } from "./strip-html.mjs";
import { buildClassicArtifact, fetchClassicSource } from "./build-classic-artifact.mjs";

const SOFT_TARGET_BYTES = 50_000;
const HARD_CAP_BYTES = 100_000;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { size: narrativeSize } = statSync(path.join(root, "index1.html"));
console.log(
  `check-size: index1.html (narrative) is ${narrativeSize} bytes ` +
  `(tracking only — no byte limit on the narrative build)`
);

const narrativeHtml = readFileSync(path.join(root, "index1.html"), "utf8");
const classicHtml = fetchClassicSource();
const classicArtifact = stripHtml(buildClassicArtifact({ narrativeHtml, classicHtml }));
const artifactSize = Buffer.byteLength(classicArtifact);

console.log(
  `check-size: classic artifact (built + stripped) is ` +
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
