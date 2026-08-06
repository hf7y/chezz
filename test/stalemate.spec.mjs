// King-only move-into-check + stalemate/deadlock reset, ported from
// narrative main (tracker 2026-07-26T02:38:04). Classic predates
// narrative's whole stalemate/floor-reset system, so this ports both
// halves together on purpose: King-only "can't hang the King" legality
// needs a floor-reset fallback or a genuinely boxed-in King has no move
// left to click at all (see FOCUS.md priority queue item 8/17/18 for the
// scoping reasoning this test file closes out).
import { test, expect } from "@playwright/test";
import { GAME_URL, emptyBoardWithKing } from "./helpers.mjs";

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

  const { boxed, normal } = await page.evaluate(([boxedBoard, normalBoard]) => ({
    boxed: hasAnyLegalMove(boxedBoard, true),
    normal: hasAnyLegalMove(normalBoard, true),
  }), [BOXED_WHITE(), emptyBoardWithKing()]);

  expect(boxed).toBe(false);
  expect(normal).toBe(true);
});

test("a move that hangs the King is illegal, other pieces stay hangable", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(() => {
    // King at (4,8), a Black Rook on the same file at (4,0) -- stepping the
    // King to (4,7) walks it straight into the Rook's line. A different
    // King step off that file stays legal.
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[8][4] = "K";
    board[0][4] = "r";
    return {
      intoCheck: isLegalMove(board, 4, 8, 4, 7),
      sideways: isLegalMove(board, 4, 8, 3, 8),
    };
  });

  expect(result.intoCheck).toBe(false);
  expect(result.sideways).toBe(true);
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

test("checkStalemate reports whether it reset, and the UI surfaces that as a message (regression: silent reset read as a free move)", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(([boxedBoard, normalBoard]) => {
    // No reset: a normal position returns false and leaves the message empty.
    state.board = normalBoard;
    state.turn = "w";
    const noResetReturn = checkStalemate();

    // Now force an actual reset and drive it through the same call site
    // makeMove's Black-reply path uses.
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
  }, [BOXED_WHITE(), emptyBoardWithKing()]);

  expect(result.noResetReturn).toBe(false);
  expect(result.resetReturn).toBe(true);
  expect(result.message.length).toBeGreaterThan(0);
});

test("Black having no pieces does NOT reset the floor -- only a White deadlock does", async ({ page }) => {
  await page.goto(GAME_URL);

  const result = await page.evaluate(([normalBoard]) => {
    // White has moves, Black has no pieces at all (a wiped-out enemy) -- the
    // player should simply be free to march on, never reset.
    state.board = normalBoard;
    state.floor = 4;
    state.turn = "w";
    const before = boardToFen();
    checkStalemate();
    return { unchanged: boardToFen() === before, floor: state.floor };
  }, [emptyBoardWithKing()]);

  expect(result.unchanged).toBe(true);
  expect(result.floor).toBe(4);
});
