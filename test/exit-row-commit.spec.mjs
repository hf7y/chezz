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

// newFloor() builds the next floor's back two ranks from whatever White
// material survived the floor just cleared. It used to read only the exit
// row (row 0) -- anything that hadn't caught up to the King there yet was
// silently dropped instead of carrying over (hf7y/chezz#117, #119): a
// straggler pawn behind the King when the floor cleared just vanished.
async function runNewFloor(page, board, captured) {
  return page.evaluate(([board, captured]) => {
    state.board = board;
    state.captured = captured;
    state.floor = 1;
    state.turn = "w";
    state.spawned = false;
    state.lastSpawnBudget = 0;
    state.diedOnce = true; // skip the scripted campaign, use procedural spawn
    newFloor();
    return { board: state.board, floor: state.floor, captured: state.captured };
  }, [board, captured]);
}

test("a straggler pawn not yet on the exit row still carries over", async ({ page }) => {
  const board = emptyBoard();
  board[0][4] = "K"; // King already reached the exit row
  board[5][2] = "P"; // pawn several rows behind, mid-board
  const result = await runNewFloor(page, board, "");

  const survivorRows = result.board.slice(6); // rank2 (row 7), rank1 (row 8)
  const flatSurvivors = survivorRows.flat();
  expect(flatSurvivors.filter(c => c === "P").length).toBe(1);
  expect(flatSurvivors.includes("K")).toBe(true);
  expect(result.floor).toBe(2);
});

test("a straggler piece behind the King, not just a pawn, still carries over", async ({ page }) => {
  const board = emptyBoard();
  board[0][4] = "K";
  board[3][1] = "R"; // rook lagging well behind the King
  const result = await runNewFloor(page, board, "");

  const survivorRows = result.board.slice(6);
  expect(survivorRows.flat().filter(c => c === "R").length).toBe(1);
});

test("a survivor already on the exit row keeps its existing carry-over shape", async ({ page }) => {
  const board = emptyBoard();
  board[0][4] = "K";
  board[0][2] = "P"; // pawn already at the exit row alongside the King
  const result = await runNewFloor(page, board, "");

  expect(result.board[7][2]).toBe("P"); // pawn advances onto rank2
  expect(result.board[8][2]).toBe(""); // leaving its own file on rank1 empty
  expect(result.board[8][4]).toBe("K"); // King resets to the new back rank
});

test("a surviving non-pawn piece gets a free escort pawn from the captured pool", async ({ page }) => {
  const board = emptyBoard();
  board[0][4] = "K";
  board[0][1] = "N"; // a surviving knight, no pawn of its own
  const result = await runNewFloor(page, board, "p"); // one captured pawn banked

  expect(result.board[8][1]).toBe("N");
  expect(result.board[7][1]).toBe("P"); // escorted by the banked pawn
  expect(result.captured).toBe(""); // spent from the pool
});

test("two survivors sharing a file both carry over instead of one clobbering the other", async ({ page }) => {
  const board = emptyBoard();
  board[0][4] = "K";
  board[2][3] = "B"; // straggler bishop
  board[6][3] = "N"; // straggler knight, same file as the bishop
  const result = await runNewFloor(page, board, "");

  const survivorRows = result.board.slice(6);
  const flat = survivorRows.flat();
  expect(flat.filter(c => c === "B").length).toBe(1);
  expect(flat.filter(c => c === "N").length).toBe(1);
});
