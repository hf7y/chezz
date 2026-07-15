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

// Pins the pawn-supply tuning (PAWN_ALLOWANCE_CHANCE): pawns feed the
// promotion and captured-pawn-carryover mechanics, and without a deliberate
// allowance the tiered budget spends almost entirely on stronger pieces at
// higher floors (measured ~0.7 pawns/floor, >50% of floors with none at
// all). Same 30x28 sweep as the safety-invariant test above, checking the
// resulting average lands near the "about one pawn a floor" target instead
// of drifting back down if the spawn formula changes again later.
test("pawn supply averages roughly one per floor across floors and days", async ({ page }) => {
  await page.goto(GAME_URL);

  const avgPawnsPerFloor = await page.evaluate(([floors, days]) => {
    let totalPawns = 0, samples = 0;
    for (const floor of floors) {
      for (const day of days) {
        todayKey = () => "dTESTpawns" + day;
        state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
        state.board[8][4] = "K";
        state.floor = floor;
        state.lastSpawnBudget = 0;
        spawnBlackArmy();
        for (const row of state.board) for (const c of row) if (c === "p") totalPawns++;
        samples++;
      }
    }
    return totalPawns / samples;
  }, [FLOORS, FAKE_DAYS]);

  // "Approximately one" per the original ask, not pinned to exactly 1 --
  // wide enough to allow re-tuning PAWN_ALLOWANCE_CHANCE without a false
  // failure, tight enough to catch the allowance being lost entirely.
  expect(avgPawnsPerFloor).toBeGreaterThan(0.8);
  expect(avgPawnsPerFloor).toBeLessThan(1.4);
});

// Regression for a reported exploit: a player's own carried-over material
// used to inflate the same budget the piece-tier loop spends from, so a
// snowballed carryover could buy Black an extra strong piece -- skewable by
// reshuffling what White carries between floors. The carryover bonus should
// only ever buy extra pawns, never change piece-tier composition.
test("carryover bonus buys extra pawns only, never inflates piece-tier composition", async ({ page }) => {
  await page.goto(GAME_URL);

  const { nonPawnPieces, pawnCount } = await page.evaluate(() => {
    todayKey = () => "dTESTbonus";
    // Three carried-over Amazons is far more material than floor 1's own
    // budget -- if the bonus ever leaked into the tier loop, this would
    // spawn a strong piece despite being floor 1.
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.board[8][0] = "M";
    state.board[8][1] = "M";
    state.board[8][2] = "M";
    state.floor = 1;
    state.lastSpawnBudget = 0;
    spawnBlackArmy();

    let nonPawnPieces = 0, pawnCount = 0;
    for (const row of state.board) {
      for (const c of row) {
        if (!c || c === "K" || c === "M") continue; // empty, or White's own carried-over pieces
        if (c === "p") pawnCount++; else nonPawnPieces++;
      }
    }
    return { nonPawnPieces, pawnCount };
  });

  expect(nonPawnPieces).toBe(0);
  expect(pawnCount).toBeGreaterThan(0);
});
