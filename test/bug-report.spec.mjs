// Bug reports and feature requests share one chat box (a "Bug"/"Idea" radio
// picks `kind`) -- both post through the same endpoint, parameterized by
// kind. A one-shot prompt() used to handle bugs separately, but Chrome's
// popup blocker silently ate it for enough players that it generated its own
// bug reports; folded into the chat form since that was already
// popup-blocker-safe. Pins that each radio choice actually sends the kind
// its UI promises, since a copy/paste slip between the two would silently
// misfile every feature idea as a bug (or vice versa) with no error anywhere.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

async function routePosts(page) {
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
  return posted;
}

test("chat box posts kind: bug when the Bug radio is selected", async ({ page }) => {
  const posted = await routePosts(page);
  await page.goto(GAME_URL);
  await page.click("#featureChat summary"); // open the <details>
  await page.check('input[name="chatKind"][value="bug"]');
  await page.fill("#featureChatInput", "it broke");
  await page.click("#featureChatForm button[type=submit]");
  await page.waitForTimeout(200);
  const post = posted.find(p => p.type === "bug");
  expect(post).toBeTruthy();
  expect(post.kind).toBe("bug");
  expect(post.description).toBe("it broke");
});

test("feature-request chat box posts kind: feature (default) and echoes both bubbles", async ({ page }) => {
  const posted = await routePosts(page);
  await page.goto(GAME_URL);
  await page.click("#featureChat summary"); // open the <details>
  await page.fill("#featureChatInput", "add a thing");
  await page.click("#featureChatForm button[type=submit]");
  await page.waitForTimeout(200);
  const post = posted.find(p => p.type === "bug");
  expect(post).toBeTruthy();
  expect(post.kind).toBe("feature");
  expect(post.description).toBe("add a thing");

  const bubbles = await page.locator("#featureChatLog p").allTextContents();
  expect(bubbles[0]).toBe("add a thing");
  expect(bubbles[1]).toContain("logged");
});
