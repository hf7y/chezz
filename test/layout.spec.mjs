// Regression test for a real bug: td/th used `vertical-align: baseline`,
// which aligns cells to a row baseline derived from each cell's own font
// metrics. The rank-number <th> (plain text) and a piece glyph (a different
// font-family, especially once a fairy piece's webfont is loaded) have
// different metrics, so the rank number visibly shifted whenever a
// neighboring square gained or lost a piece. Fixed by switching td/th to
// `vertical-align: middle`, which centers by box geometry instead.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-7K_w&floor=1&spawned=1&budget=1&maxRank=0");
});

async function measureRow(page, rowIndex) {
  return page.evaluate(row => {
    const tr = document.querySelectorAll("table tr")[row];
    const th = tr.querySelector("th");
    const thRect = th.getBoundingClientRect();
    const trRect = tr.getBoundingClientRect();
    const pieceCenters = [...tr.querySelectorAll(".piece")].map(el => {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    });
    return { thCenterY: (thRect.top + thRect.bottom) / 2, rowHeight: trRect.height, pieceCenters };
  }, rowIndex);
}

test("rank number stays put and the row doesn't grow when a piece enters an empty square", async ({ page }) => {
  const before = await measureRow(page, 4);
  expect(before.pieceCenters).toHaveLength(0);

  await page.evaluate(() => { state.board[4][3] = "Q"; renderBoard(); });
  const after = await measureRow(page, 4);

  expect(after.rowHeight).toBe(before.rowHeight);
  expect(after.thCenterY).toBe(before.thCenterY);
  // the piece itself is centered in its square, matching the rank number's center
  expect(after.pieceCenters[0]).toBeCloseTo(after.thCenterY, 0);
});

test("rank number doesn't shift even when the piece renders in a mismatched font", async ({ page }) => {
  // Simulates the real-world case this bug actually showed up in: a fairy
  // piece rendered via the Noto Sans Symbols 2 webfont, whose metrics differ
  // from the plain rank-number text. Can't rely on that webfont actually
  // downloading in a sandboxed/offline test run, so a locally-installed font
  // with clearly different vertical metrics stands in for it here.
  await page.addStyleTag({ content: '.piece { font-family: "DejaVu Serif" !important; }' });
  const before = await measureRow(page, 4);

  await page.evaluate(() => { state.board[4][3] = "Q"; renderBoard(); });
  const after = await measureRow(page, 4);

  expect(after.rowHeight).toBe(before.rowHeight);
  expect(after.thCenterY).toBe(before.thCenterY);
  expect(after.pieceCenters[0]).toBeCloseTo(after.thCenterY, 0);
});

test("multiple different fonts in the same row still align to the same center", async ({ page }) => {
  await page.addStyleTag({
    content: 'td:nth-child(2) .piece { font-family: "DejaVu Serif" !important; } '
      + 'td:nth-child(3) .piece { font-family: monospace !important; }',
  });
  await page.evaluate(() => {
    state.board[4][0] = "M"; state.board[4][1] = "q"; state.board[4][2] = "a";
    renderBoard();
  });
  const { thCenterY, pieceCenters } = await measureRow(page, 4);
  for (const center of pieceCenters) expect(center).toBeCloseTo(thCenterY, 0);
});
