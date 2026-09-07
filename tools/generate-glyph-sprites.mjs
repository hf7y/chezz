// Deterministic 16x16 piece sprites (hf7y/chezz#97, 2026-09-07). No network call. `npm run pieces:generate-16` then `pieces:wire`; neutral piece needs $CHEZZ_NOTO_SYMBOLS2_TTF or skips "e".
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "assets", "pieces");
const SIZE = 16;
const FONT_FAMILY = "DejaVu Sans";
const NEUTRAL_FONT_FAMILY = "ChezzNotoSymbols2";
const NEUTRAL_PIECE_CHAR = "\u{1FA46}";

const FILL = {
  white: [0xf2, 0xf2, 0xf2], // --cream
  black: [0x0a, 0x0a, 0x0a], // --ink
  neutral: [0x8a, 0x8a, 0x8a], // --pink -- "half-white/half-black" per DESIGN-NOTES' own description
};

const NOTO_SYMBOLS2_URL =
  "https://github.com/google/fonts/raw/main/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf";

function fail(message) {
  console.error(`generate-glyph-sprites: ${message}`);
  process.exit(1);
}

const FONT_TASKS = [
  { upper: "K", lower: "k", file: "king", char: "♚" },
  { upper: "Q", lower: "q", file: "queen", char: "♛" },
  { upper: "R", lower: "r", file: "rook", char: "♜" },
  { upper: "B", lower: "b", file: "bishop", char: "♝" },
  { upper: "N", lower: "n", file: "knight", char: "♞" },
  { upper: "P", lower: "p", file: "pawn", char: "♟" },
];
const FAIRY_TASKS = [
  { upper: "A", lower: "a", file: "archbishop", baseChar: "♝" }, // Bishop + knight
  { upper: "C", lower: "c", file: "chancellor", baseChar: "♜" }, // Rook + knight
  { upper: "M", lower: "m", file: "amazon", baseChar: "♛" },     // Queen + knight
];

function addKnightEars(grid) {
  const out = grid.map((row) => [...row]);
  let neckRow = -1, neckWidth = Infinity, neckLeft = 0, neckRight = 0;
  for (let y = 2; y <= 9; y++) {
    const xs = [];
    for (let x = 0; x < SIZE; x++) if (grid[y][x]) xs.push(x);
    if (!xs.length) continue;
    const width = xs[xs.length - 1] - xs[0] + 1;
    if (width < neckWidth) { neckWidth = width; neckRow = y; neckLeft = xs[0]; neckRight = xs[xs.length - 1]; }
  }
  if (neckRow === -1) return out; // no discernible neck -- leave the glyph untouched
  for (const y of [neckRow, neckRow + 1]) {
    if (y >= SIZE) continue;
    for (const x of [neckLeft - 2, neckLeft - 1, neckRight + 1, neckRight + 2]) {
      if (x >= 0 && x < SIZE) out[y][x] = true;
    }
  }
  return out;
}

function resolveNotoBuffer() {
  const override = process.env.CHEZZ_NOTO_SYMBOLS2_TTF;
  if (!override) return null;
  try {
    return readFileSync(override);
  } catch (error) {
    fail(`$CHEZZ_NOTO_SYMBOLS2_TTF is set to "${override}" but couldn't be read: ${error.message}`);
  }
}

async function renderFontGlyphGrid(page, char, fontFamily) {
  return page.evaluate(({ char, fontFamily, size }) => {
    const BIG = 200;
    const big = document.createElement("canvas");
    big.width = big.height = BIG;
    const bctx = big.getContext("2d", { willReadFrequently: true });
    bctx.font = `${Math.round(BIG * 0.8)}px "${fontFamily}"`;
    bctx.textAlign = "center";
    bctx.textBaseline = "middle";
    bctx.fillStyle = "#000";
    bctx.fillText(char, BIG / 2, BIG / 2);

    const { data } = bctx.getImageData(0, 0, BIG, BIG);
    let minX = BIG, minY = BIG, maxX = -1, maxY = -1;
    for (let y = 0; y < BIG; y++) {
      for (let x = 0; x < BIG; x++) {
        if (data[(y * BIG + x) * 4 + 3] < 40) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null; // font doesn't actually carry this glyph
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;

    const FILL_FRACTION = 0.82;
    const scale = Math.min(size / boxW, size / boxH) * FILL_FRACTION;
    const drawW = Math.max(1, Math.round(boxW * scale));
    const drawH = Math.max(1, Math.round(boxH * scale));

    const out = document.createElement("canvas");
    out.width = out.height = size;
    const octx = out.getContext("2d", { willReadFrequently: true });
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(
      big, minX, minY, boxW, boxH,
      Math.floor((size - drawW) / 2), Math.floor((size - drawH) / 2), drawW, drawH,
    );

    const { data: outData } = octx.getImageData(0, 0, size, size);
    const grid = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) row.push(outData[(y * size + x) * 4 + 3] >= 128);
      grid.push(row);
    }
    return grid;
  }, { char, fontFamily, size: SIZE });
}

async function renderGrid(page, grid, fill) {
  return page.evaluate(({ grid, size, fill }) => {
    const out = document.createElement("canvas");
    out.width = out.height = size;
    const ctx = out.getContext("2d");
    const image = ctx.createImageData(size, size);
    const [r, g, b] = fill;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!grid[y][x]) continue;
        const i = (y * size + x) * 4;
        image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return out.toDataURL("image/png");
  }, { grid, size: SIZE, fill });
}

function writePng(file, dataUri) {
  writeFileSync(path.join(OUT_DIR, `${file}.png`), Buffer.from(dataUri.split(",")[1], "base64"));
}

async function main() {
  const requested = new Set(process.argv.slice(2));
  const wantsAll = requested.size === 0;
  const wants = (letter) => wantsAll || requested.has(letter);

  const notoBuffer = resolveNotoBuffer();
  if (wants("e") && !notoBuffer) {
    console.log(
      `generate-glyph-sprites: skipping "e" (neutral) -- no $CHEZZ_NOTO_SYMBOLS2_TTF set.\n` +
      `  Noto Sans Symbols 2 carries U+1FA46 NEUTRAL CHESS KNIGHT; DejaVu Sans (this box's\n` +
      `  default) does not. Get the font and re-run with the env var pointed at it:\n` +
      `    curl -sL -o /tmp/NotoSansSymbols2-Regular.ttf ${NOTO_SYMBOLS2_URL}\n` +
      `    CHEZZ_NOTO_SYMBOLS2_TTF=/tmp/NotoSansSymbols2-Regular.ttf npm run pieces:generate-16 -- e`
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  if (notoBuffer) {
    const base64 = notoBuffer.toString("base64");
    await page.addStyleTag({
      content: `@font-face { font-family: "${NEUTRAL_FONT_FAMILY}"; ` +
        `src: url(data:font/ttf;base64,${base64}) format("truetype"); }`,
    });
    await page.evaluate((family) => document.fonts.load(`16px "${family}"`), NEUTRAL_FONT_FAMILY);
  }

  const written = [];
  try {
    const baseGrids = {}; // char -> grid, so FAIRY_TASKS can reuse a base piece's own render
    for (const { upper, lower, file, char } of FONT_TASKS) {
      const grid = await renderFontGlyphGrid(page, char, FONT_FAMILY);
      if (!grid) fail(`${FONT_FAMILY} has no glyph for U+${char.codePointAt(0).toString(16).toUpperCase()} (${file})`);
      baseGrids[char] = grid;
      if (wants(upper)) { writePng(`w-${file}`, await renderGrid(page, grid, FILL.white)); written.push(`w-${file}`); }
      if (wants(lower)) { writePng(`b-${file}`, await renderGrid(page, grid, FILL.black)); written.push(`b-${file}`); }
    }

    if (wants("e") && notoBuffer) {
      const grid = await renderFontGlyphGrid(page, NEUTRAL_PIECE_CHAR, NEUTRAL_FONT_FAMILY);
      if (!grid) fail(`${NEUTRAL_FONT_FAMILY} has no glyph for U+1FA46 -- wrong font file at $CHEZZ_NOTO_SYMBOLS2_TTF?`);
      writePng("neutral", await renderGrid(page, grid, FILL.neutral));
      written.push("neutral");
    }

    for (const { upper, lower, file, baseChar } of FAIRY_TASKS) {
      const grid = addKnightEars(baseGrids[baseChar]);
      if (wants(upper)) { writePng(`w-${file}`, await renderGrid(page, grid, FILL.white)); written.push(`w-${file}`); }
      if (wants(lower)) { writePng(`b-${file}`, await renderGrid(page, grid, FILL.black)); written.push(`b-${file}`); }
    }
  } finally {
    await browser.close();
  }

  console.log(`generate-glyph-sprites: wrote ${written.length} sprite(s) to assets/pieces/: ${written.join(", ")}`);
  console.log("Run \"npm run pieces:wire\" to bake them into index1.html.");
}

await main();
