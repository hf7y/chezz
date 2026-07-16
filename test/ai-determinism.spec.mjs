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

// The transposition table intentionally persists across calls within a
// floor (cleared in newFloor()) -- a warm cache makes a repeat call faster,
// which can let iterative deepening reach one more ply within the same
// wall-clock deadline than a cold call did. Clearing it before each call
// here mirrors what actually matters -- replaying the same saved/shared
// URL is deterministic, and a fresh page load always starts with an empty
// table -- rather than "calling the function twice in the same live
// session," which the cache is now deliberately allowed to make faster.
async function coldBestMove(page, fen, captured, floor) {
  return page.evaluate(([board, captured, floor]) => { transTable.clear(); return getBlackMoveRuthless(board, captured, floor); }, [fenRowsToBoard(fen), captured, floor]);
}

test("known-position regression pins", async ({ page }) => {
  // Sanity pin, not actually a "known bug" despite older comments/memory
  // calling this position "QxN over QxQ" -- traced by hand and confirmed
  // with a probe: Black's queen at (0,3) captures the undefended White
  // King directly at (3,3). Neither White queen is even reachable in this
  // position (one diagonal is blocked by the White knight, the other file
  // is blocked by the King itself), so there was never a knight-vs-queen
  // choice here. Capturing an undefended King outright is obviously
  // correct, not a bug -- this pin just locks in that (correct) choice.
  expect(await coldBestMove(page, "8-2Q5-1N6-q2K1Q2-8-8-8-8-8", "", 5))
    .toEqual({ piece: "q", fromX: 0, fromY: 3, toX: 3, toY: 3, score: 497900 });

  expect(await coldBestMove(page, "8-r7-8-8-8-8-8-5P2-5K2", "PbP", 4))
    .toEqual({ piece: "r", fromX: 0, fromY: 1, toX: 2, toY: 1, score: -99650 });

  expect(await coldBestMove(page, "8-8-6p1-6K1-6PP-8-8-8-b7", "", 3))
    .toEqual({ piece: "b", fromX: 0, fromY: 8, toX: 3, toY: 5, score: -100540 });
});

test("no legal Black move returns null instead of throwing", async ({ page }) => {
  expect(await bestMove(page, "8-8-8-8-8-8-8-5PPP-7K", "", 4)).toBeNull();
});

test("same position, captured pool, and floor always picks the same move", async ({ page }) => {
  const fen = "8-2n3bq-p1M1n1pp-5p2-8-2PP4-8-1P6-1MMM1MK1";
  const captured = "NRBQBbBRbQRRbbbbPQPPPRPPPQQPPPPPbNQPPPPPPQPQbPPPPPQPQbPPPQPQbPPnPPPQQnnPPQQPNnPPRRPQPPPPQnnPbQPQPPQPbNnPPQPQPbPnbPnPQQPbPPRPQPQNNPbQnQRQnQQPbQnQQPbNbMbNCQMMnPbPMNnBMnMMPPMmMmmMbMmMmmPbmmMp";
  const first = await coldBestMove(page, fen, captured, 42);
  const second = await coldBestMove(page, fen, captured, 42);
  expect(first).toEqual(second);
});
