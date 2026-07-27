/* Bakes assets/pieces/*.png into index1.html's PIECE_SPRITES object as base64
 * data URIs.  `npm run pieces:wire`
 *
 * Data URIs rather than <img src="assets/pieces/w-king.png"> on purpose: chezz
 * ships as a single self-contained HTML file (that's what makes the share/bug
 * URLs, the file:// test harness and the GitHub Pages deploy all work without
 * a build step), and 18 sibling PNG requests would break that property. The
 * PNGs stay committed as the editable source; this is the bake.
 *
 * Idempotent -- rewrites the whole marked block every time, so it can be re-run
 * after regenerating any subset of pieces without accumulating duplicates.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "assets", "pieces");
const GAME = path.join(ROOT, "index1.html");

const START = "  /* PIECE_SPRITES:start */";
const END = "  /* PIECE_SPRITES:end */";

// Inverse of generate-pieces.mjs's PIECES[letter].file. Kept as a filename->
// letter map (not re-derived by parsing names) so an unrecognised file in
// assets/pieces/ is an error rather than something silently skipped.
const LETTER_BY_FILE = {
  "w-king": "K", "w-queen": "Q", "w-rook": "R", "w-bishop": "B",
  "w-knight": "N", "w-pawn": "P", "w-amazon": "M", "w-chancellor": "C",
  "w-archbishop": "A",
  "b-king": "k", "b-queen": "q", "b-rook": "r", "b-bishop": "b",
  "b-knight": "n", "b-pawn": "p", "b-amazon": "m", "b-chancellor": "c",
  "b-archbishop": "a",
};

function fail(message) {
  console.error(`wire-pieces: ${message}`);
  process.exit(1);
}

const files = existsSync(OUT_DIR)
  ? readdirSync(OUT_DIR).filter((name) => name.endsWith(".png")).sort()
  : [];

const entries = files.map((name) => {
  const stem = name.slice(0, -4);
  const letter = LETTER_BY_FILE[stem];
  if (!letter) {
    fail(`assets/pieces/${name} doesn't match any known piece ` +
         `(expected one of: ${Object.keys(LETTER_BY_FILE).join(", ")}). ` +
         `Rename it or remove it -- silently ignoring it would ship a sprite set ` +
         `that's missing a piece for no visible reason.`);
  }
  const base64 = readFileSync(path.join(OUT_DIR, name)).toString("base64");
  return `    ${JSON.stringify(letter)}: "data:image/png;base64,${base64}",`;
});

const html = readFileSync(GAME, "utf8");
const start = html.indexOf(START);
const end = html.indexOf(END);
if (start < 0 || end < 0) {
  fail(`could not find the PIECE_SPRITES markers in index1.html. They delimit ` +
       `the generated block; without them there's no safe place to write, and ` +
       `guessing would corrupt the file.`);
}

// An empty set writes `{}` on one line -- byte-identical to the un-generated
// default, so "generate nothing" and "never generated" are the same file, and
// deleting the PNGs cleanly reverts the game to Unicode glyphs.
const body = entries.length ? `\n${entries.join("\n")}\n  ` : "";
const updated =
  html.slice(0, start) +
  `${START}\n  const PIECE_SPRITES = {${body}};\n` +
  html.slice(end);

if (updated === html) {
  console.log(`wire-pieces: index1.html already up to date (${entries.length} sprite(s)).`);
} else {
  writeFileSync(GAME, updated);
  console.log(`wire-pieces: baked ${entries.length} sprite(s) into index1.html.`);
}

const missing = Object.values(LETTER_BY_FILE).length - entries.length;
if (missing > 0) {
  // Not an error: a partial set is a supported state (each missing piece falls
  // back to its Unicode glyph). Said out loud anyway, because a half-generated
  // board is much more likely to be an interrupted run than a deliberate choice.
  console.log(`wire-pieces: ${missing} piece(s) have no sprite and will render as Unicode glyphs.`);
}
