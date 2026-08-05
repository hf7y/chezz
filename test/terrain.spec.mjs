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

test("Two Bishops' wall stays up until BOTH bishops are captured, not just one", async ({ page }) => {
  const stage = await page.evaluate(() => NARRATIVE_STAGES.find(s => s.label === "Two Bishops"));
  expect(stage.wallRow).toBeTruthy();
  expect(stage.bossPiece).toBe("b");

  const result = await page.evaluate(() => {
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.floor = NARRATIVE_STAGES.findIndex(s => s.label === "Two Bishops") + 1;
    state.lastSpawnBudget = 0;
    spawnBlackArmy();

    const wallRow = NARRATIVE_STAGES[state.floor - 1].wallRow;
    const beforeHasWall = state.board[wallRow].some(c => c === "#");

    // Capture only the first bishop found -- the wall must stay up.
    for (let y = 0; y < state.board.length; y++) {
      const bx = state.board[y].indexOf("b");
      if (bx !== -1) { state.board[y][bx] = ""; break; }
    }
    dropWallIfBossDefeated();
    const afterOneStillWall = state.board[wallRow].some(c => c === "#");

    // Now capture the second (and last) bishop -- the wall should drop.
    for (let y = 0; y < state.board.length; y++) {
      const bx = state.board[y].indexOf("b");
      if (bx !== -1) { state.board[y][bx] = ""; break; }
    }
    dropWallIfBossDefeated();
    const afterBothAllOpen = state.board[wallRow].every(c => c === "");

    return { beforeHasWall, afterOneStillWall, afterBothAllOpen };
  });

  expect(result.beforeHasWall).toBe(true);
  expect(result.afterOneStillWall).toBe(true);
  expect(result.afterBothAllOpen).toBe(true);
});

test("terrain actually PAINTS differently from an empty square, on both checkerboard colors", async ({ page }) => {
  // Tracker 2026-07-28T14:47:56: "white pawns on f and g are blocked. is this
  // a failed rendering of the wall tile or genuine unable to move?" -- it was
  // both. The rules above all passed while every wall and hole rendered as an
  // ordinary empty square, because the checkerboard selector
  // (`tr:nth-child(...) td:nth-child(...)`, specificity 0,2,2) outranked a
  // bare `td[data-terrain=...]` (0,1,1). Every existing terrain test asserts
  // MOVEMENT or the data attribute, so none of them could see it.
  //
  // This probe FAILS against the pre-fix build: backgroundImage reads "none".
  // Both parities are checked because the bug was a specificity tie -- a fix
  // that only won on one square color would still be half broken.
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-%23%23%232%23%23%23-4PPP1-6K1_w&floor=4&spawned=1&budget=3&maxRank=24");

  const paint = await page.evaluate(() => {
    const walls = [...document.querySelectorAll('td[data-terrain="wall"]')];
    const plain = [...document.querySelectorAll("td:not([data-terrain])")];
    const img = el => getComputedStyle(el).backgroundImage;
    // nth-child parity within the row decides the checkerboard color; the
    // rank <th> makes the first <td> nth-child(2), hence the +1 offset.
    const parity = el => ([...el.parentElement.children].indexOf(el)) % 2;
    return {
      wallCount: walls.length,
      wallsPainted: walls.map(img).filter(v => v !== "none").length,
      paritiesCovered: new Set(walls.map(parity)).size,
      plainPainted: plain.map(img).filter(v => v !== "none").length,
    };
  });

  expect(paint.wallCount).toBe(6);
  expect(paint.wallsPainted).toBe(6);          // every wall, not just the lucky parity
  expect(paint.paritiesCovered).toBe(2);       // the probe really did span both colors
  expect(paint.plainPainted).toBe(0);          // and an empty square stays flat
});

test("wall and hole render as visually distinct terrain -- brick barrier vs. circular pit", async ({ page }) => {
  // Tracker 2026-07-29T04:39:12: "holes design should look different than
  // walls. holes are pixel circles. walls are brick barrier on tile edge."
  // A wall paints its own backgroundImage (the brick course, asserted
  // generically above); a hole instead paints an inset ::before circle and
  // leaves the <td>'s own background alone so the checkerboard square still
  // shows around the pit. This probe pins that split rather than just
  // "terrain paints something".
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-%23X6-4PPP1-6K1_w&floor=4&spawned=1&budget=3&maxRank=24");

  const shapes = await page.evaluate(() => {
    const wall = document.querySelector('td[data-terrain="wall"]');
    const hole = document.querySelector('td[data-terrain="hole"]');
    const before = el => getComputedStyle(el, "::before");
    return {
      wallOwnBg: getComputedStyle(wall).backgroundImage,
      holeOwnBg: getComputedStyle(hole).backgroundImage,
      holeBeforeContent: before(hole).content,
      holeBeforeRadius: before(hole).borderRadius,
      wallBeforeContent: before(wall).content,
    };
  });

  expect(shapes.wallOwnBg).not.toBe("none");     // the brick course is the wall's own background
  expect(shapes.holeOwnBg).toBe("none");         // a hole leaves its own square unpainted...
  expect(shapes.holeBeforeContent).not.toBe("none"); // ...and instead draws an inset circle via ::before
  expect(shapes.holeBeforeRadius).toBe("50%");
  expect(shapes.wallBeforeContent).toBe("none"); // a wall has no ::before circle of its own
});
