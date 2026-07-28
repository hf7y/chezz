/* Generates chezz's piece sprites with Google's Gemini image model, then runs
 * each one through tools/sprite-postprocess.js and writes assets/pieces/.
 *
 *   export GEMINI_API_KEY=...        (https://aistudio.google.com/apikey)
 *   npm run pieces:generate          # all 18 pieces
 *   npm run pieces:generate -- K p   # just these, by SYMBOLS letter
 *   npm run pieces:wire              # bake them into index1.html
 *
 * Sign-off: this is a NEW external service dependency, which FOCUS.md gates
 * behind explicit human approval. Zach gave it 2026-07-27 (scheduler
 * BLOCKERS.md, "## chezz", replying to the Gemini-sprite blocker: "Yes, pursue
 * the gemini path, safe bounded account balance exists for testing precisely
 * this"). It is deliberately a MANUAL step, not part of `npm run check` or any
 * nightly path -- generation costs money per call and is non-deterministic, so
 * nothing should be able to trigger it as a side effect. The committed PNGs in
 * assets/pieces/ are the artifact; this script is how they get regenerated.
 *
 * Adapted from vkv-inventory's tools/generate_sprite.py, which does the same
 * job for isometric box textures. Two deliberate divergences: this calls the
 * REST endpoint with plain fetch instead of adding the google-genai Python SDK
 * (chezz is a Node repo with no Python at all), and it does its image work on
 * a Playwright canvas instead of Pillow/numpy (Playwright is already a
 * devDependency here). Net new dependencies: none.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "assets", "pieces");
const POSTPROCESS = path.join(ROOT, "tools", "sprite-postprocess.js");

const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/* Keyed by index1.html's own SYMBOLS letters (uppercase = White). `file` is
 * spelled out rather than using the letter, because "K.png" and "k.png" are
 * the same path on a case-insensitive filesystem -- a macOS checkout would
 * silently collapse each White piece onto its Black twin. */
const PIECES = {
  K: { file: "w-king", name: "king", side: "white" },
  Q: { file: "w-queen", name: "queen", side: "white" },
  R: { file: "w-rook", name: "rook", side: "white" },
  B: { file: "w-bishop", name: "bishop", side: "white" },
  N: { file: "w-knight", name: "knight", side: "white" },
  P: { file: "w-pawn", name: "pawn", side: "white" },
  M: { file: "w-amazon", name: "amazon (a queen crowned with a horse's head, combining queen and knight)", side: "white" },
  C: { file: "w-chancellor", name: "chancellor (a castle rook topped with a horse's head, combining rook and knight)", side: "white" },
  A: { file: "w-archbishop", name: "archbishop (a bishop's mitre topped with a horse's head, combining bishop and knight)", side: "white" },
  k: { file: "b-king", name: "king", side: "black" },
  q: { file: "b-queen", name: "queen", side: "black" },
  r: { file: "b-rook", name: "rook", side: "black" },
  b: { file: "b-bishop", name: "bishop", side: "black" },
  n: { file: "b-knight", name: "knight", side: "black" },
  p: { file: "b-pawn", name: "pawn", side: "black" },
  m: { file: "b-amazon", name: "amazon (a queen crowned with a horse's head, combining queen and knight)", side: "black" },
  c: { file: "b-chancellor", name: "chancellor (a castle rook topped with a horse's head, combining rook and knight)", side: "black" },
  a: { file: "b-archbishop", name: "archbishop (a bishop's mitre topped with a horse's head, combining bishop and knight)", side: "black" },
};

/* The magenta field is load-bearing, not decorative: sprite-postprocess.js
 * keys transparency off saturation, so the background must be a color the
 * monochrome art itself can never contain. Asking for a "white background"
 * instead would make a white king's own body indistinguishable from it.
 *
 * "Side view, facing right" matches how a physical chess set reads on a board
 * and keeps the whole set consistent; without it the model mixes 3/4 views and
 * front-on views across pieces and they stop looking like one set. */
const PROMPT = ({ name, side }) => `\
A single ${side} chess ${name}, drawn as a flat 2D pixel-art game sprite.

Straight-on side view, facing right, the entire piece visible and centered,
nothing cropped by the frame edges. NOT a 3D render, NOT an isometric or
perspective view, no camera angle, no board, no other pieces, no text, no
drop shadow on the ground.

STRICTLY GREYSCALE artwork: pure blacks, whites and greys only, absolutely no
color anywhere in the piece itself. A ${side} piece should read clearly as the
${side} side -- ${side === "white"
    ? "a light, near-white body with dark outlines and shading"
    : "a dark, near-black body with light outlines and highlights"}.

Bold, chunky, high-contrast shapes with a clear readable silhouette, since this
will be displayed very small. Flat color blocks, hard edges, no soft gradients,
no anti-aliasing, no blur.

The background behind the piece is SOLID PURE MAGENTA (#FF00FF), completely
uniform, filling every pixel not covered by the piece itself. The magenta is a
transparency key that gets removed -- never use magenta, pink or purple
anywhere in the piece's own artwork.`;

function fail(message) {
  console.error(`generate-pieces: ${message}`);
  process.exit(1);
}

/* True when an API rejection is about the ACCOUNT rather than this one call,
 * so retrying the remaining pieces is guaranteed-futile spend. Exported for
 * test/gemini-fatal.spec.mjs -- the 2026-07-28 live run is the witness this
 * exists for, and a regression here is invisible until it costs money. */
export function isFatalApiError(status, text) {
  if (status === 401 || status === 403) return true;
  // A 429 is normally "slow down" -- retryable, and NOT fatal. The exception
  // is a stated limit of 0, which means no quota exists to wait for.
  return status === 429 && /limit:\s*0\b/.test(text || "");
}

async function generateOne(apiKey, spec) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT(spec) }] }] }),
  });
  if (!response.ok) {
    // Surface the API's own message -- a 429 (quota), 403 (bad key) and 400
    // (bad request) need completely different fixes, and "generation failed"
    // alone would send the next reader hunting through all three.
    const text = await response.text();
    const error = new Error(`Gemini API ${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
    // ACCOUNT-LEVEL vs PER-CALL failure. A 401/403, or a 429 whose quota
    // limit is literally 0, is not a transient hiccup and not specific to
    // this piece: it says this key cannot call this model AT ALL. Retrying
    // the other 17 cannot succeed, so mark it fatal and let main() abort the
    // whole run. Witnessed 2026-07-28: a first live run burned all 18 calls
    // against `generate_content_free_tier_requests, limit: 0` (the image
    // model has no free tier) and printed 18 near-identical stack-height
    // paragraphs, burying the one line that actually mattered. Zero dollars
    // lost -- the account was unbilled, which is exactly why it failed -- but
    // on a BILLED key the same bug spends 18x the cost of learning one fact.
    error.fatal = isFatalApiError(response.status, text);
    throw error;
  }
  const body = await response.json();
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data);
  if (!image) {
    throw new Error(`no image in response (parts: ${JSON.stringify(parts).slice(0, 300)})`);
  }
  return `data:${image.inlineData.mimeType || "image/png"};base64,${image.inlineData.data}`;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fail(
      "GEMINI_API_KEY is not set -- refusing to run.\n" +
      "  Get one at https://aistudio.google.com/apikey, then: export GEMINI_API_KEY=...\n" +
      "  (This is the only remaining blocker on the sprite pipeline: everything\n" +
      "   downstream of the API call is tested and working -- see\n" +
      "   test/sprite-postprocess.spec.mjs and test/piece-sprites.spec.mjs.)",
    );
  }

  const requested = process.argv.slice(2);
  const unknown = requested.filter((letter) => !(letter in PIECES));
  if (unknown.length) fail(`unknown piece letter(s): ${unknown.join(", ")} (expected one of ${Object.keys(PIECES).join("")})`);
  const letters = requested.length ? requested : Object.keys(PIECES);

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addScriptTag({ path: POSTPROCESS });

  const failures = [];
  try {
    for (const letter of letters) {
      const spec = PIECES[letter];
      process.stdout.write(`${letter} (${spec.file})... `);
      try {
        const raw = await generateOne(apiKey, spec);
        const processed = await page.evaluate((uri) => window.postprocessSprite(uri), raw);
        const png = Buffer.from(processed.split(",")[1], "base64");
        writeFileSync(path.join(OUT_DIR, `${spec.file}.png`), png);
        console.log(`ok (${png.length} bytes)`);
      } catch (error) {
        // One bad generation shouldn't abandon the other 17 already paid for.
        // Collected and re-raised at the end so the exit code still fails loud.
        console.log(`FAILED: ${error.message}`);
        failures.push(letter);
        if (error.fatal) {
          // ...but an account-level rejection WILL repeat for every remaining
          // piece, so stop rather than paying to learn the same thing 17 more
          // times. See the `error.fatal` note in generateOne.
          console.log(
            `\nSTOPPING after 1 of ${letters.length}: that failure is account-level, not piece-specific.\n` +
            `  A 429 with "limit: 0" means this key's project has no quota for ${MODEL} --\n` +
            `  the image model is not on the free tier, so this needs billing enabled on the\n` +
            `  project the key belongs to (check which one at https://aistudio.google.com/apikey).\n` +
            `  Nothing was written and nothing was charged. Re-run after fixing billing.`,
          );
          break;
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    fail(`${failures.length} of ${letters.length} piece(s) failed: ${failures.join(", ")}\n` +
         `  Re-run just those: npm run pieces:generate -- ${failures.join(" ")}`);
  }

  console.log(`\nWrote ${letters.length} sprite(s) to assets/pieces/. Baking into index1.html...`);
  execFileSync(process.execPath, [path.join(ROOT, "tools", "wire-pieces.mjs")], { stdio: "inherit" });
}

/* Only auto-run when invoked as a script. Without this guard, importing the
 * module to test isFatalApiError would execute main() -- i.e. a test run would
 * start calling a paid image API. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
