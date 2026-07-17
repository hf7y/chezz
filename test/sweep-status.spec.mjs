// The bug-sweep automation is unattended and runs against a tracker nobody
// watches directly -- this pins that whatever it posts to scope=sweep-status
// actually surfaces on the page, so a stalled or silently-broken sweep is
// visible without having to go dig through cron logs.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

async function routeSweepStatus(page, status) {
  await page.route("**/macros/s/**", async route => {
    const req = route.request();
    if (req.method() === "GET" && req.url().includes("scope=sweep-status")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(status) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
  });
}

test("shows the last sweep's timestamp and fix count", async ({ page }) => {
  await routeSweepStatus(page, { timestamp: new Date().toISOString(), fetched: 6, fixed: 2, reclassified: 1, leftOpen: 3 });
  await page.goto(GAME_URL);
  await expect(page.locator("#sweepStatus")).toContainText("2 fixed");
  await expect(page.locator("#sweepStatus")).toContainText("just now");
});

test("handles no sweep having run yet", async ({ page }) => {
  await routeSweepStatus(page, null);
  await page.goto(GAME_URL);
  await expect(page.locator("#sweepStatus")).toContainText("no runs recorded");
});

// A stale deployment can fall through to an unrelated endpoint (e.g. the
// scores leaderboard) instead of the {timestamp,fetched,fixed,...} shape --
// this pins that malformed/wrong-shaped data falls back cleanly instead of
// rendering "Bug sweep last ran NaNd ago".
test("handles a malformed/wrong-shaped status response", async ({ page }) => {
  await routeSweepStatus(page, [{ timestamp: new Date().toISOString(), dateKey: "d7-13", name: "7a5e1b", floor: 44, rank: 350 }]);
  await page.goto(GAME_URL);
  await expect(page.locator("#sweepStatus")).toContainText("no runs recorded");
  await expect(page.locator("#sweepStatus")).not.toContainText("NaN");
});
