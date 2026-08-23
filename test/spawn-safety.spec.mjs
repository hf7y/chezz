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
// higher floors. Same 30x28 sweep as the safety-invariant test above.
// Tightened 2026-08-06 (tracker 2026-07-26T02:06:18, PAWN_ALLOWANCE_CHANCE
// 0.3 -> 0.5, mirroring narrative's already-measured bump): the old 0.8-1.4
// bound passed at both 0.3 and 0.5 and so wouldn't have caught a regression
// back to the old value. Verified this tightened bound fails against 0.3
// (measured avgPawnsPerFloor 0.98, zeroPawnPct 37.9%) before landing at 0.5.
test("pawn supply averages roughly one per floor, and zero-pawn floors are a minority", async ({ page }) => {
  await page.goto(GAME_URL);

  const { avgPawnsPerFloor, zeroPawnPct } = await page.evaluate(([floors, days]) => {
    let totalPawns = 0, zeroFloors = 0, samples = 0;
    for (const floor of floors) {
      for (const day of days) {
        todayKey = () => "dTESTpawns" + day;
        state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
        state.board[8][4] = "K";
        state.floor = floor;
        state.lastSpawnBudget = 0;
        spawnBlackArmy();
        let pawns = 0;
        for (const row of state.board) for (const c of row) if (c === "p") pawns++;
        if (pawns === 0) zeroFloors++;
        totalPawns += pawns;
        samples++;
      }
    }
    return { avgPawnsPerFloor: totalPawns / samples, zeroPawnPct: (100 * zeroFloors) / samples };
  }, [FLOORS, FAKE_DAYS]);

  expect(avgPawnsPerFloor).toBeGreaterThan(1.05);
  expect(avgPawnsPerFloor).toBeLessThan(1.4);
  expect(zeroPawnPct).toBeLessThan(30);
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

// Ported from narrative's 50c0c3e (hf7y/chezz tracker report 2026-08-09,
// "free pawn spawned" -- this branch never received the port when narrative
// shipped it 2026-07-29). Regression for a recurring report cluster and the
// human call that settled it: "No. Never. Pawns can spawn under threat if
// they are defended by another piece ... Free material on level load is not
// a good design." placePawn took the first empty square with no safety check
// at all, on the strength of an in-code comment ("pawns stand in the open")
// that call says was never authorized. This pins the replacement rule:
//
//   a freshly spawned Black pawn may be attacked by White ONLY if some Black
//   piece defends it.
//
// Checks EVERY black pawn on the board, not just ones placePawn produced --
// the shield-pawn path in the tier loop places a pawn directly, and it used
// to be able to leave that shield hanging too.
test("no spawned black pawn is ever attacked and undefended (840 floor x day combinations)", async ({ page }) => {
  await page.goto(GAME_URL);

  const failures = await page.evaluate(([floors, days]) => {
    const bad = [];
    // Defender probe defined HERE rather than calling the game's own
    // isDefendedSquare, so this test is a witness to behavior and not a
    // tautology against the helper the fix introduced.
    const defended = (bx, by) => {
      const occ = state.board[by][bx];
      state.board[by][bx] = "P";
      const d = attackersOf(state.board, bx, by, false);
      state.board[by][bx] = occ;
      return d.length > 0;
    };
    for (const floor of floors) {
      for (const day of days) {
        todayKey = () => "dTESTfreepawn" + day;
        state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
        state.board[8][4] = "K";
        state.floor = floor;
        state.lastSpawnBudget = 0;
        spawnBlackArmy();
        for (let y = 0; y < BOARD_ROWS; y++) {
          for (let x = 0; x < BOARD_COLS; x++) {
            if (state.board[y][x] !== "p") continue;
            const attacked = attackersOf(state.board, x, y, true).length > 0;
            if (attacked && !defended(x, y)) bad.push({ floor, day, x, y });
          }
        }
      }
    }
    return bad;
  }, [FLOORS, FAKE_DAYS]);

  expect(failures).toEqual([]);
});

// The carried army is what actually threatens a spawn square, so the sweep
// above (bare King) exercises the rule only lightly. This aims real White
// long-range material down open files at the pawn ranks -- the shape that
// produced the original reports -- and demands the same invariant. THIS is
// the regression witness: narrative's equivalent measured 114
// attacked-and-undefended spawned pawns against its pre-fix build, 0 after.
test("no spawned black pawn hangs against a carried long-range army", async ({ page }) => {
  await page.goto(GAME_URL);

  const failures = await page.evaluate(([floors]) => {
    const bad = [];
    const defended = (bx, by) => {
      const occ = state.board[by][bx];
      state.board[by][bx] = "P";
      const d = attackersOf(state.board, bx, by, false);
      state.board[by][bx] = occ;
      return d.length > 0;
    };
    for (const floor of floors) {
      for (const carried of ["R", "Q", "B"]) {
        for (let col = 0; col < BOARD_COLS; col++) {
          todayKey = () => "dTESTcarried" + carried + col;
          state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
          state.board[8][4] = "K";
          state.board[7][col] = carried;
          state.floor = floor;
          state.lastSpawnBudget = 0;
          spawnBlackArmy();
          for (let y = 0; y < BOARD_ROWS; y++) {
            for (let x = 0; x < BOARD_COLS; x++) {
              if (state.board[y][x] !== "p") continue;
              const attacked = attackersOf(state.board, x, y, true).length > 0;
              if (attacked && !defended(x, y)) bad.push({ floor, carried, col, x, y });
            }
          }
        }
      }
    }
    return bad;
  }, [FLOORS.slice(0, 12)]);

  expect(failures).toEqual([]);
});
