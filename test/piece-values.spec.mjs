// Pins the search engine's material weights (pieceValues) -- these used to
// live as a const nested inside getBlackMoveRuthless with no test touching
// them at all, so a tracker report ("archbishop is underpriced") had no
// number a regression test could hold the line on, only a comment nobody
// re-checked. Hoisted to a top-level const (index1.html) specifically so
// tests can read it directly, the same way BOARD_COLS already is.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("archbishop is priced above its two components combined (research/balance)", async ({ page }) => {
  // Tracker 2026-07-14T00:23:52: "archbishop is still heavily underpriced
  // for how strong it is on an open board." Fixed same day (`2c36fa3`,
  // 700 -> 780) -- bishop (300) + knight (300) alone sum to 600, so pricing
  // the combination at 780 is the actual fix; pinning it here closes the
  // loop the tracker report was never resolved against.
  const values = await page.evaluate(() => pieceValues);
  expect(values.a).toBe(780);
  expect(values.a).toBeGreaterThan(values.b + values.n);
  // Still below the chancellor (rook+knight, more raw mobility than
  // bishop+knight) -- the comment's own stated reasoning for landing at
  // 780 rather than higher.
  expect(values.a).toBeLessThan(values.c);
});
