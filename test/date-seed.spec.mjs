// dateSeed pins a floor's daily puzzle to the day whose seed actually
// generated it, not whatever day the wall clock reads later -- so a session
// that crosses midnight keeps playing the floor it started, instead of the
// seed shifting out from under it mid-run.
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
