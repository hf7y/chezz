// Pins getBlackMoveRuthless's output on fixed positions, so a change to the
// search (move ordering, aspiration windows, evaluation weights, tie-break
// seeding) that alters the actual move chosen gets caught immediately,
// whether or not it was intended. Per project convention, this never
// touches wall-clock time -- deadline is generous and depth is fixed by
// floor, so results are machine-speed-independent.
//
// Since hf7y/chezz#3, the pinned object also carries `hint` -- the White
// move-hint harvested from the same search pass (searchWithHint, index1.html)
// -- so a change to what counts as an "exact" node or a legal-for-the-player
// move gets caught here too, same as any other search-behavior change.
import { test, expect } from "@playwright/test";
import { GAME_URL, fenRowsToBoard } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

async function bestMove(page, fen, captured, floor) {
  return page.evaluate(([board, captured, floor]) => getBlackMoveRuthless(board, captured, floor), [fenRowsToBoard(fen), captured, floor]);
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
  expect(await bestMove(page, "8-2Q5-1N6-q2K1Q2-8-8-8-8-8", "", 5))
    .toEqual({ piece: "q", fromX: 0, fromY: 3, toX: 3, toY: 3, score: 497900,
      hint: { fromX: 1, fromY: 2, toX: 3, toY: 3 } });

  expect(await bestMove(page, "8-r7-8-8-8-8-8-5P2-5K2", "PbP", 4))
    .toEqual({ piece: "r", fromX: 0, fromY: 1, toX: 2, toY: 1, score: -99655,
      hint: { fromX: 5, fromY: 8, toX: 6, toY: 7 } });

  expect(await bestMove(page, "8-8-6p1-6K1-6PP-8-8-8-b7", "", 3))
    .toEqual({ piece: "b", fromX: 0, fromY: 8, toX: 3, toY: 5, score: -100540,
      hint: { fromX: 6, fromY: 3, toX: 7, toY: 2 } });
});

test("king safety is attack-based, not just King-progress (priority queue item 5)", async ({ page }) => {
  // Same King square (same kingProgress) in both positions -- only whether
  // a Black rook actually attacks that square differs. Depth 1 so the
  // score returned is (close to) the static eval of the position handed
  // in, isolating evaluateBoard's kingAttackers term rather than search
  // dynamics. Before that term existed, an exposed vs. shielded King at
  // the same square scored identically; now the exposed one must score
  // worse for White (more negative -- evaluateBoard favors Black).
  const exposed = "8-8-8-8-8-3K4-8-8-r7"; // rook shares King's file, nothing blocks it
  const shielded = "8-8-8-8-8-3K4-3p4-8-r7"; // same rook, but a black pawn blocks the file

  const exposedMove = await bestMove(page, exposed, "", 1);
  const shieldedMove = await bestMove(page, shielded, "", 1);

  expect(exposedMove.score).toBeLessThan(shieldedMove.score);
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
