// "Your best" renders as a shareable link to the exact position the best
// was reached in (tracker 2026-07-15T18:08:33.108Z). Only a same-page
// "?..." query string is ever linkified -- anything else in localStorage
// falls back to plain text.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("a stored best with a position URL renders as a link with Rank text", async ({ page }) => {
  const link = await page.evaluate(() => {
    localStorage.setItem("chezzBestScore", JSON.stringify({ rank: 12, floor: 3, url: "?fen=8-8-8-8-8-8-8-8-4K3_w&floor=3" }));
    state.maxRank = 0;
    renderMyBest();
    const a = document.querySelector("#leaderboardMine a");
    return a ? { href: a.getAttribute("href"), text: a.textContent } : null;
  });
  expect(link).not.toBeNull();
  expect(link.text).toBe("Rank 12 (3)");
  expect(link.href).toContain("?fen=");
});

test("a best without a URL (or with a non-query URL) stays plain text", async ({ page }) => {
  for (const url of [undefined, "https://example.com/evil"]) {
    const result = await page.evaluate((url) => {
      const entry = { rank: 5, floor: 2 };
      if (url) entry.url = url;
      localStorage.setItem("chezzBestScore", JSON.stringify(entry));
      state.maxRank = 0;
      renderMyBest();
      const el = document.getElementById("leaderboardMine");
      return { hasLink: !!el.querySelector("a"), text: el.textContent };
    }, url);
    expect(result.hasLink).toBe(false);
    expect(result.text).toBe("Rank 5 (2)");
  }
});

test("reaching a new best stores the current position query string", async ({ page }) => {
  const best = await page.evaluate(() => {
    localStorage.removeItem("chezzBestScore");
    state.maxRank = 41; // pretend the King just climbed somewhere new
    updateUrl(); // same ordering as the real move flow: URL first, then render
    renderMyBest();
    return JSON.parse(localStorage.getItem("chezzBestScore"));
  });
  expect(best.rank).toBe(41);
  expect(best.url.startsWith("?")).toBe(true);
  expect(best.url).toContain("fen=");
});
