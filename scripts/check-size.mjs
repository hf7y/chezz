// Size policy (human decision, 2026-07-25 report reply): the byte limit is
// ABANDONED for chezz narrative (index1.html on main — the build hosted at
// hf7y.github.io/chezz). Size is still printed every run so creep stays
// visible, but it never fails the build and never pre-blocks a feature.
// The limit is enforced ONLY on the `chezz-classic` branch, whose whole
// focus is elegance/efficiency (long-term aspiration: fit a Game Boy
// classic cartridge). If classic ever exceeds the cap, the build fails
// loud and the run must file a blocker to Zach (scheduler BLOCKERS.md,
// ## chezz) to raise the threshold before continuing — never trim
// silently to get under it.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOFT_TARGET_BYTES = 50_000;
const HARD_CAP_BYTES = 100_000;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { size } = statSync(path.join(root, "index1.html"));

let branch = "unknown";
try {
  branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: root, encoding: "utf8",
  }).trim();
} catch {
  // No git available: fall through to the non-enforcing narrative path —
  // enforcement only ever applies to a checkout that knows it's classic.
}

const enforced = branch === "chezz-classic";

console.log(
  `check-size: index1.html is ${size} bytes on branch ${branch} ` +
  (enforced
    ? `(ENFORCED: soft target ${SOFT_TARGET_BYTES}, hard cap ${HARD_CAP_BYTES})`
    : `(tracking only — no byte limit on the narrative build)`)
);

if (!enforced) process.exit(0);

if (size > HARD_CAP_BYTES) {
  console.error(
    `check-size: chezz-classic is over the ${HARD_CAP_BYTES}-byte hard cap ` +
    `by ${size - HARD_CAP_BYTES} bytes. Do NOT trim to fit on your own ` +
    `judgment — file an issue for Zach (\`scheduler ask chezz "..."\`, or ` +
    `\`gh issue create --repo hf7y/chezz\`) to raise the threshold before continuing.`
  );
  process.exit(1);
}
if (size > SOFT_TARGET_BYTES) {
  console.warn(`check-size: over the ${SOFT_TARGET_BYTES}-byte soft target by ${size - SOFT_TARGET_BYTES} bytes`);
}
