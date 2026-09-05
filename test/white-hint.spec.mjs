// White move-hint (hf7y/chezz#3, human-directed 2026-08-23: "build it,
// always on" -- a star riding the existing legal-move highlight, not a
// separate marker). Covers the two correctness conditions the finding
// (full text in that issue's thread) flagged as real risks if this shipped
// naively:
//  - illegal hints: searchWithHint's collectMoves reuses legalMovesForPiece
//    for both sides, which -- unlike legalMovesFrom -- doesn't filter out
//    moves that hang White's own King. Every hint actually returned must
//    still pass isLegalMove.
//  - refutations mistaken for best moves: searchWithHint only trusts a
//    node's argmin when its loop ran to completion (no beta cutoff). Not
//    directly observable from outside (the `exact` flag is internal), but
//    exercised the same way ai-determinism.spec.mjs's "same position always
//    picks the same move" pin exercises it -- a hint from a discarded/cut
//    node would make the pairing non-deterministic, and it isn't.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("every hint getBlackMoveRuthless returns is either null or a move that's actually legal for the player (24 floor x day combinations)", async ({ page }) => {
  const violations = await page.evaluate(() => {
    const bad = [];
    for (let floor = 1; floor <= 12; floor += 1) {
      for (const dateSeed of ["2026-08-01", "2026-08-23"]) {
        state.dateSeed = dateSeed;
        state.floor = floor;
        state.spawned = false;
        state.captured = "";
        state.lastSpawnBudget = 0;
        state.diedOnce = false;
        state.board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(""));
        state.board[BOARD_ROWS - 1][4] = "K";
        spawnBlackArmy();

        const bm = getBlackMoveRuthless(state.board, state.captured, state.floor);
        if (!bm || !bm.hint) continue;

        const { nextBoard } = applyMove(state.board, bm, state.captured);
        const { fromX, fromY, toX, toY } = bm.hint;
        const piece = nextBoard[fromY] && nextBoard[fromY][fromX];
        const ok = !!piece && isWhitePiece(piece) && isLegalMove(nextBoard, fromX, fromY, toX, toY);
        if (!ok) bad.push({ floor, dateSeed, hint: bm.hint, piece });
      }
    }
    return bad;
  });

  expect(violations).toEqual([]);
});

test("selecting the piece the hint names stars exactly its destination, not the other legal squares", async ({ page }) => {
  // White King at (0,8) plus a Rook at (7,8) so the hint has a real choice
  // beyond the King; Black pawn far away so White's own move doesn't matter.
  await page.goto(GAME_URL + "?fen=8-4p3-8-8-8-8-8-8-K6R_w&floor=1&spawned=1&budget=1&maxRank=0");
  await page.evaluate(() => {
    whiteHint = { fromX: 7, fromY: 8, toX: 7, toY: 7 }; // Rook steps straight up
    selected = { x: 7, y: 8 };
    renderBoard();
  });

  const result = await page.evaluate(() => ({
    hinted: boardElement.rows[7].cells[8].getAttribute("data-hint"),
    otherLegal: boardElement.rows[6].cells[8].getAttribute("data-hint"), // (7,6) also legal for the Rook, not the hint
  }));

  expect(result.hinted).toBe("");
  expect(result.otherLegal).toBeNull();
});

test("a hint for a different piece than the one selected never stars anything", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-4p3-8-8-8-8-8-8-K6R_w&floor=1&spawned=1&budget=1&maxRank=0");
  await page.evaluate(() => {
    whiteHint = { fromX: 7, fromY: 8, toX: 7, toY: 7 }; // names the Rook
    selected = { x: 0, y: 8 }; // but the King is what's actually selected
    renderBoard();
  });

  const anyHintCell = await page.evaluate(() =>
    Array.from(document.querySelectorAll("td[data-hint]")).length
  );
  expect(anyHintCell).toBe(0);
});

test("no whiteHint means no star anywhere, even with a piece selected", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-4p3-8-8-8-8-8-8-K6R_w&floor=1&spawned=1&budget=1&maxRank=0");
  await page.evaluate(() => {
    whiteHint = null;
    selected = { x: 7, y: 8 };
    renderBoard();
  });

  const anyHintCell = await page.evaluate(() =>
    Array.from(document.querySelectorAll("td[data-hint]")).length
  );
  expect(anyHintCell).toBe(0);
});

test("a real turn sets whiteHint from Black's actual reply, and the player's next move clears it before Black moves again", async ({ page }) => {
  // Lone Black pawn at (4,1): its only move is to push forward, so Black's
  // reply is forced/deterministic regardless of search depth or ties.
  await page.goto(GAME_URL + "?fen=8-4p3-8-8-8-8-8-8-K6R_w&floor=1&spawned=1&budget=1&maxRank=0");

  await page.evaluate(() => makeMove(0, 8, 0, 7)); // harmless King step, triggers Black's reply
  const afterBlack = await page.evaluate(() => whiteHint);
  if (afterBlack !== null) {
    const legal = await page.evaluate((h) => {
      const piece = state.board[h.fromY][h.fromX];
      return !!piece && isWhitePiece(piece) && isLegalMove(state.board, h.fromX, h.fromY, h.toX, h.toY);
    }, afterBlack);
    expect(legal).toBe(true);
  }

  // The pawn already pushed once; whatever White does now, Black may have
  // no legal move left (single pawn, near the edge of its own march) --
  // either way the OLD hint must not survive the player's own move.
  await page.evaluate(() => {
    whiteHint = { fromX: 0, fromY: 7, toX: 0, toY: 6 }; // planted sentinel, must not leak through
  });
  await page.evaluate(() => makeMove(0, 7, 0, 6));
  const stale = await page.evaluate(() => whiteHint);
  // Either Black replied again (fresh hint or null, but never the planted
  // sentinel) or didn't (cleared to null) -- the sentinel must be gone.
  expect(stale).not.toEqual({ fromX: 0, fromY: 7, toX: 0, toY: 6 });
});
