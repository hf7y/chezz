// Pins the actual move rules as an executable spec, rather than diffing
// against a prior implementation -- these should stay true no matter how
// legalMovesForPiece is internally organized.
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

test("rook slides along its rank and file only, full length on an empty board", async ({ page }) => {
  const moves = await movesFor(page, emptyBoard(), "R", 0, 0);
  expect(moves.every(m => m.x === 0 || m.y === 0)).toBe(true);
  expect(moves).toHaveLength(7 + 8); // row 0 minus self (7) + column 0 minus self (8)
});

test("bishop moves are always diagonal", async ({ page }) => {
  const moves = await movesFor(page, emptyBoard(), "B", 4, 4);
  expect(moves.every(m => Math.abs(m.x - 4) === Math.abs(m.y - 4))).toBe(true);
  expect(moves.length).toBeGreaterThan(0);
});

test("knight jumps are all (1,2)/(2,1) shapes", async ({ page }) => {
  const moves = await movesFor(page, emptyBoard(), "N", 4, 4);
  expect(moves.every(m => {
    const dx = Math.abs(m.x - 4), dy = Math.abs(m.y - 4);
    return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  })).toBe(true);
  expect(moves).toHaveLength(8); // fully surrounded by board from the center
});

test("king steps exactly one square in any direction", async ({ page }) => {
  const moves = await movesFor(page, emptyBoard(), "K", 4, 4);
  expect(moves.every(m => Math.max(Math.abs(m.x - 4), Math.abs(m.y - 4)) === 1)).toBe(true);
  expect(moves).toHaveLength(8);
});

test("fairy pieces are exactly the union of their two namesake pieces' moves", async ({ page }) => {
  const board = emptyBoard();
  const [amazon, chancellor, archbishop, queen, rook, bishop, knight] = await Promise.all(
    ["m", "c", "a", "q", "r", "b", "n"].map(p => movesFor(page, board, p, 4, 4))
  );
  const key = m => `${m.x},${m.y}`;
  const asSet = arr => new Set(arr.map(key));

  expect(asSet(amazon)).toEqual(new Set([...queen, ...knight].map(key)));
  expect(asSet(chancellor)).toEqual(new Set([...rook, ...knight].map(key)));
  expect(asSet(archbishop)).toEqual(new Set([...bishop, ...knight].map(key)));
});

test("a slide stops at the first enemy (captures it) and never passes a friendly", async ({ page }) => {
  const board = emptyBoard();
  board[4][6] = "p"; // enemy two squares to the right of the rook
  board[4][1] = "R"; // friendly to the left
  const moves = await movesFor(page, board, "R", 4, 4);
  const rightward = moves.filter(m => m.y === 4 && m.x > 4);
  expect(rightward).toEqual([{ x: 5, y: 4 }, { x: 6, y: 4 }]); // reaches and includes the capture, no further
  const leftward = moves.filter(m => m.y === 4 && m.x < 4);
  expect(leftward).toEqual([{ x: 3, y: 4 }, { x: 2, y: 4 }]); // stops one short of the friendly at x=1
});

test("black pieces may never move onto the exit row (row 0)", async ({ page }) => {
  const board = emptyBoard();
  const moves = await movesFor(page, board, "r", 4, 2); // black rook, two rows from the exit
  expect(moves.some(m => m.y === 0)).toBe(false);
  // the equivalent white rook is not under this restriction
  const whiteMoves = await movesFor(page, board, "R", 4, 2);
  expect(whiteMoves.some(m => m.y === 0)).toBe(true);
});

test("pawn: double-move only from its start row, single move otherwise, diagonal capture requires an enemy", async ({ page }) => {
  const boardAtStart = emptyBoard();
  const fromStart = await movesFor(page, boardAtStart, "P", 4, 7); // White's start row
  expect(fromStart).toEqual(expect.arrayContaining([{ x: 4, y: 6 }, { x: 4, y: 5 }]));
  expect(fromStart).toHaveLength(2);

  const fromMiddle = await movesFor(page, boardAtStart, "P", 4, 5);
  expect(fromMiddle).toEqual([{ x: 4, y: 4 }]);

  const boardWithTarget = emptyBoard();
  boardWithTarget[4][5] = "p"; // enemy pawn diagonally ahead
  const withCapture = await movesFor(page, boardWithTarget, "P", 4, 5);
  expect(withCapture).toEqual(expect.arrayContaining([{ x: 4, y: 4 }, { x: 5, y: 4 }]));
  expect(withCapture).toHaveLength(2);
});
