// Asserts, on every deploy, that a player can actually reach nightly-builds/
// through each live domain right now -- "a real check, not a note nobody
// reads". It also checks the two public game routes so a Pages artifact that
// omits either mode fails loud.
//
// The OCF/zach.audio domain-move park this check was born from is CLOSED
// (Zach, chezz#19, 2026-08-14): "it is hf7y.com/ now. no ocf no zach.audio".
// zach.audio was serving a permanent 404 and filing a nightly issue for it.
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

// hf7y.com is the public domain; hf7y.github.io is this repo's own Pages
// deploy, kept as the canary that separates "Pages build broke" from "the
// domain in front of it broke".
export const DOMAINS = [
  { name: "hf7y.com", url: "https://hf7y.com/chezz/nightly-builds/" },
  { name: "hf7y.github.io", url: "https://hf7y.github.io/chezz/nightly-builds/" },
];

export const GAME_PATHS = [
  { name: "hf7y.com narrative", url: "https://hf7y.com/chezz/" },
  { name: "hf7y.com classic", url: "https://hf7y.com/chezz/classic.html" },
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
    "workflow) found a live route that isn't serving:",
    "",
    ...failures.map((f) => `- ${f.name} (${f.url}): ${f.detail}`),
    "",
    "If hf7y.github.io is serving but hf7y.com is not, the Pages build is fine",
    "and the domain in front of it is the fault.",
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
     "--comment", "check-live-deploy: every domain is serving nightly-builds/ again as of this deploy."],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
}

async function main() {
  const results = await Promise.all([...DOMAINS, ...GAME_PATHS].map((d) => checkDomain(d)));
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

  console.error("\ncheck-live-deploy: A LIVE PAGES ROUTE IS NOT SERVING\n");
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
