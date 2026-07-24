// Terrain (priority queue item 4, DESIGN-NOTES.md "Terrain: walls +
// holes"): impassable squares. A hole (TERRAIN_HOLE) is permanent; a wall
// (TERRAIN_WALL) is boss-gated and drops once its scripted stage's boss
// piece is captured (see dropWallIfBossDefeated, wired into makeMove).
// Both are authored directly into NARRATIVE_STAGES row FEN strings.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("a slide stops before a terrain square and never lands on or captures it", async ({ page }) => {
  const board = emptyBoard();
  board[4][4] = "R"; // White rook
  board[4][6] = "X"; // hole two squares to the right, same rank

  const moves = await page.evaluate(b => legalMovesForPiece(b, "R", 4, 4), board);
  const targets = moves.map(m => `${m.x},${m.y}`);

  expect(targets).toContain("5,4"); // can slide up to just before the hole
  expect(targets).not.toContain("6,4"); // can't land on the hole
  expect(targets).not.toContain("7,4"); // can't slide through it either
});

test("a King can't step onto a wall or hole square", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[7][4] = "#";
  board[7][3] = "X";

  const moves = await page.evaluate(b => legalMovesForPiece(b, "K", 4, 8), board);
  const targets = moves.map(m => `${m.x},${m.y}`);

  expect(targets).not.toContain("4,7");
  expect(targets).not.toContain("3,7");
  expect(targets).toContain("5,7"); // an ordinary empty neighbor stays legal
});

test("terrain is never treated as a Black attacker or a capturable enemy", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[4][4] = "#"; // sits on the King's own file, well out of step range

  const attackers = await page.evaluate(b => attackersOf(b, 4, 8, false), board);
  expect(attackers).toEqual([]);
});

test("a board round-trips through FEN with terrain squares intact", async ({ page }) => {
  const board = emptyBoard();
  board[6][2] = "X";
  board[6][5] = "#";
  board[8][4] = "K";

  const roundTripped = await page.evaluate(b => {
    state.board = b;
    const fen = boardToFen();
    loadFen(fen + "_w");
    return state.board;
  }, board);

  expect(roundTripped[6][2]).toBe("X");
  expect(roundTripped[6][5]).toBe("#");
  expect(roundTripped[8][4]).toBe("K");
});

test("The Knight stage's wall blocks the gap-free columns and drops once the Knight is captured", async ({ page }) => {
  const stage = await page.evaluate(() => NARRATIVE_STAGES.find(s => s.label === "The Knight"));
  expect(stage.wallRow).toBeTruthy();
  expect(stage.bossPiece).toBe("n");

  const result = await page.evaluate(() => {
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.floor = NARRATIVE_STAGES.findIndex(s => s.label === "The Knight") + 1;
    state.lastSpawnBudget = 0;
    spawnBlackArmy();

    const wallRow = NARRATIVE_STAGES[state.floor - 1].wallRow;
    const beforeCells = [...state.board[wallRow]];
    const beforeHasGap = beforeCells.some(c => c === "");
    const beforeHasWall = beforeCells.some(c => c === "#");

    // Simulate the Knight's capture directly (bypassing move legality/AI
    // reply, which aren't this test's concern) to isolate the wall-drop rule.
    for (let y = 0; y < state.board.length; y++) {
      const x = state.board[y].indexOf("n");
      if (x !== -1) { state.captured += "n"; state.board[y][x] = ""; break; }
    }
    dropWallIfBossDefeated();
    const afterCells = [...state.board[wallRow]];

    return { beforeHasGap, beforeHasWall, afterAllOpen: afterCells.every(c => c === "") };
  });

  expect(result.beforeHasWall).toBe(true);
  expect(result.beforeHasGap).toBe(true); // never a full-width, unpassable block
  expect(result.afterAllOpen).toBe(true);
});
