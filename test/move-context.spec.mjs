// A bug report carries the position but not how the position was reached,
// so "this sacrifice was illogical" arrived with no sacrifice to look at
// (tracker 2026-07-20T17:51:44: "pass better context in bug reports so you
// can see move context. perhaps last 5 moves (via url)"). The last few
// plies now ride the URL, which is exactly what the chat box submits.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("square labels use the board's own file letters and absolute ranks", async ({ page }) => {
  const labels = await page.evaluate(() => {
    state.floor = 1;
    const floor1 = [squareLabel(0, 8), squareLabel(4, 8), squareLabel(7, 1)];
    state.floor = 3; // ranks keep climbing across floors, same as currentKingRank
    return { floor1, floor3: squareLabel(4, 8) };
  });
  // Row 8 is the bottom rank of floor 1; row 1 is one below the exit row.
  expect(labels.floor1).toEqual(["a1", "e1", "h8"]);
  expect(labels.floor3).toBe("e17");
});

test("a White move lands in the URL as a from-to pair with the moving piece", async ({ page }) => {
  const search = await page.evaluate(async () => {
    loadFen("8-8-8-8-8-8-8-8-4K3_w");
    state.floor = 1; state.spawned = true; state.moveLog = [];
    await makeMove(4, 8, 4, 7); // King steps up a rank, nothing to capture
    return location.search;
  });
  expect(search).toContain("last=Ke1-e2");
});

test("a capture is marked with x, and Black's reply is logged too", async ({ page }) => {
  const log = await page.evaluate(async () => {
    // A Black rook the King can take, plus a knight left alive so Black
    // actually has a reply to record after the capture.
    loadFen("8-8-8-1n6-8-8-8-4r3-4K3_w");
    state.floor = 1; state.spawned = true; state.moveLog = [];
    await makeMove(4, 8, 4, 7);
    return state.moveLog;
  });
  expect(log[0]).toBe("Ke1xe2");
  expect(log.length).toBe(2);
  expect(log[1].startsWith("n")).toBe(true);
});

test("the log keeps only the last 5 plies", async ({ page }) => {
  const log = await page.evaluate(() => {
    state.floor = 1;
    state.moveLog = [];
    for (let i = 0; i < 9; i++) recordMove("P", 0, 8, 0, 7, "");
    return state.moveLog;
  });
  expect(log.length).toBe(5);
});

test("the move log round-trips through the URL, so back/forward rewinds it", async ({ page }) => {
  const restored = await page.evaluate(() => {
    state.floor = 1;
    state.moveLog = ["Ke1-e2", "pd9-d8"];
    updateUrl();
    const withLog = location.search;
    state.moveLog = ["wiped"];
    loadFromUrl();
    return { withLog, log: state.moveLog };
  });
  expect(restored.withLog).toContain("last=");
  expect(restored.log).toEqual(["Ke1-e2", "pd9-d8"]);
});

test("a position URL with no move log yet leaves the param off entirely", async ({ page }) => {
  const search = await page.evaluate(() => {
    state.moveLog = [];
    updateUrl();
    return location.search;
  });
  expect(search).not.toContain("last=");
});
