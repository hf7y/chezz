// A White piece on the exit row is committed to carry-over (tracker
// 2026-07-13T23:35:42.300Z): it can never move again. Black already can't
// enter the exit row, so before this rule the row doubled as an
// invulnerable safe harbor a piece could visit and leave freely.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

async function movesFor(page, board, piece, x, y) {
  return page.evaluate(([board, piece, x, y]) => legalMovesForPiece(board, piece, x, y), [board, piece, x, y]);
}

test("a White piece on the exit row has no legal moves", async ({ page }) => {
  for (const piece of ["Q", "R", "B", "N", "P", "M", "C", "A"]) {
    const board = emptyBoard();
    board[0][3] = piece;
    board[8][4] = "K";
    expect(await movesFor(page, board, piece, 3, 0), `${piece} should be frozen on the exit row`).toEqual([]);
  }
});

test("the same piece one row below the exit row still moves, including onto the exit row", async ({ page }) => {
  const board = emptyBoard();
  board[1][3] = "Q";
  board[8][4] = "K";
  const moves = await movesFor(page, board, "Q", 3, 1);
  expect(moves.length).toBeGreaterThan(0);
  expect(moves.some(m => m.y === 0)).toBe(true);
});

test("Black pieces are unaffected by the commit rule (still just barred from entering)", async ({ page }) => {
  const board = emptyBoard();
  board[1][3] = "q";
  board[8][4] = "K";
  const moves = await movesFor(page, board, "q", 3, 1);
  expect(moves.length).toBeGreaterThan(0);
  expect(moves.every(m => m.y !== 0)).toBe(true);
});

test("committed pieces don't strand the player: stalemate detection still sees the King's moves", async ({ page }) => {
  // Everything except the King parked on the exit row; the King alone in
  // open space must still count as having a legal move.
  const hasMove = await page.evaluate(() => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[0][0] = "Q"; board[0][2] = "R"; board[0][4] = "N";
    board[8][4] = "K";
    return hasAnyLegalMove(board, true);
  });
  expect(hasMove).toBe(true);
});
