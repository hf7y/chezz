// Regression for a repeatedly reported bug: White's hollow-outline Unicode
// glyphs (e.g. King "♔") were nearly invisible against the light half of the
// checkerboard, since they were painted in the same pale --cream as
// everything else and have almost no fill of their own. pieceGlyphHtml now
// tags each glyph with data-side so CSS can give White's hollow glyphs a
// dark halo (see the .piece[data-side="w"] rule) without touching Black's
// already-solid glyphs.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("pieceGlyphHtml tags White pieces with data-side=w and Black with data-side=b", async ({ page }) => {
  const [white, black] = await page.evaluate(() => [pieceGlyphHtml("K"), pieceGlyphHtml("k")]);
  expect(white).toContain('data-side="w"');
  expect(black).toContain('data-side="b"');
});

test("White glyphs get a dark halo so they read against light squares", async ({ page }) => {
  const shadow = await page.evaluate(() => {
    const span = document.createElement("span");
    span.className = "piece";
    span.dataset.side = "w";
    document.body.appendChild(span);
    const style = getComputedStyle(span).textShadow;
    span.remove();
    return style;
  });
  expect(shadow).not.toBe("none");
});

test("Black glyphs are unaffected by the White-only halo rule", async ({ page }) => {
  const shadow = await page.evaluate(() => {
    const span = document.createElement("span");
    span.className = "piece";
    span.dataset.side = "b";
    document.body.appendChild(span);
    const style = getComputedStyle(span).textShadow;
    span.remove();
    return style;
  });
  expect(shadow).toBe("none");
});
