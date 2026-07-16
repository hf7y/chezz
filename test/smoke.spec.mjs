// End-to-end sanity: load the real page and drive it like a player would,
// rather than only calling internal functions directly. Catches DOM/event-
// wiring regressions the unit-style tests above can't see.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test("loads with no console or page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(GAME_URL);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test("a full-cell touch drag moves the piece", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-7K_w&floor=1&spawned=1&budget=1&maxRank=0");

  const moved = await page.evaluate(() => {
    function kingCell() { return [...document.querySelectorAll("td")].find(td => td.textContent.includes("♔")); }
    function center(el) { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }
    const el = kingCell();
    const c = center(el);
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientX: c.x, clientY: c.y }));
    document.dispatchEvent(new PointerEvent("pointermove", { ...base, clientX: c.x - c.w, clientY: c.y }));
    document.dispatchEvent(new PointerEvent("pointerup", { ...base, clientX: c.x - c.w, clientY: c.y }));
    const newKing = kingCell();
    return newKing && Math.abs(center(newKing).x - (c.x - c.w)) < 2;
  });

  expect(moved).toBe(true);
});

test("a jittery touch tap still selects (regression: ghost-glitch fix)", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-7K_w&floor=1&spawned=1&budget=1&maxRank=0");

  const selected = await page.evaluate(() => {
    const el = [...document.querySelectorAll("td")].find(td => td.textContent.includes("♔"));
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientX: cx, clientY: cy }));
    document.dispatchEvent(new PointerEvent("pointermove", { ...base, clientX: cx + 8, clientY: cy + 2 }));
    document.dispatchEvent(new PointerEvent("pointermove", { ...base, clientX: cx + 1, clientY: cy + 1 }));
    document.dispatchEvent(new PointerEvent("pointerup", { ...base, clientX: cx + 1, clientY: cy + 1 }));
    return !!document.querySelector("td[data-selected]");
  });

  expect(selected).toBe(true);
});

test("selection highlight is an inset box-shadow, not an outline (regression: overlap fix)", async ({ page }) => {
  // An outline extends past the cell's own box and can get painted over by
  // a neighboring square; box-shadow inset draws inside it instead. Locks
  // in the fix rather than just checking data-selected is present.
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-7K_w&floor=1&spawned=1&budget=1&maxRank=0");

  const style = await page.evaluate(() => {
    const el = [...document.querySelectorAll("td")].find(td => td.textContent.includes("♔"));
    const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch", isPrimary: true };
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    el.dispatchEvent(new PointerEvent("pointerup", { ...base, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    const selectedEl = document.querySelector("td[data-selected]");
    const computed = getComputedStyle(selectedEl);
    return { boxShadow: computed.boxShadow, outlineStyle: computed.outlineStyle };
  });

  expect(style.boxShadow).toContain("inset");
  expect(style.outlineStyle).toBe("none");
});

test("floor-enter animation plays on spawn/boot, not on an ordinary move", async ({ page }) => {
  await page.goto(GAME_URL);
  expect(await page.$eval("table", el => el.classList.contains("floor-enter"))).toBe(true);

  await page.evaluate(() => document.querySelector("table").classList.remove("floor-enter"));
  await page.evaluate(() => {
    for (let y = 0; y < state.board.length; y++)
      for (let x = 0; x < state.board[y].length; x++)
        if (state.board[y][x] === "K") {
          const moves = legalMovesFrom(state.board, x, y).filter(m => m.y !== 0);
          if (moves.length) makeMove(x, y, moves[0].x, moves[0].y);
          return;
        }
  });
  await page.waitForTimeout(200);
  expect(await page.$eval("table", el => el.classList.contains("floor-enter"))).toBe(false);
});

test("best rank persists across a fresh navigation (no query string)", async ({ page, context }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-4K3_w&floor=1&spawned=1&budget=1&maxRank=7");
  await page.waitForTimeout(200);

  const page2 = await context.newPage();
  await page2.goto(GAME_URL);
  await page2.waitForTimeout(200);
  const mine = await page2.$eval("#leaderboardMine", el => el.textContent);
  expect(mine).toContain("Rank 7");
});

test("captured list sits after the board in DOM order", async ({ page }) => {
  await page.goto(GAME_URL);
  const order = await page.evaluate(() => [...document.body.children].map(e => e.tagName));
  expect(order.indexOf("TABLE")).toBeLessThan(order.indexOf("P"));
});
