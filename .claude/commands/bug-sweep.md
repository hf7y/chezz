---
description: Fetch open Chezz bug reports, fix the mechanical ones, leave notes on the rest, commit, and mark resolved reports on the tracker
---

Run one sweep of the live Chezz bug tracker. This command is designed to run
unattended (manually, via `/loop`, or on a cron schedule) — don't block on
interactive confirmation; when something needs a human call, leave it open
with a note instead of guessing.

## 1. Fetch open reports

The tracker is a Google Apps Script endpoint (`leaderboard/Code.gs` in this
repo documents the full API). Read it with `curl`, not the WebFetch tool —
WebFetch gets stuck in a redirect loop against this endpoint (`/exec` →
`googleusercontent.com/macros/echo` → back to `/exec`), while `curl -sL`
follows it fine:

```
curl -sL "https://script.google.com/macros/s/AKfycbyjpRvPRbXlGeqqwZ2ENddLfCn52QzAM2-NSFS6B-QpmhFlVhJijQZNEV9Q7rU0MRAG/exec?scope=bugs&status=open&limit=50"
```

`scope=bugs` defaults to `&type=bug` — feature requests (`type=feature`)
don't come back unless you ask for them explicitly with `&type=feature` or
`&type=all`. That's deliberate: the bug queue is only things that must
eventually be fixed or explicitly reclassified out, not a mixed backlog of
defects and ideas.

Each report has `{timestamp, name, url, description, status, note, type}`.
The `url` is the exact in-game position (FEN/floor/budget/captured/maxRank)
the reporter was looking at when they filed it — open it in context if the
description alone isn't enough to understand the bug. Reporters pick "bug"
vs. "feature" for themselves when filing (two separate links in the game
UI), so most reports arrive already correctly classified — but read the
description anyway, since a reporter can still misjudge their own report.

## 2. Triage every report into exactly one bucket

- **Mechanical fix** — a concrete, reproducible defect with an unambiguous
  correct behavior, verifiable by running this repo's own test suite (no
  real mobile device or external service needed to confirm it).
- **Actually a feature idea, not a bug** — balance/tuning judgments (e.g.
  piece pricing), AI move-quality/"weird trade" complaints, performance/UX
  work (e.g. search caching, loading indicators), or anything filed as a
  bug that's really a design question. Reclassify it (see step 5) rather
  than leaving it in the bug queue with a note — the feature backlog isn't
  held to "must eventually resolve," so it's the right place for open-ended
  ideas to sit.
- **Needs a human call, but is a real bug** — a genuine defect where the
  correct fix isn't obvious, or you can't verify it in this sandbox (e.g.
  real mobile-browser touch behavior, no WebKit available here). Stays in
  the bug queue, open, with a note — rare in practice; most non-mechanical
  reports turn out to be the previous bucket instead.
- **Duplicate of an already-tracked issue** — matches something covered by
  an existing code comment/regression-test pin (check comments near
  relevant logic and `test/*.spec.mjs` first).

Don't resolve balance/design/feature-idea reports as "fixed" on your own
judgment, and don't implement a feature idea without the user weighing in
first — past sessions confirmed this scope explicitly rather than assuming
it repeats automatically.

## 3. Implement each mechanical fix

- Locate the relevant code (this is a single-file game in `index1.html`;
  `leaderboard/Code.gs` is the separate tracker backend).
- Write or extend a regression test in `test/*.spec.mjs` for the fix.
- **Verify the test actually catches the bug**: temporarily revert your
  fix, confirm the new test fails, then reapply the fix and confirm it
  passes. A test that passes both with and without the fix isn't proving
  anything — don't skip this step.
- Run `npm run check` (syntax + size + full Playwright suite). All tests
  must pass; the pre-commit hook will enforce this again anyway.

## 4. Commit

One commit for the sweep (or several if the fixes are unrelated enough to
tell apart in history — use judgment), following this repo's commit style:
short imperative summary line, a body explaining *why* each fix matters,
not just what changed.

## 5. Update the tracker

For each report you fixed, mark it resolved, referencing the commit hash:

```
curl -sL "$URL" -X POST -H "Content-Type: text/plain" \
  --data-raw '{"type":"resolve","timestamp":"<exact timestamp string>","status":"resolved","note":"Fixed in <hash>: <one-line summary>"}'
```

For a report that's actually a feature idea, reclassify it instead of
resolving or noting it in place — this moves it out of the bug queue into
the feature backlog, open, so it doesn't need re-triaging on every future
sweep:

```
curl -sL "$URL" -X POST -H "Content-Type: text/plain" \
  --data-raw '{"type":"resolve","timestamp":"<exact timestamp string>","status":"open","reportType":"feature","note":"<why this is an idea, not a defect>"}'
```

For a genuine bug that needs a human call on the fix itself, attach a note
but leave it in the bug queue, status open:

```
curl -sL "$URL" -X POST -H "Content-Type: text/plain" \
  --data-raw '{"type":"resolve","timestamp":"<exact timestamp string>","status":"open","note":"Needs: <what a real fix/decision would require>"}'
```

**Gotcha**: the POST response through Apps Script's redirect chain is
unreliable — it can show a fake "Page Not Found" or a false error on a
write that actually succeeded. Never trust the HTTP response body/status
from a POST here. Always confirm by re-fetching `?scope=bugs&status=open`
afterward and checking the report no longer appears (or does, if you
reopened one).

## 6. Report a summary

List: what got fixed and committed, what got reclassified as a feature (and
why), what got a note-only bug left open, and how many new reports came in
since last sweep. Don't resolve or reclassify more than a handful of
reports in one sweep without flagging anything that felt like a judgment
call in the summary, even if you didn't block on it.
