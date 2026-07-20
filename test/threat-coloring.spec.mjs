// Regression for a repeatedly reported feature request (three separate
// tracker entries): legal-move dots should hint at threat level instead of
// always being plain green -- "fire emblem"-style red/orange/green. Purely
// informational (moveDangerLevel never restricts a move, just labels it).
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

async function dangerLevel(page, board, piece, fromX, fromY, toX, toY) {
  return page.evaluate(
    ([board, piece, fromX, fromY, toX, toY]) => moveDangerLevel(board, piece, fromX, fromY, toX, toY),
    [board, piece, fromX, fromY, toX, toY]
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("an undefended destination with no Black attackers is safe", async ({ page }) => {
  const board = emptyBoard();
  board[4][4] = "R";
  const level = await dangerLevel(page, board, "R", 4, 4, 4, 0);
  expect(level).toBe("safe");
});

test("moving into an undefended Black attacker's range hangs", async ({ page }) => {
  const board = emptyBoard();
  board[4][4] = "R";
  board[0][4] = "q"; // Black queen bearing down the file White's rook would enter
  const level = await dangerLevel(page, board, "R", 4, 4, 4, 1);
  expect(level).toBe("hanging");
});

test("moving into a Black attacker's range is covered when White can recapture", async ({ page }) => {
  const board = emptyBoard();
  board[4][4] = "R";
  board[0][4] = "q";
  board[2][4] = "R"; // second White rook backs up the same file
  const level = await dangerLevel(page, board, "R", 4, 4, 4, 1);
  expect(level).toBe("covered");
});

test("renderBoard tags legal-move squares with their computed danger level", async ({ page }) => {
  // Rook at (4,7) with a Black queen bearing straight down its own file at
  // (4,0) -- every square the rook could step to up that file is "hanging".
  await page.goto(GAME_URL + "?fen=4q3-8-8-8-8-8-8-4R3-4K3_w&floor=1&spawned=1&budget=1&maxRank=0");
  await page.evaluate(() => { selected = { x: 4, y: 7 }; renderBoard(); });
  // A mid-file square (4,4) -- not the capture-the-queen square at (4,0),
  // which would come back "safe" since nothing's left to recapture there.
  const level = await page.evaluate(() => boardElement.rows[4].cells[5].getAttribute("data-legal"));
  expect(level).toBe("hanging");
});
