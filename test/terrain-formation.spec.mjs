// Coverage for hf7y/chezz#109's port: terrain placement/rendering and
// drag-step/formation-follow, ported from narrative but new to classic and
// untouched by the ai-determinism/move-generation suites above.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test("formationFollow marches a surviving piece onto the King's new rank once no Black pieces remain", async ({ page }) => {
  // King on row 8, a lone Rook on row 8 too -- no Black pieces at all, so
  // any King move should immediately pull the Rook onto the King's rank.
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-8-4K2R_w&floor=1&spawned=1&budget=1&maxRank=0");

  await page.evaluate(() => makeMove(4, 8, 4, 7)); // King steps up one row

  const board = await page.evaluate(() => state.board);
  expect(board[7][4]).toBe("K");
  // The Rook had a legal move onto row 7 (same file range) -- formation-follow
  // should have relocated it there rather than leaving it on row 8.
  expect(board[8].includes("R")).toBe(false);
  expect(board[7].includes("R")).toBe(true);
});

test("dragging the King previews formation-follow with data-formation-preview dots", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-8-4K2R_w&floor=1&spawned=1&budget=1&maxRank=0");

  const previewCount = await page.evaluate(async () => {
    function cellFor(x, y) { return boardElement.rows[y].cells[x + 1]; }
    const from = cellFor(4, 8);
    const r = from.getBoundingClientRect();
    const startX = r.x + r.width / 2, startY = r.y + r.height / 2;
    from.dispatchEvent(new PointerEvent("pointerdown", { clientX: startX, clientY: startY, pointerType: "mouse", bubbles: true }));
    const to = cellFor(4, 7);
    const r2 = to.getBoundingClientRect();
    const endX = r2.x + r2.width / 2, endY = r2.y + r2.height / 2;
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: endX, clientY: endY, pointerType: "mouse", bubbles: true }));
    await new Promise(res => setTimeout(res, 50));
    return document.querySelectorAll("td[data-formation-preview]").length;
  });

  expect(previewCount).toBeGreaterThan(0);
});

test("a drag that overshoots its target square still snaps to the nearest legal move", async ({ page }) => {
  // A Rook on (0,8) with a clean file up to the exit row -- dropping the
  // pointer past the top of the board should still resolve to the
  // farthest legal square along that line, not fail as "no move".
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-8-K6R_w&floor=1&spawned=1&budget=1&maxRank=0");

  const moved = await page.evaluate(async () => {
    function cellFor(x, y) { return boardElement.rows[y].cells[x + 1]; }
    const from = cellFor(7, 8);
    const r = from.getBoundingClientRect();
    from.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: "mouse", bubbles: true }));
    const target = cellFor(7, 0); // the exit row -- overshoot past it
    const rt = target.getBoundingClientRect();
    const overshootY = rt.y - rt.height * 3; // well above the board entirely
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: rt.x + rt.width / 2, clientY: overshootY, pointerType: "mouse", bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { clientX: rt.x + rt.width / 2, clientY: overshootY, pointerType: "mouse", bubbles: true }));
    await new Promise(res => setTimeout(res, 400));
    return state.board[0][7] === "R";
  });

  expect(moved).toBe(true);
});

test("renderBoard tags wall and hole squares with data-terrain, and renders no glyph for either", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-8-4K3_w&floor=1&spawned=1&budget=1&maxRank=0");

  const result = await page.evaluate(() => {
    state.board[3][2] = TERRAIN_WALL;
    state.board[3][5] = TERRAIN_HOLE;
    renderBoard();
    function cellFor(x, y) { return boardElement.rows[y].cells[x + 1]; }
    return {
      wall: cellFor(2, 3).dataset.terrain,
      hole: cellFor(5, 3).dataset.terrain,
      wallGlyph: cellFor(2, 3).textContent.trim(),
      holeGlyph: cellFor(5, 3).textContent.trim(),
    };
  });

  expect(result).toEqual({ wall: "wall", hole: "hole", wallGlyph: "", holeGlyph: "" });
});

test("placeTerrainForFloor only fires every third floor and never overwrites a spawned piece", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(() => {
    const outcomes = [];
    for (let floor = 1; floor <= 9; floor++) {
      state.floor = floor;
      state.dateSeed = "2026-09-06";
      // A sparse board: only a King, so any terrain placement is trivially
      // distinguishable from a piece and can never collide with one.
      state.board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(""));
      state.board[8][4] = "K";
      placeTerrainForFloor();
      const terrainCells = state.board.flat().filter(c => c === TERRAIN_WALL || c === TERRAIN_HOLE);
      outcomes.push({ floor, terrainCount: terrainCells.length, kingIntact: state.board[8][4] === "K" });
    }
    return outcomes;
  });

  for (const { floor, terrainCount, kingIntact } of result) {
    expect(kingIntact).toBe(true);
    if (floor % 3 === 0) expect(terrainCount).toBe(1);
    else expect(terrainCount).toBe(0);
  }
});
