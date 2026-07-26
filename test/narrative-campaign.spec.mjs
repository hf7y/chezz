// Covers the scripted campaign (NARRATIVE_STAGES) itself: every stage places
// exactly what it says, none of them are lost on arrival (no retry/reshuffle
// exists for scripted content the way procedural spawning has one), and the
// handoff to procedural generation past the campaign lands cleanly.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test("every scripted stage leaves White with a legal escape", async ({ page }) => {
  await page.goto(GAME_URL);

  const failures = await page.evaluate(() => {
    const bad = [];
    for (let floor = 1; floor <= NARRATIVE_STAGES.length; floor++) {
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      state.floor = floor;
      state.lastSpawnBudget = 0;
      spawnBlackArmy();
      if (!whiteSurvivesNextMove(state.board)) {
        bad.push({ floor, label: NARRATIVE_STAGES[floor - 1].label });
      }
    }
    return bad;
  });

  expect(failures).toEqual([]);
});

test("each stage places exactly the pieces its rows describe", async ({ page }) => {
  await page.goto(GAME_URL);

  const boards = await page.evaluate(() => {
    const seen = [];
    for (let floor = 1; floor <= NARRATIVE_STAGES.length; floor++) {
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      state.floor = floor;
      state.lastSpawnBudget = 0;
      spawnBlackArmy();
      // Rows 1-6 should match the stage exactly; row 0 (exit) and rows 7-8
      // (White's own carried-over army) are untouched by scripted placement.
      seen.push(state.board.slice(1, 7).map(row => row.map(c => c || ".").join("")).join("|"));
    }
    return seen;
  });

  const expected = await page.evaluate(() => NARRATIVE_STAGES.map(s => s.rows.map(r => {
    return r.split("").flatMap(c => "12345678".includes(c) ? Array(Number(c)).fill(".") : c).join("");
  }).join("|")));

  expect(boards).toEqual(expected);
});

test("the floor right after the campaign is genuinely procedural", async ({ page }) => {
  await page.goto(GAME_URL);

  const [first, second] = await page.evaluate(() => {
    function spawnOnce(day) {
      todayKey = () => day;
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      state.floor = NARRATIVE_STAGES.length + 1;
      state.lastSpawnBudget = 0;
      spawnBlackArmy();
      return state.board.map(row => row.join(",")).join("|");
    }
    return [spawnOnce("dTESTpost1"), spawnOnce("dTESTpost2")];
  });

  // Two different simulated days at the same (post-campaign) floor should
  // diverge -- if they don't, this floor is silently still scripted/frozen.
  expect(first).not.toBe(second);
});

test("the campaign's final stage is the traditional back rank", async ({ page }) => {
  await page.goto(GAME_URL);

  const bossRow = await page.evaluate(() => NARRATIVE_STAGES[NARRATIVE_STAGES.length - 1].rows[1]);
  expect(bossRow).toBe("rnbqkbnr");
});

test("the Two Bishops stage spawns opposite-colored bishops, under every cyclic shift", async ({ page }) => {
  // Tracker 2026-07-17T05:43:51.354Z (+ one duplicate): same-color bishops
  // read as a mistake. placeScriptedStage shifts every row by the same
  // amount, so square-color parity is decided by the authored file gap --
  // verify it directly for all 8 possible shifts.
  await page.goto(GAME_URL);
  const parities = await page.evaluate(() => {
    const stage = NARRATIVE_STAGES.find(s => s.label === "Two Bishops");
    const results = [];
    for (let shift = 0; shift < 8; shift++) {
      const bishops = [];
      stage.rows.map(parseFenRow).forEach((row, i) => {
        row.forEach((c, x) => { if (c === "b") bishops.push({ x: (x + shift) % 8, y: i + 1 }); });
      });
      results.push(bishops.map(b => (b.x + b.y) % 2));
    }
    return results;
  });
  for (const [a, b] of parities) expect(a).not.toBe(b);
});
