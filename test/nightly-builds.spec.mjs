// Priority queue item 9 (FOCUS.md): a standing static folder + index page
// for over-cap chezz-classic ports kept rather than merged or discarded.
// Static-only, no build system -- these tests load the folder's files
// straight off disk the same way test/helpers.mjs's GAME_URL does for the
// game itself.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NIGHTLY_BUILDS_DIR = path.join(root, "nightly-builds");
const INDEX_URL = "file://" + path.join(NIGHTLY_BUILDS_DIR, "index.html");
const MANIFEST_PATH = path.join(NIGHTLY_BUILDS_DIR, "manifest.js");

test("manifest.js sets window.NIGHTLY_BUILDS to an array", async ({ page }) => {
  await page.goto(INDEX_URL);
  const builds = await page.evaluate(() => window.NIGHTLY_BUILDS);
  expect(Array.isArray(builds)).toBe(true);
});

test("with an empty manifest, the index page says so instead of showing nothing", async ({ page }) => {
  await page.goto(INDEX_URL);
  await expect(page.locator("#list")).toContainText("No builds published yet");
});

test("a manifest entry renders as a link with its label, date, and note", async ({ page }) => {
  // manifest.js is loaded via <script src>, which runs after any
  // addInitScript and would clobber a value set that way -- route the
  // request itself instead so the fixture is what actually loads.
  await page.route("**/manifest.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.NIGHTLY_BUILDS = [" +
      "{ date: '2026-08-06', label: 'pawn-scarcity overage build', file: '2026-08-06-pawn-scarcity.html', note: '108KB, over the 100000B classic cap' }" +
      "];",
  }));
  await page.goto(INDEX_URL);
  const item = page.locator("#list li").first();
  await expect(item.locator("a")).toHaveText("pawn-scarcity overage build");
  await expect(item.locator("a")).toHaveAttribute("href", "2026-08-06-pawn-scarcity.html");
  await expect(item.locator(".meta")).toContainText("2026-08-06");
  await expect(item.locator(".meta")).toContainText("108KB, over the 100000B classic cap");
});

test("a missing/malformed manifest fails loud in the UI, not silently as an empty list", async ({ page }) => {
  await page.route("**/manifest.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "// simulates manifest.js failing to load or being overwritten with junk",
  }));
  await page.goto(INDEX_URL);
  await expect(page.locator("#list")).toContainText("Couldn't load the build list");
});

test("the real manifest.js file on disk is well-formed", () => {
  const src = fs.readFileSync(MANIFEST_PATH, "utf8");
  expect(src).toContain("window.NIGHTLY_BUILDS =");
  // eslint-disable-next-line no-new-func -- static repo file, not user input
  const run = new Function("window", src + "\nreturn window.NIGHTLY_BUILDS;");
  const builds = run({});
  expect(Array.isArray(builds)).toBe(true);
});
