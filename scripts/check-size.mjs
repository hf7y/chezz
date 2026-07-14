// Makes size creep visible on every change instead of being discovered
// during an occasional cleanup pass. Soft target is a warning (doesn't fail
// the build); hard cap does.
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOFT_TARGET_BYTES = 50_000;
const HARD_CAP_BYTES = 100_000;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { size } = statSync(path.join(root, "index1.html"));

console.log(`check-size: index1.html is ${size} bytes (soft target ${SOFT_TARGET_BYTES}, hard cap ${HARD_CAP_BYTES})`);

if (size > HARD_CAP_BYTES) {
  console.error(`check-size: over the ${HARD_CAP_BYTES}-byte hard cap by ${size - HARD_CAP_BYTES} bytes`);
  process.exit(1);
}
if (size > SOFT_TARGET_BYTES) {
  console.warn(`check-size: over the ${SOFT_TARGET_BYTES}-byte soft target by ${size - SOFT_TARGET_BYTES} bytes`);
}
