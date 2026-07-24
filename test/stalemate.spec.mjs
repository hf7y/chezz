// Stalemate / deadlock handling (standing rule set 2026-07-19 from a human
// design call): when the side to move has no legal move, reset the CURRENT
// floor fresh and keep the run alive. The gap this closes is the symmetric
// White-side (player) deadlock -- makeMove used to hand the turn back to White
// unconditionally even when White had nothing to play, freezing the board.
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

test("hasAnyLegalMove: false for a fully boxed White side, true for a normal one", async ({ page }) => {
  await page.goto(GAME_URL);

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

test("a White-side deadlock resets to the floor start and keeps the run alive", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(([boxedBoard]) => {
    // Spawn a real floor so a floor-start snapshot exists.
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.floor = 3;
    state.spawned = false;
    state.lastSpawnBudget = 0;
    state.captured = "";
    state.maxRank = 999; // a high-water mark that must survive the reset
    spawnBlackArmy();
    const startFen = boardToFen();

    // Now jam White into a deadlock on the same floor and let the guard fire.
    state.board = boxedBoard;
    state.turn = "w";
    checkStalemate();

    return {
      resetToStart: boardToFen() === startFen,
      floor: state.floor,
      maxRank: state.maxRank,
      turn: state.turn,
      hasMoveAfter: hasAnyLegalMove(state.board, true),
    };
  }, [BOXED_WHITE()]);

  expect(result.resetToStart).toBe(true);   // restored to this floor's start
  expect(result.floor).toBe(3);             // same floor -- not advanced, not restarted from 1
  expect(result.maxRank).toBe(999);         // run stays alive: high-water mark untouched
  expect(result.turn).toBe("w");
  expect(result.hasMoveAfter).toBe(true);   // the fresh floor is actually playable
});

test("with no snapshot, a deadlock still resolves by respawning from survivors", async ({ page }) => {
  await page.goto(GAME_URL);

  const hasMoveAfter = await page.evaluate(([boxedBoard]) => {
    floorStart = null;             // simulate a cold load with no snapshot
    state.board = boxedBoard;
    state.floor = 5;
    state.turn = "w";
    state.captured = "";
    state.lastSpawnBudget = 0;
    checkStalemate();
    return hasAnyLegalMove(state.board, true);
  }, [BOXED_WHITE()]);

  expect(hasMoveAfter).toBe(true); // survivor respawn guarantees a playable start
});

test("checkStalemate reports whether it reset, and the UI surfaces that as a message (regression: 2026-07-16T11:51:25.998Z, silent reset read as a free move)", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(([boxedBoard]) => {
    // No reset: a normal position returns false and leaves the message empty.
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.turn = "w";
    const noResetReturn = checkStalemate();

    // Now force an actual reset and drive it through the same call site the
    // Black-move loop uses.
    floorStart = null;
    state.board = boxedBoard;
    state.floor = 2;
    state.captured = "";
    state.lastSpawnBudget = 0;
    state.turn = "w";
    const resetReturn = checkStalemate();
    if (resetReturn) announceStalemateReset();

    return {
      noResetReturn,
      resetReturn,
      message: document.getElementById("floorMessage").textContent,
    };
  }, [BOXED_WHITE()]);

  expect(result.noResetReturn).toBe(false);
  expect(result.resetReturn).toBe(true);
  expect(result.message.length).toBeGreaterThan(0);
});

test("Black having no moves does NOT reset the floor -- only a White deadlock does", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(() => {
    // White has moves, Black has no pieces at all (a wiped-out enemy) -- the
    // player should simply be free to march on, never reset.
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    state.floor = 4;
    state.turn = "w";
    const before = boardToFen();
    checkStalemate();
    return { unchanged: boardToFen() === before, floor: state.floor };
  });

  expect(result.unchanged).toBe(true);
  expect(result.floor).toBe(4);
});
