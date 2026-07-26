// Pins the fix for the 2026-07-16/17 "Black hangs material for no
// reason" tracker cluster: quiescence used to follow only recaptures on
// the square just taken, so a piece left en prise anywhere ELSE at the
// horizon was invisible and the engine walked into it. Full-capture
// quiescence (2026-07-26) closes that. These two positions come straight
// from player reports and both chose a hanging/catastrophic move before
// the fix -- if either starts hanging again, the horizon has gone blind
// again (or the node budget was cut low enough to starve quiescence).
import { test, expect } from "@playwright/test";
import { GAME_URL, fenRowsToBoard } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

async function bestMoveWithSafety(page, fen, captured, floor) {
  return page.evaluate(([board, captured, floor]) => {
    const mv = getBlackMoveRuthless(board, captured, floor);
    if (!mv) return null;
    const next = board.map(r => r.slice());
    next[mv.toY][mv.toX] = mv.piece;
    next[mv.fromY][mv.fromX] = "";
    const attackers = attackersOf(next, mv.toX, mv.toY, true).length;
    const defenders = attackersOf(next, mv.toX, mv.toY, false).length;
    return { mv, hangsUndefended: attackers > 0 && defenders === 0 };
  }, [fenRowsToBoard(fen), captured, floor]);
}

test("report 2026-07-16T06:49 (queen hangs): chosen move is not an undefended hang", async ({ page }) => {
  // Before the fix this position played p(1,7)->(1,8), hanging it
  // undefended, with a score in WHITE_ESCAPE_PENALTY territory -- the
  // engine judged the position lost only because its horizon couldn't
  // see White's off-square captures. It is not lost.
  const r = await bestMoveWithSafety(page, "8-5Cq1-2P1K2p-3P4-8-8-8-1p6-5Q2", "PRNq", 10);
  expect(r).not.toBeNull();
  expect(r.hangsUndefended).toBe(false);
  expect(r.mv.score).toBeGreaterThan(-250000); // not misjudged as lost
});

test("report 2026-07-16T07:02 (M sack): chosen move is not an undefended hang", async ({ page }) => {
  // Before the fix: n(7,4)->(6,2), an undefended knight hang.
  const r = await bestMoveWithSafety(page, "8-1N6-K1C5-1Q2R3-7n-8-1Q6-8-7m", "PNqqb", 12);
  expect(r).not.toBeNull();
  expect(r.hangsUndefended).toBe(false);
});
