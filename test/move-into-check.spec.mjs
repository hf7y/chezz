// Move-into-check legality (human call, 2026-07-20, see .claude/QUESTIONS.md
// and the "PRIORITY QUEUE" note in .claude/FOCUS.md): a White move that
// leaves the King capturable next turn is now illegal -- King-only, other
// pieces stay hangable on purpose (unchanged risk/reward). Several tracker
// reports asked for this independently (2026-07-15T18:17:33.709Z,
// 2026-07-17T05:18:31.007Z).
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("King can't step onto a square still covered by a Black attacker", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[0][4] = "r"; // black rook covers the whole 4th file, including (4,7) and (4,8)

  const { canStayOnFile, canStepOffFile } = await page.evaluate(b => ({
    canStayOnFile: isLegalMove(b, 4, 8, 4, 7),   // stays on the attacked file -- still hangs
    canStepOffFile: isLegalMove(b, 4, 8, 3, 7),  // steps off the file -- safe
  }), board);

  expect(canStayOnFile).toBe(false);
  expect(canStepOffFile).toBe(true);
});

test("a pin: moving the blocker off-file is illegal, but capturing the pinning attacker is legal", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[7][4] = "R"; // White rook, currently shielding the King on file 4
  board[0][4] = "r"; // Black rook pinning down the same file

  const moves = await page.evaluate(b => legalMovesFrom(b, 4, 7), board);

  // Sliding sideways off file 4 would expose the King -- must not appear.
  expect(moves.some(m => m.x !== 4)).toBe(false);
  // Capturing the pinning rook removes the threat, so that specific move
  // (still on file 4) stays legal.
  expect(moves.some(m => m.x === 4 && m.y === 0)).toBe(true);
});

test("non-King pieces stay hangable -- moving a pawn into an attacked square is still legal", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[3][3] = "P";
  board[0][3] = "q"; // black queen bears down the file the pawn would advance into

  const legal = await page.evaluate(b => isLegalMove(b, 3, 3, 3, 2), board);
  expect(legal).toBe(true); // hangs the pawn for free, but that's unchanged, allowed risk/reward
});

// King parked at (0,8) rather than row 0 -- row 0 is EXIT_ROW, which Black
// may never move onto (see legalMovesForPiece's own filter), so a King
// already there can never actually be attacked. That's the real "reach the
// exit row" win condition working as intended, not a hole in this rule --
// this test needs a corner Black *can* reach to exercise the deadlock.
test("hasAnyLegalMove(true) is false when every one of the King's pseudo-legal moves hangs it", async ({ page }) => {
  const board = emptyBoard();
  board[8][0] = "K";
  board[3][1] = "r"; // covers file 1: attacks (1,7) and (1,8)
  board[7][4] = "r"; // covers rank 7: attacks (0,7) and (1,7)

  const { pseudoLegalCount, hasReal } = await page.evaluate(b => ({
    pseudoLegalCount: legalMovesForPiece(b, "K", 0, 8).length,
    hasReal: hasAnyLegalMove(b, true),
  }), board);

  expect(pseudoLegalCount).toBeGreaterThan(0); // (1,8), (0,7), (1,7) all pseudo-legal
  expect(hasReal).toBe(false);                 // but every single one hangs the King
});

test("that zero-real-move King deadlock routes through the existing stalemate reset, not a stranded board", async ({ page }) => {
  const result = await page.evaluate(() => {
    const boxedButPseudoMobile = Array.from({ length: 9 }, () => Array(8).fill(""));
    boxedButPseudoMobile[8][0] = "K";
    boxedButPseudoMobile[3][1] = "r";
    boxedButPseudoMobile[7][4] = "r";

    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.floor = 2;
    state.spawned = false;
    state.lastSpawnBudget = 0;
    state.captured = "";
    spawnBlackArmy();

    state.board = boxedButPseudoMobile;
    state.turn = "w";
    checkStalemate();

    return { floor: state.floor, hasMoveAfter: hasAnyLegalMove(state.board, true) };
  });

  expect(result.floor).toBe(2);          // same floor, reset in place
  expect(result.hasMoveAfter).toBe(true); // the fresh floor is actually playable
});
