// Two reports pull in opposite directions and both have to hold:
//   - 2026-07-14T19:34:16 (+ 2 dupes): a finger drifting off the board
//     mid-drag starts a native text-selection/search gesture on mobile.
//     Fixed by blocking selection page-wide.
//   - 2026-07-20T17:53:37: "text highlighting is blocked on the entire
//     page" -- that fix also made readable prose uncopyable.
// The board and its surrounds stay unselectable; the text panels below it
// (which are not drag-drift targets) get selection back.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

async function userSelect(page, selector) {
  return page.evaluate(sel => getComputedStyle(document.querySelector(sel)).userSelect, selector);
}

test("the board and the page around it stay unselectable", async ({ page }) => {
  for (const sel of ["body", "table", "h1"]) {
    expect(await userSelect(page, sel), `${sel} should not be selectable`).toBe("none");
  }
});

test("the text panels below the board are selectable again", async ({ page }) => {
  for (const sel of ["#instructions", "#leaderboard", "#featureChat", "#changelog", "#sweepStatus", "#appVersion"]) {
    expect(await userSelect(page, sel), `${sel} should be selectable`).toBe("text");
  }
});

test("text inside a panel is selectable, not just the panel box", async ({ page }) => {
  await page.evaluate(() => { document.getElementById("instructions").open = true; });
  const inner = await page.evaluate(() =>
    getComputedStyle(document.querySelector("#instructions p")).userSelect);
  expect(inner).toBe("text");
});
