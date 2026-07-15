// Regression for a reported bug: a session that crosses midnight used to get
// its score attributed to whatever day the wall clock read at submission
// time, not the day whose seed actually generated the floor being played --
// bumping a run mostly played "yesterday" onto today's leaderboard instead.
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

test("score submission tags the day the run's floor was seeded on, not the day the score posts", async ({ page }) => {
  const posted = [];
  await page.route("**/macros/s/**", async route => {
    const req = route.request();
    if (req.method() === "POST") {
      posted.push(JSON.parse(req.postData()));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
  });

  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-4K3_w&floor=1&spawned=1&budget=1&maxRank=0&dateSeed=dYESTERDAY");

  // Simulate the wall clock rolling over to a new day mid-session, after
  // this floor was already spawned under dYESTERDAY.
  await page.evaluate(() => { todayKey = () => "dTOMORROW"; });

  // Move the King up one row -- directly, like the spawn-safety tests do,
  // rather than simulating a pointer gesture -- to trigger the maxRank
  // increase that fires submitScore().
  await page.evaluate(() => {
    state.board[7][4] = "K";
    state.board[8][4] = "";
    renderBoard();
  });
  await page.waitForTimeout(200);

  const scorePost = posted.find(p => p.type === "score");
  expect(scorePost).toBeTruthy();
  expect(scorePost.dateKey).toBe("dYESTERDAY");
});
