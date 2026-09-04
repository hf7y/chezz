// report.js -- the in-game report channel, backed by GitHub Issues.
//
// Replaces the Apps Script at leaderboard/Code.gs (hf7y/chezz#83). It keeps
// that endpoint's ?scope= interface exactly, so index1.html changes one URL
// constant and nothing else.
//
// THE CREDENTIAL LIVES HERE AND ONLY HERE. A browser cannot hold a GitHub
// token -- it ships to every player -- which is the entire reason a server
// exists in this path. GITHUB_ISSUE_TOKEN is set in Netlify's environment,
// fine-grained to hf7y/chezz with issues:write, and is never echoed.
//
// Reads are proxied rather than sent straight to api.github.com from the
// page: this repo is public so the browser COULD read it unauthenticated,
// but that is 60 requests/hour per IP shared across every player behind one
// NAT. Proxying spends the token's 5000/hour instead.

const REPO = "hf7y/chezz";
const LABEL = "player-report";
const API = "https://api.github.com";

const MAX_DESCRIPTION = 4000;
const MAX_TITLE = 72;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function gh(path, token, init = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "chezz-report-function",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

// An issue carries the report's fields in a fenced block so the round trip
// survives: what the page sent is what a later GET renders, rather than a
// paragraph someone has to parse back.
function issueBody({ name, url, kind, description }) {
  return [
    description,
    "",
    "---",
    `- player: \`${name}\``,
    `- build: ${url}`,
    `- kind: ${kind}`,
    "",
    "_Filed from the in-game report box._",
  ].join("\n");
}

function toEntry(issue) {
  const kind = issue.labels.some(l => (l.name || l) === "idea") ? "feature" : "bug";
  const player = /- player: `([0-9a-f]{6})`/.exec(issue.body || "");
  const build = /- build: (\S+)/.exec(issue.body || "");
  return {
    timestamp: issue.created_at,
    name: player ? player[1] : "",
    url: build ? build[1] : issue.html_url,
    description: issue.title,
    status: issue.state === "closed" ? "resolved" : "open",
    note: "",
    type: kind,
    issue: issue.number,
  };
}

export default async (req) => {
  const token = Netlify.env.get("GITHUB_ISSUE_TOKEN");
  const scope = new URL(req.url).searchParams;

  // FAILS LOUDLY. A missing credential must say so, not accept a report and
  // drop it -- silently swallowing reports is the failure this replaces.
  if (!token) {
    return json({ ok: false, error: "GITHUB_ISSUE_TOKEN is not set on this site" }, 503);
  }

  if (req.method === "POST") {
    let payload;
    try {
      // The page sends text/plain to dodge a CORS preflight, so the body is
      // JSON in a text content type rather than application/json.
      payload = JSON.parse(await req.text());
    } catch {
      return json({ ok: false, error: "body is not JSON" }, 400);
    }

    const description = String(payload.description || "").trim();
    if (!description) return json({ ok: false, error: "description is required" }, 400);
    if (description.length > MAX_DESCRIPTION) {
      return json({ ok: false, error: "description too long" }, 413);
    }

    const kind = payload.kind === "idea" ? "idea" : "bug";
    const name = /^[0-9a-f]{6}$/.test(String(payload.name || "")) ? payload.name : "unknown";
    // The build URL is echoed into the issue, so it is not taken on trust.
    const build = String(payload.url || "").startsWith("http")
      ? String(payload.url).slice(0, 300)
      : "(not supplied)";

    const firstLine = description.split("\n")[0];
    const title = firstLine.length > MAX_TITLE
      ? `${firstLine.slice(0, MAX_TITLE - 1)}…`
      : firstLine;

    const res = await gh(`/repos/${REPO}/issues`, token, {
      method: "POST",
      body: JSON.stringify({
        title,
        body: issueBody({ name, url: build, kind, description }),
        labels: [LABEL, kind],
      }),
    });

    if (!res.ok) {
      // Never surface GitHub's response verbatim; it can name the token.
      return json({ ok: false, error: `GitHub refused the report (${res.status})` }, 502);
    }
    const issue = await res.json();
    return json({ ok: true, issue: issue.number, url: issue.html_url });
  }

  if (req.method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);

  if (scope.get("scope") === "sweep-status") {
    const res = await gh(
      `/repos/${REPO}/issues?state=closed&labels=${LABEL}&per_page=100&sort=updated`,
      token,
    );
    if (!res.ok) return json({ ok: false, error: "unreadable" }, 502);
    const closed = (await res.json()).filter(i => !i.pull_request);
    if (!closed.length) return json({});
    return json({ timestamp: closed[0].closed_at || closed[0].updated_at, fixed: closed.length });
  }

  if (scope.get("scope") === "bugs") {
    const want = scope.get("status") || "resolved";
    const type = scope.get("type") || "all";
    const limit = Math.min(Number(scope.get("limit")) || 20, 100);
    const state = want === "all" ? "all" : want === "resolved" ? "closed" : "open";

    const res = await gh(
      `/repos/${REPO}/issues?state=${state}&labels=${LABEL}&per_page=100&sort=updated`,
      token,
    );
    if (!res.ok) return json({ ok: false, error: "unreadable" }, 502);

    let entries = (await res.json()).filter(i => !i.pull_request).map(toEntry);
    if (type !== "all") entries = entries.filter(e => e.type === type);
    return json(entries.slice(0, limit));
  }

  return json({ ok: false, error: "unknown scope" }, 400);
};
