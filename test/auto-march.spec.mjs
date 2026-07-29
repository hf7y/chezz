// Auto-march (DESIGN-NOTES.md, "Auto-march -- REFINED", priority queue item
// 3): a drag doesn't need a pixel-perfect drop on the exact destination
// square -- it snaps to whichever legal move is closest to wherever the
// pointer actually let go. Formation-follow is the other half: once the
// King steps somewhere with no Black pieces left on the board, surviving
// White pieces automatically rank up onto the King's new rank (naive,
// strongest-first, closest-to-the-King's-file).
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

test("dragging the King and releasing past the target square still snaps to the nearest legal move", async ({ page }) => {
  // King alone at (4,8); its only "straight up" legal move is (4,7) --
  // the diagonal alternatives (3,7)/(5,7) are one full cell further from
  // any point directly above (4,8), so a release two rows up (not even a
  // legal square) should still resolve to the King stepping to (4,7).
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-8-4K3_w&floor=1&spawned=1&budget=1&maxRank=0");

  const moved = await page.evaluate(() => {
    const kingCell = () => [...document.querySelectorAll("td")].find(td => td.textContent.includes("♔"));
    const rectOf = el => el.getBoundingClientRect();
    const el = kingCell();
    const startRect = rectOf(el);
    const start = { x: startRect.x + startRect.width / 2, y: startRect.y + startRect.height / 2 };
    // Two rows above the King's own cell, same column -- overshoots (4,7).
    const dropY = start.y - 2 * startRect.height;
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientX: start.x, clientY: start.y }));
    document.dispatchEvent(new PointerEvent("pointermove", { ...base, clientX: start.x, clientY: dropY }));
    document.dispatchEvent(new PointerEvent("pointerup", { ...base, clientX: start.x, clientY: dropY }));
    return { board: state.board };
  });

  expect(moved.board[7][4]).toBe("K");
  expect(moved.board[8][4]).toBe("");
});

test("formation-follow: surviving pieces rank up onto the King's new rank once Black is gone", async ({ page }) => {
  // Rook at (0,6), Bishop at (7,6), King at (4,7), no Black pieces anywhere.
  // The King steps down to (4,8); the Rook's only route onto row 8 is
  // straight down its file to (0,8), and the Bishop's only route (it can't
  // slide sideways) is the diagonal to (5,8).
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-R6B-4K3-8_w&floor=1&spawned=1&budget=1&maxRank=0");

  const board = await page.evaluate(() => {
    makeMove(4, 7, 4, 8);
    return state.board;
  });

  expect(board[8][4]).toBe("K");
  expect(board[8][0]).toBe("R");
  expect(board[8][5]).toBe("B");
  expect(board[6][0]).toBe("");
  expect(board[6][7]).toBe("");
});

test("formation-follow does not trigger while Black pieces remain", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-R6B-4K3-p7_w&floor=1&spawned=1&budget=1&maxRank=0");

  const board = await page.evaluate(() => {
    makeMove(4, 7, 4, 8);
    return state.board;
  });

  // Rook/Bishop should stay put -- a Black pawn is still on the board.
  expect(board[6][0]).toBe("R");
  expect(board[6][7]).toBe("B");
});

test("formation-follow: a piece too far back to reach the King's rank still steps toward it", async ({ page }) => {
  // Tracker 2026-07-28T14:47:05 -- "pawn on f file should be automoving with
  // king". The old rank-or-nothing filter stranded any piece more than one
  // move behind: an f-file Pawn three rows back can never land on the King's
  // rank in one move, so it never moved at all, and falling further behind
  // only made the gap less closable. That self-reinforcement is the bug.
  //
  // This probe FAILS against the pre-fix build: the pawn never leaves row 6.
  // The King deliberately stops short of EXIT_ROW (0) -- reaching it would
  // load the next floor and replace the board mid-assertion.
  await page.goto(GAME_URL + "?fen=8-8-8-8-4P1K1-8-5P2-8-8_w&floor=3&spawned=1&budget=1&maxRank=0");

  const boards = await page.evaluate(() => {
    const snaps = [];
    makeMove(6, 4, 6, 3);   // King steps up a rank; formation-follow fires.
    snaps.push(state.board.map(r => [...r]));
    makeMove(6, 3, 6, 2);   // ...and again.
    snaps.push(state.board.map(r => [...r]));
    return snaps;
  });

  // The trailing f-file pawn advances one rank per King move instead of
  // standing still. Its file is unchanged -- a pawn has no sideways move.
  expect(boards[0][5][5]).toBe("P");
  expect(boards[0][6][5]).toBe("");
  expect(boards[1][4][5]).toBe("P");

  // The e-file pawn, which CAN reach the King's rank, still lands on it
  // outright -- the fallback must not quietly replace the preferred move.
  expect(boards[0][3][4]).toBe("P");
});
