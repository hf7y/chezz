---
description: Nightly thorough pass -- feature work, redesigns, refactors too big for the bug sweeper, scoped by FOCUS.md
---

Read `.scheduler/FOCUS.md` first. Everything below is scoped BY that file --
if an accumulated idea in the tracker or backlog is not in service of the
current focus, write it up in the report as deferred; do not implement it
just because it is easy or already sitting there.

This command is designed to run unattended overnight, with no human
review step until the morning. When something needs a human call, defer
it with a clear note in the report AND append it to `.scheduler/QUESTIONS.md`
(see step 1 and step 5) rather than guessing.

## 1. Orient

`git log --oneline -10`, current branch state, `README.md` if one exists,
and `.scheduler/FOCUS.md`. If the previous nightly run left work in progress
(check the last report under `~/reports/chezz/`), pick up from there
rather than starting over. Also fetch the full tracker backlog with
`&status=all&type=all` (see `leaderboard/Code.gs`'s doc comment) so
nothing already resolved gets re-investigated.

**First run `npm run check-answers`.** It verifies that the file Zach writes
answers into (the scheduler's `questions/chezz.md` symlink) is byte-identical
to the `.scheduler/QUESTIONS.md` this run reads. That has silently drifted
twice — a header-only stub on 2026-07-25, and a 6-commits-behind checkout on
2026-07-27 that hid three questions from him entirely — and in both cases the
run read an empty-looking file and concluded "no answers tonight." If this
check fails, fix the channel before reading anything below it; a reply you
never saw is indistinguishable from a reply he never wrote.

**Read `.scheduler/QUESTIONS.md` and process any answers.** The user replies
to a question inline, on a line starting with `> ` (a Markdown blockquote)
directly under it — that file's own header documents the convention. For
every question that now has a `> ` answer, treat it as authoritative human
direction (same standing as `FOCUS.md`): act on it as part of tonight's
work, and if it's a standing scope/policy decision, also fold it into
`FOCUS.md` so it persists. Once you have acted on an answered question,
remove that question+answer block from `QUESTIONS.md` — git history and
tonight's report keep the record. Leave unanswered questions untouched;
never re-ask or duplicate one.

## 2. Re-verify anything a previous run touched, from scratch

Do not trust a prior run's own claims about what works -- run `npm run
check` (syntax + size + full Playwright suite) and confirm independently
before building further on top of it.

## 3. Work the feature backlog first, then backup work

Per FOCUS.md (autopilot mode, confirmed 2026-07-17): fetch
`&status=open&type=feature`, oldest first. The backlog is large (~45+
open as of 2026-07-17) -- work through it until the turn/time budget
runs low, then move to step 5; do not rush every report just to reach
zero in one night. For each report: implement it, fix it directly if
it's actually a mis-filed bug, defer it with a real reason, or skip it as
a duplicate/too-vague -- see FOCUS.md for exactly what distinguishes
those four outcomes. For anything implemented or bug-fixed: extend
`test/*.spec.mjs`, commit referencing what was built, then mark it
resolved on the tracker the same way `/bug-sweep` resolves bug reports:

```
curl -sL "$URL" -H "Content-Type: text/plain" \
  --data-raw '{"type":"resolve","timestamp":"<exact timestamp>","status":"resolved","note":"Shipped in <hash>: <one-line summary>"}'
```

(No `-X POST` — curl already POSTs when given a body, and an explicit
`-X POST` gets re-applied to the Apps Script redirect chain and breaks
the write. Never trust the POST's own response either way; confirm by
re-fetching the report's state.)

For anything deferred or skipped, the same endpoint with `"status":"open"`
plus a note (deferred) -- or leave it as-is and just explain why in the
report (skipped as duplicate/mis-filed). Commit as you complete each
feature, not all in one giant commit at the end. Once the backlog is
empty or everything in it this round was resolved/deferred/skipped, move
to FOCUS.md's backup work (the two standing open engineering questions,
or bug reports Tier 1 left open needing a human call).

**Park-by-default triage for new vision-scale ideas** (scaffold
convention, realisateur/STABILITY-MILESTONES.md, adopted 2026-07-25):
when something new arrives that is bigger than a scoped feature — a
`scheduler -i` entry in FOCUS.md's Ideas section, or a tracker report
that is really a direction rather than a change — judge it against
FOCUS.md's `## Stability milestone` bar. Required for the current bar →
it's `active`, work it. Past the bar → tag it `(parked)` (or
`(waiting: <dep>)`) with one line of why, and move on. **Never quietly
decline a `scheduler -i` from Zach** (human-directed 2026-07-25): do the
in-scope part, and anything you genuinely can't do from this repo gets a
loud entry in scheduler `BLOCKERS.md`'s `## chezz` section (its
machine-append policy allows exactly this) stating what you need widened
or decided — a decline that only lives in a report is a decline he never
agreed to.

**Also check the bug queue for `NIGHTLY:`-prefixed notes** (human-directed
2026-07-24: bug sweeps punt real-but-too-big bugs here instead of leaving
them as vague human-call items -- see `/bug-sweep`'s triage step). These
are unambiguous defects, not policy questions -- fetch `&type=bug&status=open`,
find any with a `NIGHTLY:`-prefixed note, and implement them with the same
rigor as a feature (regression test, commit, resolve on the tracker). Treat
this as part of the same backup-work tier as the feature backlog's
overflow, not a lower priority than it.

## 4. Stress-test what you built

Look for the scenarios a first pass typically misses -- edge cases, empty
states, deeper nesting/scale than the happy-path case. Fix what breaks;
note what's genuinely out of scope for tonight.

## 5. Write the report, and flag anything needing a human call

`~/reports/chezz/$(date +%Y-%m-%d).md`, and update `~/reports/chezz/LATEST.md`
to match it. Cover exactly: which feature-backlog reports got
implemented tonight (with commit references) vs. deferred (with the
blocking reason) vs. skipped (with why), what broke and got fixed, any
backup work done once the backlog was clear, and any open questions that
need a human decision. This is read once, quickly, the next time this
machine boots up -- write for that, not for completeness's own sake.

For anything that genuinely needs the user to decide — an ambiguous
policy question, a real tradeoff, a "which of these two directions" fork,
a feature you deferred pending direction — **append it to
`.scheduler/QUESTIONS.md`**, not just the report. Append only; never
overwrite or trim existing entries (including any `> ` answers). Format:
`- **YYYY-MM-DD (nightly): <question>**` followed by a short context
paragraph, then a `  > (answer inline here)` placeholder line so the
user's reply slot is obvious. The report should point at QUESTIONS.md for
these, not duplicate their full text. Don't manufacture a question just to
have an entry — a quiet night adds nothing here.

## 6. Before finishing

Confirm every meaningful change has a real commit, pushed to origin/main.
An overnight run that is not saved anywhere didn't happen. Also POST a
`sweep-status` update the same way `/bug-sweep` does (see that command's
step 6) so the live page's readout reflects tonight's run too.
