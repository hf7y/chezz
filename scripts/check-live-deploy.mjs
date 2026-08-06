// The domain-move park (FOCUS.md, "PARKED WITH A TRIGGER 2026-07-28") named
// a concrete condition under which moving the hf7y domain off its OCF
// redirect onto GitHub Pages becomes worth doing: "the nightly-builds folder
// (item 9) is live and beta testers are actually fetching builds through the
// domain." The same note insisted the trigger be "a real check, not a note
// nobody reads" -- so this asserts, on every deploy, that both domains
// actually serve nightly-builds/ right now, and fails LOUD the first time
// either one doesn't.
//
// Deliberately NOT part of `npm run check`: like check-answer-channel.mjs,
// this hits live network, and a transient blip must not block the commit
// that would fix it. Wired into the deploy workflow instead, which is where
// "can a player actually reach a build" is the thing that matters, and which
// already runs on every push to main -- so this is the "recurring" half of
// "recurring assertion" for free, no separate cron needed.
import { execFileSync } from "node:child_process";

const REPO = process.env.CHEZZ_ISSUES_REPO || "hf7y/chezz";
const LABEL = "nightly-builds-domain-down";

// Both are named explicitly in FOCUS.md's item 9 writeup as the two domains
// the folder is verified live on. hf7y.github.io is this repo's own Pages
// deploy; zach.audio is the OCF-Berkeley-hosted mirror the domain-move park
// is about -- if the OCF hop breaks, that's exactly the second milestone
// trigger the park names ("the OCF ssh key breaks... two rescues means the
// redirect is costing more than the move"), so it belongs in the same check.
export const DOMAINS = [
  { name: "hf7y.github.io", url: "https://hf7y.github.io/chezz/nightly-builds/" },
  { name: "zach.audio", url: "https://zach.audio/chezz/nightly-builds/" },
];

export async function checkDomain({ name, url }, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { redirect: "follow" });
    if (res.status !== 200) {
      return { name, url, ok: false, detail: `HTTP ${res.status}` };
    }
    return { name, url, ok: true };
  } catch (err) {
    return { name, url, ok: false, detail: err.message || String(err) };
  }
}

function findOpenIssue() {
  const out = execFileSync(
    "gh",
    ["issue", "list", "--repo", REPO, "--label", LABEL, "--state", "open",
     "--limit", "5", "--json", "number"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
  const issues = JSON.parse(out);
  return issues[0]?.number ?? null;
}

function fileBlocker(failures) {
  const body = [
    "Automated check (scripts/check-live-deploy.mjs, run from the Pages deploy",
    "workflow) found a domain that isn't serving nightly-builds/ where FOCUS.md's",
    "item 9 says it should be live:",
    "",
    ...failures.map((f) => `- ${f.name} (${f.url}): ${f.detail}`),
    "",
    "This is the trigger FOCUS.md's domain-move park names for the OCF hop",
    "specifically -- see the 'PARKED WITH A TRIGGER 2026-07-28' block. If",
    "zach.audio is the one failing, that's a live milestone signal, not just",
    "an outage to fix.",
  ].join("\n");
  execFileSync(
    "gh",
    ["issue", "create", "--repo", REPO, "--label", LABEL,
     "--title", "nightly-builds domain check failed",
     "--body", body],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
}

function closeStaleIssue(number) {
  execFileSync(
    "gh",
    ["issue", "close", String(number), "--repo", REPO,
     "--comment", "check-live-deploy: both domains serving nightly-builds/ again as of this deploy."],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
}

async function main() {
  const results = await Promise.all(DOMAINS.map((d) => checkDomain(d)));
  const failures = results.filter((r) => !r.ok);

  if (failures.length === 0) {
    console.log("check-live-deploy: OK — " + DOMAINS.map((d) => d.name).join(", ") + " all serving nightly-builds/.");
    try {
      const existing = findOpenIssue();
      if (existing) closeStaleIssue(existing);
    } catch (err) {
      // Best-effort: not being able to close a stale issue is not a reason
      // to fail a deploy that itself succeeded.
      console.log(`check-live-deploy: could not check/close a stale ${LABEL} issue: ${err.message || err}`);
    }
    process.exit(0);
  }

  console.error("\ncheck-live-deploy: A LIVE DOMAIN IS NOT SERVING nightly-builds/\n");
  for (const f of failures) console.error(`  - ${f.name} (${f.url}): ${f.detail}`);
  console.error("");

  try {
    if (!findOpenIssue()) fileBlocker(failures);
    else console.error(`check-live-deploy: an open ${LABEL} issue already exists, not filing a duplicate.`);
  } catch (err) {
    console.error(`check-live-deploy: also could not file/check a ${LABEL} issue: ${err.message || err}`);
  }

  process.exit(1);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
