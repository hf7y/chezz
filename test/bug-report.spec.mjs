// "Report a bug" and "Suggest a feature" share one function parameterized
// by kind -- pins that each link actually sends the kind its label promises,
// since a copy/paste slip between the two would silently misfile every
// feature idea as a bug (or vice versa) with no error anywhere.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

async function reportVia(page, linkId, promptAnswer) {
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
  await page.goto(GAME_URL);
  await page.evaluate(answer => { window.prompt = () => answer; }, promptAnswer);
  await page.click(`#${linkId}`);
  await page.waitForTimeout(200);
  return posted.find(p => p.type === "bug");
}

test("\"Report a bug\" link posts kind: bug", async ({ page }) => {
  const post = await reportVia(page, "reportBugLink", "it broke");
  expect(post).toBeTruthy();
  expect(post.kind).toBe("bug");
  expect(post.description).toBe("it broke");
});

test("\"Suggest a feature\" link posts kind: feature", async ({ page }) => {
  const post = await reportVia(page, "reportFeatureLink", "add a thing");
  expect(post).toBeTruthy();
  expect(post.kind).toBe("feature");
  expect(post.description).toBe("add a thing");
});
