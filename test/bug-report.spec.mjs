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

// LEADERBOARD_URL is now a path relative to the page's own origin
// (hf7y/chezz#83) rather than an absolute script.google.com URL. Under this
// suite's file:// origin, a relative fetch() resolves to a file: URL, which
// Chromium's Fetch API refuses outright -- it never reaches the network
// stack, so page.route() (a network-layer hook) cannot see or answer it.
// Stubbing window.fetch in-page is the level this actually has to be mocked
// at now.
async function routePosts(page) {
  const posted = [];
  await page.exposeFunction("__recordPost", body => posted.push(body));
  await page.addInitScript(() => {
    const real = window.fetch.bind(window);
    window.fetch = (url, init = {}) => {
      if (!String(url).includes("/.netlify/functions/report")) return real(url, init);
      if (init.method === "POST") {
        window.__recordPost(JSON.parse(init.body));
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response("[]", { status: 200 }));
    };
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
