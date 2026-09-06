// Knightrider (DESIGN-NOTES.md seed list, spec'd in hf7y/chezz#102, built
// for #111): repeats a knight-leap vector in a straight line via slide()
// rather than a single jump -- the spec's own point was that this needs no
// new generator, just a PIECE_MOVE_SPEC entry pointing slide() at
// KNIGHT_JUMPS instead of a rook/bishop direction. The spec explicitly
// flagged "should work" per code reading and "confirmed by a test" as
// different claims -- this file is the second one.
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

test("Knightrider repeats a knight-leap vector in a straight line, not just one jump", async ({ page }) => {
  const moves = await movesFor(page, emptyBoard(), "y", 1, 8);
  const targets = new Set(moves.map(m => `${m.x},${m.y}`));
  // Repeating (2,-1) from (1,8): (3,7), (5,6), (7,5) all fit on the 8x9 board.
  expect(targets.has("3,7")).toBe(true);
  expect(targets.has("5,6")).toBe(true); // a second repeat -- a plain knight could never reach this in one move
  expect(targets.has("7,5")).toBe(true); // a third repeat, right up to the board edge
});

test("a Knightrider's slide stops at the first enemy (captures it) and never passes it", async ({ page }) => {
  const board = emptyBoard();
  board[8][1] = "y"; // Black knightrider
  board[6][5] = "N"; // White knight, enemy, at the second repeat of (2,-1)
  const moves = await movesFor(page, board, "y", 1, 8);
  const targets = new Set(moves.map(m => `${m.x},${m.y}`));
  expect(targets.has("3,7")).toBe(true);  // reaches up to the enemy
  expect(targets.has("5,6")).toBe(true);  // captures it
  expect(targets.has("7,5")).toBe(false); // but can't slide past it
});

test("a Knightrider's slide stops BEFORE a friendly piece and never lands on it", async ({ page }) => {
  const board = emptyBoard();
  board[8][1] = "y"; // Black knightrider
  board[6][5] = "n"; // Black knight, friendly, at the second repeat
  const moves = await movesFor(page, board, "y", 1, 8);
  const targets = new Set(moves.map(m => `${m.x},${m.y}`));
  expect(targets.has("3,7")).toBe(true);  // one repeat still legal
  expect(targets.has("5,6")).toBe(false); // can't land on the friendly
  expect(targets.has("7,5")).toBe(false); // and can't slide past it either
});

test("Knightrider has no orthogonal or diagonal component, unlike the compound fairy pieces", async ({ page }) => {
  const board = emptyBoard();
  const [knightrider, rook, bishop] = await Promise.all(
    ["y", "r", "b"].map(p => movesFor(page, board, p, 4, 4))
  );
  const key = m => `${m.x},${m.y}`;
  const rookSquares = new Set(rook.map(key));
  const bishopSquares = new Set(bishop.map(key));
  expect(knightrider.some(m => rookSquares.has(key(m)))).toBe(false);
  expect(knightrider.some(m => bishopSquares.has(key(m)))).toBe(false);
});

test("pieceValues prices Knightrider between a rook and the knight-combined fairy pieces (first estimate, see comment)", async ({ page }) => {
  const values = await page.evaluate(() => pieceValues);
  expect(values.y).toBeGreaterThan(values.r);
  expect(values.y).toBeLessThan(values.a);
  expect(values.Y).toBe(-values.y); // White/Black symmetry, same convention as every other piece
});
