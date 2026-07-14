// Fuzzes spawnBlackArmy the way the project's earlier (untracked) regression
// suite did: 30 floors x 28 simulated days = 840 combinations, asserting the
// one safety invariant spawnBlackArmy promises -- a freshly spawned floor
// never leaves White dead on arrival (see whiteSurvivesNextMove).
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

const FLOORS = Array.from({ length: 30 }, (_, i) => i + 1);
const FAKE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

test("spawned army never leaves White dead on arrival (840 floor x day combinations)", async ({ page }) => {
  await page.goto(GAME_URL);

  const failures = await page.evaluate(([floors, days]) => {
    const bad = [];
    for (const floor of floors) {
      for (const day of days) {
        // todayKey() is the only source of day-to-day entropy in the spawn
        // seed; overriding it lets one page fuzz many "days" without needing
        // to fake the system clock.
        todayKey = () => "dTEST" + day;
        state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
        state.board[8][4] = "K";
        state.floor = floor;
        state.lastSpawnBudget = 0;
        spawnBlackArmy();
        if (!whiteSurvivesNextMove(state.board)) bad.push({ floor, day });
      }
    }
    return bad;
  }, [FLOORS, FAKE_DAYS]);

  expect(failures).toEqual([]);
});

test("spawn budget only ratchets up across increasing floors, never down", async ({ page }) => {
  await page.goto(GAME_URL);

  const budgets = await page.evaluate(() => {
    todayKey = () => "dTESTratchet";
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.lastSpawnBudget = 0;
    const seen = [];
    for (let floor = 1; floor <= 40; floor++) {
      state.floor = floor;
      spawnBlackArmy();
      seen.push(state.lastSpawnBudget);
    }
    return seen;
  });

  for (let i = 1; i < budgets.length; i++) {
    expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]);
  }
});

test("spawning is deterministic: same floor and day always produces the same board", async ({ page }) => {
  await page.goto(GAME_URL);

  const [first, second] = await page.evaluate(() => {
    function spawnOnce() {
      todayKey = () => "dTESTdeterminism";
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      state.floor = 12;
      state.lastSpawnBudget = 0;
      spawnBlackArmy();
      return state.board.map(row => row.join(",")).join("|");
    }
    return [spawnOnce(), spawnOnce()];
  });

  expect(first).toBe(second);
});
