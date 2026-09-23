// Regression for a reported bug (now moot for the removed score-submission
// path below, but still real for the local "Your best" it feeds): a session
// that crosses midnight must keep a floor's dateSeed pinned to the day it
// was actually spawned on, not whatever the wall clock reads later.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test("a freshly spawned floor stamps state.dateSeed with today's key", async ({ page }) => {
  await page.goto(GAME_URL + "?floor=1&spawned=0");
  const [seed, today] = await page.evaluate(() => [state.dateSeed, todayKey()]);
  expect(seed).toBe(today);
});

test("dateSeed persists through the URL across a reload of an already-spawned floor", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-4K3_w&floor=1&spawned=1&budget=1&maxRank=0&dateSeed=dCUSTOM");
  const seed = await page.evaluate(() => state.dateSeed);
  expect(seed).toBe("dCUSTOM");
});
