/* Covers index1.html's side of the sprite pipeline: pieceGlyphHtml renders a
 * generated sprite when one exists for that piece, and falls back to the
 * Unicode glyph when one doesn't.
 *
 * UPDATED 2026-09-07 (hf7y/chezz#97): most pieces now ship a real sprite --
 * the deterministic 16x16 pipeline (tools/generate-glyph-sprites.mjs)
 * generates all of them at once, no API key or network call needed, so
 * "sprite for most pieces" is the current shipped state, not a degraded one.
 * Y/y (Knightrider) is the one deliberate holdout: it has no dedicated
 * glyph or sprite of its own and reuses the plain Knight glyph rotated via
 * CSS instead (see index1.html's own SYMBOLS/pieceGlyphHtml comments), so it
 * doubles as this file's live example of the fallback path. Per-piece
 * fallback also means an interrupted/partial (re-)generation leaves a mixed
 * board rather than holes.
 */
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

// A 1x1 transparent PNG -- enough to be a real, loadable image without
// depending on any generated art being committed.
const FAKE_SPRITE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" +
  "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("Knightrider has no sprite of its own and renders as a rotated Unicode Knight glyph", async ({ page }) => {
  const [white, black] = await page.evaluate(() => [pieceGlyphHtml("Y"), pieceGlyphHtml("y")]);
  expect(white).toContain("<span");
  expect(white).toContain("♘");
  expect(black).toContain("♞");
  expect(white).not.toContain("<img");
});

test("every piece in PIECE_SPRITES is a real sprite, and the rest fall back to glyphs", async ({ page }) => {
  const { spriteLetters, allLetters } = await page.evaluate(() => ({
    spriteLetters: Object.keys(PIECE_SPRITES),
    allLetters: Object.keys(SYMBOLS),
  }));
  // No empty/placeholder entries: a key with nothing behind it would render a
  // broken <img> where a perfectly good glyph used to be.
  for (const letter of spriteLetters) {
    const src = await page.evaluate((l) => PIECE_SPRITES[l], letter);
    expect(src, `sprite for ${letter}`).toMatch(/^data:image\/png;base64,.{100,}/);
  }
  for (const letter of allLetters.filter((l) => !spriteLetters.includes(l))) {
    const html = await page.evaluate((l) => pieceGlyphHtml(l), letter);
    expect(html, `ungenerated ${letter} must stay a glyph`).toContain("<span");
    expect(html, `ungenerated ${letter} must not be an <img>`).not.toContain("<img");
  }
});

test("a generated sprite (b-pawn) is actually wired into the board", async ({ page }) => {
  // The concrete witness that the whole pipeline ran for real: rasterize/
  // hand-author -> PNG -> wire-pieces -> rendered <img>.
  const html = await page.evaluate(() => pieceGlyphHtml("p"));
  expect(html).toContain("<img");
  expect(html).toContain("♟");  // glyph retained as alt text
});

test("a piece with a sprite renders as an <img>, carrying its glyph as alt text", async ({ page }) => {
  const html = await page.evaluate((sprite) => {
    PIECE_SPRITES.K = sprite;
    try { return pieceGlyphHtml("K"); } finally { delete PIECE_SPRITES.K; }
  }, FAKE_SPRITE);

  expect(html).toContain("<img");
  expect(html).toContain('class="piece sprite"');
  expect(html).toContain('data-side="w"');
  expect(html).toContain(FAKE_SPRITE);
  // The sprite is the piece's only on-board identity, so a screen reader or a
  // failed image load must still be able to say which piece this is.
  expect(html).toContain('alt="♔"');
});

test("pieces without a sprite still fall back to glyphs while others use sprites", async ({ page }) => {
  const { king, knightrider } = await page.evaluate((sprite) => {
    PIECE_SPRITES.K = sprite;
    try {
      return { king: pieceGlyphHtml("K"), knightrider: pieceGlyphHtml("Y") };
    } finally { delete PIECE_SPRITES.K; }
  }, FAKE_SPRITE);

  expect(king).toContain("<img");
  expect(knightrider).toContain("<span");
  expect(knightrider).toContain("♘");
});

test("terrain and empty squares stay empty on the sprite path too", async ({ page }) => {
  const results = await page.evaluate((sprite) => {
    PIECE_SPRITES.K = sprite;
    try { return ["", "#", "X"].map((cell) => pieceGlyphHtml(cell)); } finally { delete PIECE_SPRITES.K; }
  }, FAKE_SPRITE);
  for (const html of results) expect(html).toBe("");
});

test("sprites render pixelated and White sprites get a read-on-light-squares outline", async ({ page }) => {
  const style = await page.evaluate(() => {
    const img = document.createElement("img");
    img.className = "piece sprite";
    img.dataset.side = "w";
    document.body.appendChild(img);
    const computed = getComputedStyle(img);
    const result = { rendering: computed.imageRendering, filter: computed.filter };
    img.remove();
    return result;
  });
  // Without this the browser smooths 32px art back up to board size and blurs
  // away exactly the hard pixel edges the art is made of.
  expect(style.rendering).toBe("pixelated");
  // text-shadow (the glyph halo) does nothing to an <img>, so White sprites
  // need the equivalent as a filter or they vanish on light squares -- the
  // exact bug piece-visibility.spec.mjs exists for, on the new render path.
  expect(style.filter).not.toBe("none");
});
