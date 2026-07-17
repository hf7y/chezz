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

## 3. Push forward on whatever IS in scope per FOCUS.md

Real implementation work, not just analysis -- this tier exists for bugs
substantial enough that the fast/frequent bug sweeper (real mobile-device
or WebKit-only repros it can't verify alone, deeper investigation) isn't
the right tool for. Commit as you complete meaningful chunks; do not save
it all for one giant commit at the end. Per FOCUS.md: do not implement
feature-backlog (`type=feature`) ideas without the user weighing in first
-- analyze and summarize them in the report instead.

## 4. Stress-test what you built

Look for the scenarios a first pass typically misses -- edge cases, empty
states, deeper nesting/scale than the happy-path case. Fix what breaks;
note what's genuinely out of scope for tonight.

## 5. Write the report

`~/reports/chezz/$(date +%Y-%m-%d).md`, and update `~/reports/chezz/LATEST.md`
to match it. Cover exactly: what shipped (with commit references), what
broke and got fixed, what was deliberately deferred and why (per
FOCUS.md), a summary of any new feature-backlog ideas seen since the last
report, and any open questions that need a human decision. This is read
once, quickly, the next time this machine boots up -- write for that, not
for completeness's own sake.

## 6. Before finishing

Confirm every meaningful change has a real commit, pushed to origin/main.
An overnight run that is not saved anywhere didn't happen. Also POST a
`sweep-status` update the same way `/bug-sweep` does (see that command's
step 6) so the live page's readout reflects tonight's run too.
