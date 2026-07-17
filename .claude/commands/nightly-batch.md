---
description: Nightly thorough pass -- feature work, redesigns, refactors too big for the bug sweeper, scoped by FOCUS.md
---

Read `.claude/FOCUS.md` first. Everything below is scoped BY that file --
if an accumulated idea in the tracker or backlog is not in service of the
current focus, write it up in the report as deferred; do not implement it
just because it is easy or already sitting there.

This command is designed to run unattended overnight, with no human
review step until the morning. When something needs a human call, defer
it with a clear note in the report rather than guessing.

## 1. Orient

`git log --oneline -10`, current branch state, `README.md` if one exists,
and `.claude/FOCUS.md`. If the previous nightly run left work in progress
(check the last report under `~/reports/chezz/`), pick up from there
rather than starting over. Also fetch the full tracker backlog with
`&status=all&type=all` (see `leaderboard/Code.gs`'s doc comment) so
nothing already resolved gets re-investigated.

## 2. Re-verify anything a previous run touched, from scratch

Do not trust a prior run's own claims about what works -- run `npm run
check` (syntax + size + full Playwright suite) and confirm independently
before building further on top of it.

## 3. Work the feature backlog first, then backup work

Per FOCUS.md (autopilot mode, confirmed 2026-07-17): fetch
`&status=open&type=feature`. For each report, implement it, defer it with
a real reason, or skip it as a duplicate/mis-filed/too-vague -- see
FOCUS.md for exactly what distinguishes those three outcomes. For
anything implemented: extend `test/*.spec.mjs`, commit referencing what
was built, then mark it resolved on the tracker the same way `/bug-sweep`
resolves bug reports:

```
curl -sL "$URL" -X POST -H "Content-Type: text/plain" \
  --data-raw '{"type":"resolve","timestamp":"<exact timestamp>","status":"resolved","note":"Shipped in <hash>: <one-line summary>"}'
```

For anything deferred or skipped, the same endpoint with `"status":"open"`
plus a note (deferred) -- or leave it as-is and just explain why in the
report (skipped as duplicate/mis-filed). Commit as you complete each
feature, not all in one giant commit at the end. Once the backlog is
empty or everything in it this round was resolved/deferred/skipped, move
to FOCUS.md's backup work (the two standing open engineering questions,
or bug reports Tier 1 left open needing a human call).

## 4. Stress-test what you built

Look for the scenarios a first pass typically misses -- edge cases, empty
states, deeper nesting/scale than the happy-path case. Fix what breaks;
note what's genuinely out of scope for tonight.

## 5. Write the report

`~/reports/chezz/$(date +%Y-%m-%d).md`, and update `~/reports/chezz/LATEST.md`
to match it. Cover exactly: which feature-backlog reports got
implemented tonight (with commit references) vs. deferred (with the
blocking reason) vs. skipped (with why), what broke and got fixed, any
backup work done once the backlog was clear, and any open questions that
need a human decision. This is read once, quickly, the next time this
machine boots up -- write for that, not for completeness's own sake.

## 6. Before finishing

Confirm every meaningful change has a real commit, pushed to origin/main.
An overnight run that is not saved anywhere didn't happen. Also POST a
`sweep-status` update the same way `/bug-sweep` does (see that command's
step 6) so the live page's readout reflects tonight's run too.
