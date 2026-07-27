/* Covers tools/sprite-postprocess.js -- the half of the Gemini sprite pipeline
 * that is pure image work and therefore testable without spending an API call.
 *
 * The generator's own network call is NOT exercised here (it costs money and is
 * non-deterministic). What these tests pin is everything downstream of it: given
 * a synthetic "generated image" of the exact shape Gemini is asked to return
 * (art on a magenta chroma-key field), the sprite that comes out is square,
 * cropped to content, fully palette-conformant, and has a hard alpha edge with
 * no magenta fringe. Those are the properties index1.html actually depends on.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POSTPROCESS = path.join(ROOT, "tools", "sprite-postprocess.js");

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({ path: POSTPROCESS });
});

/* Builds a stand-in for a Gemini return: a `width`x`height` magenta canvas with
 * a grey rectangle at `rect`. Deliberately NOT edge-to-edge -- the padding is
 * what exercises the content-crop, which is the step that makes every piece in
 * the set occupy its cell consistently. */
async function syntheticGeneration(page, { width = 400, height = 400, rect, fill = "#909090" }) {
  return page.evaluate(({ width, height, rect, fill }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    return canvas.toDataURL("image/png");
  }, { width, height, rect, fill });
}

// Decodes a produced sprite back to raw pixels so assertions read against what
// the browser will actually paint, not against the data URI string.
async function pixelsOf(page, dataUri) {
  return page.evaluate(async (uri) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = uri;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
    };
  }, dataUri);
}

test("produces a square sprite at the requested size", async ({ page }) => {
  const source = await syntheticGeneration(page, { rect: { x: 100, y: 50, width: 120, height: 260 } });
  const sprite = await page.evaluate((uri) => window.postprocessSprite(uri), source);
  const { width, height } = await pixelsOf(page, sprite);
  expect(width).toBe(32);
  expect(height).toBe(32);
});

test("magenta background becomes fully transparent -- no colored fringe survives", async ({ page }) => {
  const source = await syntheticGeneration(page, { rect: { x: 100, y: 50, width: 120, height: 260 } });
  const sprite = await page.evaluate((uri) => window.postprocessSprite(uri), source);
  const { data } = await pixelsOf(page, sprite);

  // The failure this guards against is a half-transparent magenta rim left by
  // the downsample blending the piece edge into the key color -- which would
  // read as a pink halo around every piece, in a game whose palette is
  // explicitly monochrome by human decision.
  for (let i = 0; i < data.length; i += 4) {
    expect(data[i + 3] === 0 || data[i + 3] === 255).toBe(true);
    if (data[i + 3] === 0) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBe(0); // opaque pixels are true grey
  }
});

test("every opaque pixel snaps to the game's monochrome ramp", async ({ page }) => {
  // A gradient-ish mid tone that matches NO palette entry exactly, so passing
  // this means the snap really ran rather than the input happening to be legal.
  const source = await syntheticGeneration(page, {
    rect: { x: 80, y: 80, width: 200, height: 200 },
    fill: "#7b7b7b",
  });
  const sprite = await page.evaluate((uri) => window.postprocessSprite(uri), source);
  const { data } = await pixelsOf(page, sprite);
  const palette = await page.evaluate(() => window.SPRITE_PALETTE);

  const seen = new Set();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    seen.add(data[i]);
  }
  expect(seen.size).toBeGreaterThan(0);
  for (const value of seen) expect(palette).toContain(value);
});

test("content is cropped out of its padding and centered, preserving aspect ratio", async ({ page }) => {
  // A 2:1 tall rectangle floating in the corner of a big frame. Correct output:
  // 32 tall, 16 wide, horizontally centered -- NOT stretched to fill the square,
  // which would make a squat pawn and a tall king the same silhouette.
  const source = await syntheticGeneration(page, { rect: { x: 20, y: 30, width: 100, height: 200 } });
  const sprite = await page.evaluate((uri) => window.postprocessSprite(uri), source);
  const { width, data } = await pixelsOf(page, sprite);

  const opaqueColumns = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < 32; y++) {
      if (data[(y * width + x) * 4 + 3] === 255) { opaqueColumns.push(x); break; }
    }
  }
  const spread = opaqueColumns[opaqueColumns.length - 1] - opaqueColumns[0] + 1;
  expect(spread).toBeGreaterThanOrEqual(14); // ~16 wide for a 2:1 piece in a 32px box
  expect(spread).toBeLessThanOrEqual(18);

  // Rows, by contrast, should span essentially the full height -- that's the
  // dimension the fit-scale maxed out.
  const opaqueRows = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 255) { opaqueRows.push(y); break; }
    }
  }
  expect(opaqueRows[opaqueRows.length - 1] - opaqueRows[0] + 1).toBeGreaterThanOrEqual(30);
});

test("an all-background generation fails loud rather than writing an empty sprite", async ({ page }) => {
  const blank = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL("image/png");
  });
  const error = await page.evaluate(
    (uri) => window.postprocessSprite(uri).then(() => null, (e) => e.message),
    blank,
  );
  expect(error).toContain("entirely background");
});
