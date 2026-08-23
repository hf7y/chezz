/* Bakes assets/earcons/*.wav into index1.html's EARCON_SOUNDS object as
 * base64 data URIs, the same way wire-pieces.mjs bakes sprites. `npm run
 * earcons:wire`
 *
 * Data URIs rather than <audio src="assets/earcons/capture.wav"> for the same
 * reason as the sprites: chezz ships as a single self-contained HTML file, and
 * three sibling WAV requests would break that property.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "assets", "earcons");
const GAME = path.join(ROOT, "index1.html");

const START = "  /* EARCON_SOUNDS:start */";
const END = "  /* EARCON_SOUNDS:end */";

const files = existsSync(OUT_DIR)
  ? readdirSync(OUT_DIR).filter((name) => name.endsWith(".wav")).sort()
  : [];

const entries = files.map((name) => {
  const key = name.slice(0, -4);
  const base64 = readFileSync(path.join(OUT_DIR, name)).toString("base64");
  return `    ${JSON.stringify(key)}: "data:audio/wav;base64,${base64}",`;
});

const html = readFileSync(GAME, "utf8");
const start = html.indexOf(START);
const end = html.indexOf(END);
if (start < 0 || end < 0) {
  console.error(`wire-earcons: could not find the EARCON_SOUNDS markers in index1.html. ` +
    `They delimit the generated block; without them there's no safe place to write.`);
  process.exit(1);
}

const body = entries.length ? `\n${entries.join("\n")}\n  ` : "";
const updated =
  html.slice(0, start) +
  `${START}\n  const EARCON_SOUNDS = {${body}};\n` +
  html.slice(end);

if (updated === html) {
  console.log(`wire-earcons: index1.html already up to date (${entries.length} sound(s)).`);
} else {
  writeFileSync(GAME, updated);
  console.log(`wire-earcons: baked ${entries.length} sound(s) into index1.html.`);
}
