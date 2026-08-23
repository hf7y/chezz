// Roguelike respawn loop (hf7y/chezz#4, human-directed 2026-08-22: "build
// it. I'll give my feedback as a play tester. always."), replacing the old
// 2026-07-19 standing rule ("a White-side deadlock resets the CURRENT floor
// and the run never restarts from floor 1"). White having zero legal moves
// is this game's only "death" signal; it now sends the run back to floor 1
// as a fresh lone King, keeping the captured bank and the spawn-budget
// ratchet so the respawned floor 1 is proportionally as tough as the run
// had already earned, gated by a wall that narrows as the kept bank grows.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

// A minimal board where White has zero legal moves: the King is cornered at
// (0,0) and every reachable neighbor is a friendly White pawn that is itself
// immobile (blocked ahead, no diagonal enemy, pinned against the board edge).
const BOXED_WHITE = () => {
  const b = Array.from({ length: 9 }, () => Array(8).fill(""));
  b[0][0] = "K"; b[0][1] = "P"; b[1][0] = "P"; b[1][1] = "P";
  return b;
};

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("hasAnyLegalMove: false for a fully boxed White side, true for a normal one", async ({ page }) => {
  const { boxed, normal } = await page.evaluate(([boxedBoard]) => {
    const normalBoard = Array.from({ length: 9 }, () => Array(8).fill(""));
    normalBoard[8][4] = "K";
    return {
      boxed: hasAnyLegalMove(boxedBoard, true),
      normal: hasAnyLegalMove(normalBoard, true),
    };
  }, [BOXED_WHITE()]);

  expect(boxed).toBe(false);
  expect(normal).toBe(true);
});

test("a White-side deadlock sends the run back to floor 1, a fresh lone King", async ({ page }) => {
  const result = await page.evaluate(([boxedBoard]) => {
    state.board = boxedBoard;
    state.floor = 5;
    state.turn = "w";
    state.captured = "";
    state.lastSpawnBudget = 0;
    state.diedOnce = false;
    checkDeath();

    return {
      floor: state.floor,
      diedOnce: state.diedOnce,
      hasKing: state.board.some(row => row.includes("K")),
      hasMoveAfter: hasAnyLegalMove(state.board, true),
    };
  }, [BOXED_WHITE()]);

  expect(result.floor).toBe(1);          // back to floor 1, not the current floor
  expect(result.diedOnce).toBe(true);
  expect(result.hasKing).toBe(true);
  expect(result.hasMoveAfter).toBe(true); // the respawned floor is actually playable
});

test("death keeps the captured bank and the run's high-water mark", async ({ page }) => {
  const result = await page.evaluate(([boxedBoard]) => {
    state.board = boxedBoard;
    state.floor = 4;
    state.turn = "w";
    state.captured = "qrbn"; // White's captured bank
    state.lastSpawnBudget = 0;
    state.maxRank = 999;
    checkDeath();
    return { captured: state.captured, maxRank: state.maxRank };
  }, [BOXED_WHITE()]);

  expect(result.captured).toBe("qrbn"); // bank survives the death untouched
  expect(result.maxRank).toBe(999);     // run stays alive: high-water mark untouched
});

test("the spawn-budget ratchet is NOT reset by death -- floor 1 respawns as tough as the run had earned", async ({ page }) => {
  const budgetAfter = await page.evaluate(([boxedBoard]) => {
    state.board = boxedBoard;
    state.floor = 12;
    state.turn = "w";
    state.captured = "";
    state.lastSpawnBudget = 40; // stands in for a deep run's earned difficulty
    checkDeath();
    return state.lastSpawnBudget;
  }, [BOXED_WHITE()]);

  expect(budgetAfter).toBeGreaterThanOrEqual(40); // never decreases through a death
});

test("once died, a re-rolled floor 1 skips the scripted campaign for procedural generation", async ({ page }) => {
  const { stageIsFirstBlood } = await page.evaluate(() => {
    state.floor = 1;
    state.diedOnce = true;
    state.spawned = false;
    state.captured = "";
    state.lastSpawnBudget = 0;
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    spawnBlackArmy();
    // The scripted "First blood" stage is a single pawn at (4,5); a
    // procedural floor 1 at day-seeded budget >= 1 essentially never
    // matches that exact shape, and NARRATIVE_STAGES itself is untouched --
    // this just confirms the stage branch wasn't taken.
    return { stageIsFirstBlood: state.board[5][4] === "p" && armyCost(state.board) === PIECE_SPAWN_COST.p };
  });
  expect(stageIsFirstBlood).toBe(false);
});

test("a death respawn's floor 1 carries a death gate that narrows with a bigger captured bank", async ({ page }) => {
  const { emptyGate, gatedRow } = await page.evaluate(() => {
    function wallCount() {
      state.floor = 1;
      state.diedOnce = true;
      state.spawned = false;
      state.lastSpawnBudget = 0;
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      spawnBlackArmy();
      return state.board[6].filter(c => c === "#").length;
    }

    state.captured = "";
    const emptyGate = wallCount();

    state.captured = "qrbnqrbnqrbn"; // a large bank
    const gatedRow = wallCount();

    return { emptyGate, gatedRow };
  });

  expect(emptyGate).toBe(0);           // no bank, no gate
  expect(gatedRow).toBeGreaterThan(0); // a real bank narrows the gate
  expect(gatedRow).toBeLessThanOrEqual(6); // DEATH_GATE_MIN_GAP keeps at least 2 columns open
});

test("checkDeath reports whether it fired, and the UI surfaces that as a message (regression: 2026-07-16T11:51:25.998Z, silent reset read as a free move)", async ({ page }) => {
  const result = await page.evaluate(([boxedBoard]) => {
    // No death: a normal position returns false and leaves the message empty.
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.turn = "w";
    const noDeathReturn = checkDeath();

    // Now force an actual death and drive it through the same call site the
    // Black-move loop uses.
    state.board = boxedBoard;
    state.floor = 2;
    state.captured = "";
    state.lastSpawnBudget = 0;
    state.turn = "w";
    const deathReturn = checkDeath();
    if (deathReturn) announceDeath();

    return {
      noDeathReturn,
      deathReturn,
      message: document.getElementById("floorMessage").textContent,
    };
  }, [BOXED_WHITE()]);

  expect(result.noDeathReturn).toBe(false);
  expect(result.deathReturn).toBe(true);
  expect(result.message.length).toBeGreaterThan(0);
});

test("Black having no moves does NOT trigger death -- only a White deadlock does", async ({ page }) => {
  const result = await page.evaluate(() => {
    // White has moves, Black has no pieces at all (a wiped-out enemy) -- the
    // player should simply be free to march on, never respawn.
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.floor = 4;
    state.turn = "w";
    const before = boardToFen();
    checkDeath();
    return { unchanged: boardToFen() === before, floor: state.floor };
  });

  expect(result.unchanged).toBe(true);
  expect(result.floor).toBe(4);
});
