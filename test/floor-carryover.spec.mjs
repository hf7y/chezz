// newFloor() builds the next floor's back two ranks from whatever White
// material survived the floor just cleared. It used to read only the exit
// row (row 0) -- anything that hadn't caught up to the King there yet was
// silently dropped instead of carrying over (hf7y/chezz#117, #119): a
// straggler pawn behind the King when the floor cleared just vanished.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

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
