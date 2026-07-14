// Pins getBlackMoveRuthless's output on fixed positions, so a change to the
// search (move ordering, aspiration windows, evaluation weights, tie-break
// seeding) that alters the actual move chosen gets caught immediately,
// whether or not it was intended. Per project convention, this never
// touches wall-clock time -- deadline is generous and depth is fixed by
// floor, so results are machine-speed-independent.
import { test, expect } from "@playwright/test";
import { GAME_URL, fenRowsToBoard } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

async function bestMove(page, fen, captured, floor) {
  return page.evaluate(([board, captured, floor]) => getBlackMoveRuthless(board, captured, floor), [fenRowsToBoard(fen), captured, floor]);
}

test("known-position regression pins", async ({ page }) => {
  // KNOWN BUG (see project memory: pre-existing QxN-over-QxQ bug, predates
  // and is unrelated to move-ordering/aspiration-window work). Black has a
  // choice between capturing a queen or a knight and picks the knight.
  // Pinned as-is on purpose: if this ever starts picking the queen instead,
  // that's the bug getting fixed, not a regression -- update the pin.
  expect(await bestMove(page, "8-2Q5-1N6-q2K1Q2-8-8-8-8-8", "", 5))
    .toEqual({ fromX: 0, fromY: 3, toX: 3, toY: 3, score: 497900 });

  expect(await bestMove(page, "8-r7-8-8-8-8-8-5P2-5K2", "PbP", 4))
    .toEqual({ fromX: 0, fromY: 1, toX: 2, toY: 1, score: -99650 });

  expect(await bestMove(page, "8-8-6p1-6K1-6PP-8-8-8-b7", "", 3))
    .toEqual({ fromX: 0, fromY: 8, toX: 3, toY: 5, score: -100540 });
});

test("no legal Black move returns null instead of throwing", async ({ page }) => {
  expect(await bestMove(page, "8-8-8-8-8-8-8-5PPP-7K", "", 4)).toBeNull();
});

test("same position, captured pool, and floor always picks the same move", async ({ page }) => {
  const fen = "8-2n3bq-p1M1n1pp-5p2-8-2PP4-8-1P6-1MMM1MK1";
  const captured = "NRBQBbBRbQRRbbbbPQPPPRPPPQQPPPPPbNQPPPPPPQPQbPPPPPQPQbPPPQPQbPPnPPPQQnnPPQQPNnPPRRPQPPPPQnnPbQPQPPQPbNnPPQPQPbPnbPnPQQPbPPRPQPQNNPbQnQRQnQQPbQnQQPbNbMbNCQMMnPbPMNnBMnMMPPMmMmmMbMmMmmPbmmMp";
  const first = await bestMove(page, fen, captured, 42);
  const second = await bestMove(page, fen, captured, 42);
  expect(first).toEqual(second);
});
