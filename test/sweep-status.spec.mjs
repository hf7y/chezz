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
