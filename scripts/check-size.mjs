// Size policy (human decision, 2026-07-25 report reply, revised by
// hf7y/chezz#90 on 2026-09-04): the byte limit is ABANDONED for chezz
// narrative (index1.html on main — the build hosted at hf7y.github.io/chezz).
// Size is still printed every run so creep stays visible, but it never fails
// the build and never pre-blocks a feature.
//
// The limit is enforced on classic, whose whole focus is elegance/efficiency
// (long-term aspiration: fit a Game Boy classic cartridge) — but on the
// PUBLISHED ARTIFACT (comments/blank lines/indentation stripped by
// scripts/strip-html.mjs, same transform bin/build-site.sh applies), not on
// chezz-classic's own index1.html source. That source is hand-edited and
// keeps every comment; measuring it against the cap would eventually force
// cutting load-bearing rationale to pay for a byte budget (#90's own
// audit: 24,635 of the 70,822 raw bytes are comments). So this no longer
// gates on `branch === "chezz-classic"` — it always builds and measures the
// classic artifact, regardless of which branch is currently checked out,
// the same way bin/build-site.sh always builds it for deploy.
//
// If classic's artifact ever exceeds the cap, the build fails loud and the
// run must file an issue (`gh issue create --repo hf7y/chezz`) to raise the
// threshold before continuing — never trim silently to get under it.
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

// Narrative: tracking only, unchanged in spirit from the 2026-07-25 policy.
const { size: narrativeSize } = statSync(path.join(root, "index1.html"));
console.log(
  `check-size: index1.html (narrative) is ${narrativeSize} bytes ` +
  `(tracking only — no byte limit on the narrative build)`
);

// Classic: build the same artifact bin/build-site.sh ships, and enforce.
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
    `by ${artifactSize - HARD_CAP_BYTES} bytes. Do NOT trim to fit on your own ` +
    `judgment — file an issue for Zach (\`gh issue create --repo hf7y/chezz\`) ` +
    `to raise the threshold before continuing.`
  );
  process.exit(1);
}
if (artifactSize > SOFT_TARGET_BYTES) {
  console.warn(`check-size: classic artifact is over the ${SOFT_TARGET_BYTES}-byte soft target by ${artifactSize - SOFT_TARGET_BYTES} bytes`);
}
