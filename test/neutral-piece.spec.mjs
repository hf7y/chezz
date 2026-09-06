// The neutral evasive piece (DESIGN-NOTES.md 2026-07-20 seed list, spec'd
// in hf7y/chezz#102, authorized in #103, built for #111): belongs to
// neither side, capturable by either, grants the capturer a permanent
// +knight upgrade. Narrative-only -- classic never spawns one (see
// transformSpecialCases in scripts/build-classic-artifact.mjs), covered by
// build-classic-artifact.spec.mjs and check-size.mjs, not here.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

async function movesFor(page, board, piece, x, y) {
  return page.evaluate(([board, piece, x, y]) => legalMovesForPiece(board, piece, x, y), [board, piece, x, y]);
}

test("the neutral piece is a legal capture target for either side", async ({ page }) => {
  const whiteBoard = emptyBoard();
  whiteBoard[4][4] = "R";
  whiteBoard[4][6] = "e";
  const whiteMoves = await movesFor(page, whiteBoard, "R", 4, 4);
  expect(whiteMoves.map(m => `${m.x},${m.y}`)).toContain("6,4");

  const blackBoard = emptyBoard();
  blackBoard[4][4] = "r";
  blackBoard[4][6] = "e";
  const blackMoves = await movesFor(page, blackBoard, "r", 4, 4);
  expect(blackMoves.map(m => `${m.x},${m.y}`)).toContain("6,4");
});

test("a slide captures the neutral piece and stops there -- approach is unblocked, passage isn't", async ({ page }) => {
  const board = emptyBoard();
  board[4][4] = "R";
  board[4][6] = "e";
  const moves = await movesFor(page, board, "R", 4, 4);
  const targets = moves.map(m => `${m.x},${m.y}`);
  expect(targets).toContain("5,4"); // approach unblocked, unlike terrain
  expect(targets).toContain("6,4"); // captures it
  expect(targets).not.toContain("7,4"); // but can't slide through it either
});

test("the neutral piece is never treated as an attacker for either side", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[7][4] = "e"; // directly adjacent -- would threaten the King if treated as any real piece
  const asBlack = await page.evaluate(b => attackersOf(b, 4, 8, false), board);
  const asWhite = await page.evaluate(b => attackersOf(b, 4, 8, true), board);
  expect(asBlack).toEqual([]);
  expect(asWhite).toEqual([]);
});

test("evaluateBoard doesn't collapse to NaN with a neutral piece on the board (terrain's own tracker 2026-07-30T06:18:44 bug class)", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[4][4] = "e";
  board[1][4] = "q"; // give Black a piece with a legal move
  const chosen = await page.evaluate(
    ([board, captured, floor]) => getBlackMoveRuthless(board, captured, floor),
    [board, "", 1]
  );
  expect(Number.isFinite(chosen.score)).toBe(true);
});

test("pieceValues has a zero entry for the neutral piece -- it is never material for either side", async ({ page }) => {
  const values = await page.evaluate(() => pieceValues);
  expect(values.e).toBe(0);
});

test("capturing the neutral piece upgrades the capturer: bishop, rook and queen each gain +knight", async ({ page }) => {
  for (const [before, after] of [["b", "a"], ["r", "c"], ["q", "m"]]) {
    const board = emptyBoard();
    board[4][4] = before;
    board[4][6] = "e";
    const mv = { piece: before, fromX: 4, fromY: 4, toX: 6, toY: 4 };
    const result = await page.evaluate(([board, mv]) => applyMove(board, mv, ""), [board, mv]);
    expect(result.nextBoard[4][6]).toBe(after);
    expect(result.pool).toBe(""); // the neutral piece never enters the captured-material pool
  }
});

test("capturing the neutral piece with an already knight-combined piece produces a Knightrider instead of double-stacking", async ({ page }) => {
  for (const before of ["a", "c", "m"]) {
    const board = emptyBoard();
    board[4][4] = before;
    board[4][6] = "e";
    const mv = { piece: before, fromX: 4, fromY: 4, toX: 6, toY: 4 };
    const result = await page.evaluate(([board, mv]) => applyMove(board, mv, ""), [board, mv]);
    expect(result.nextBoard[4][6]).toBe("y");
  }
});

test("capturing the neutral piece with a King, Knight or Pawn is an ordinary move -- no eligible upgrade", async ({ page }) => {
  for (const before of ["k", "n", "p"]) {
    const board = emptyBoard();
    board[4][4] = before;
    board[4][6] = "e";
    const mv = { piece: before, fromX: 4, fromY: 4, toX: 6, toY: 4 };
    const result = await page.evaluate(([board, mv]) => applyMove(board, mv, ""), [board, mv]);
    expect(result.nextBoard[4][6]).toBe(before);
  }
});

test("the upgrade is cased to the capturer's own side, not the neutral piece's", async ({ page }) => {
  const white = await page.evaluate(() => upgradeWithKnight("R"));
  const black = await page.evaluate(() => upgradeWithKnight("r"));
  expect(white).toBe("C");
  expect(black).toBe("c");
});

test("White's own inline capture path (the real makeMove, not just applyMove) applies the same upgrade", async ({ page }) => {
  const after = await page.evaluate(async () => {
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[4][4] = "B";  // White bishop
    state.board[3][5] = "e";  // neutral piece, one diagonal step away
    state.board[8][0] = "K";  // King elsewhere, out of the way
    state.board[1][7] = "p";  // a lone Black pawn far from the action, so Black has a reply but can't reach (5,3)
    state.turn = "w";
    state.floor = 1;
    state.spawned = true;
    state.captured = "";
    await makeMove(4, 4, 5, 3);
    return { piece: state.board[3][5], captured: state.captured };
  });
  expect(after.piece).toBe("A"); // Archbishop, White-cased
  expect(after.captured).toBe(""); // never added to White's captured pool
});

test("the neutral piece's reactive move maximizes distance from the nearest threat", async ({ page }) => {
  const result = await page.evaluate(() => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[4][4] = "e";
    board[4][6] = "Q"; // a White queen, two squares away on the same rank
    moveNeutralPiece(board);

    let to = null;
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        if (board[y][x] === "e") to = { x, y };
      }
    }

    // Recomputed independently rather than pinning one destination -- several
    // KNIGHT_JUMPS escapes can tie for farthest, and this should pin the
    // BEHAVIOR (picks a max-distance one), not one arbitrary square among ties.
    const dist = sq => Math.abs(sq.x - 6) + Math.abs(sq.y - 4); // the queen sits at board[4][6] -> x=6, y=4
    const escapes = KNIGHT_JUMPS
      .map(([dx, dy]) => ({ x: 4 + dx, y: 4 + dy }))
      .filter(sq => sq.x >= 0 && sq.x < BOARD_COLS && sq.y >= 0 && sq.y < BOARD_ROWS);
    const maxDist = Math.max(...escapes.map(dist));

    return { moved: !(to.x === 4 && to.y === 4), chosenDist: to ? dist(to) : null, maxDist };
  });
  expect(result.moved).toBe(true);
  expect(result.chosenDist).toBe(result.maxDist);
});

test("a boxed-in neutral piece with no legal escape stays put instead of throwing", async ({ page }) => {
  const finalSquare = await page.evaluate(() => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[4][4] = "e";
    for (const [dx, dy] of KNIGHT_JUMPS) {
      const x = 4 + dx, y = 4 + dy;
      if (x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS) board[y][x] = "p";
    }
    moveNeutralPiece(board);
    return board[4][4];
  });
  expect(finalSquare).toBe("e");
});

test("moveNeutralPiece is a no-op when there's no neutral piece on the board", async ({ page }) => {
  const king = await page.evaluate(() => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[8][4] = "K";
    moveNeutralPiece(board);
    return board[8][4];
  });
  expect(king).toBe("K");
});

test("spawnNeutralPiece lands on an empty, non-exit-row square that hasNeutralPiece then detects", async ({ page }) => {
  const result = await page.evaluate(() => {
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    spawnNeutralPiece(() => 0); // deterministic stub rng -- picks the first candidate
    let pos = null;
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        if (state.board[y][x] === "e") pos = { x, y };
      }
    }
    return { pos, detected: hasNeutralPiece(state.board) };
  });
  expect(result.pos).not.toBeNull();
  expect(result.pos.y).not.toBe(0); // EXIT_ROW is excluded
  expect(result.detected).toBe(true);
});
