---
description: Interactive vision/triage pass -- pull live state, surface blockers and regressions, ask direct design questions, schedule decisions for nightly-batch. Does not implement game code unless explicitly told to inline.
---

This is the interactive counterpart to `/bug-sweep` and `/nightly-batch`
(both unattended). Where those two implement, `/ideate` triages,
prioritizes, and schedules -- it exists because an ordinary interactive
session tends to drift into implementing whatever's asked, which is right
for a concrete bug/feature request but wrong for open-ended
prioritization or a genuine design fork. Default posture here: surface,
ask, record, queue -- not build. The user can always say "just fix that
now" to override this for any one item; that's a normal request, not a
violation of this command.

## 1. Orient

Pull real, current state before saying anything about status:
- `git log --oneline -10`, `git status`, and diff local `main` against
  `origin/main` -- sync first if behind (stash/pop around any uncommitted
  `QUESTIONS.md` answer if one is sitting there, same as any other run).
- The live tracker, `&status=all&type=all` (see `leaderboard/Code.gs`'s
  doc comment) -- don't trust a stale count from a prior report.
- `DESIGN-NOTES.md`, `.scheduler/FOCUS.md`, `.scheduler/QUESTIONS.md` -- the
  existing priority queue and any already-decided direction. Don't re-ask
  a settled decision.
- Scheduler cross-project state, read-only: `~/Documents/Project
  Archive/scheduler/BLOCKERS.md`'s `## chezz` section, and whether the
  account-wide usage/spend picture (see prior reports/sweep.log
  `WARNING`/`spend limit` lines) explains anything that looks stalled.
  Never edit another project's files directly from here -- see step 5.

## 2. Find what's actually worth surfacing

Not everything open needs a question. Sort what you find into:
- **Urgent, small, low-ambiguity** (a likely regression, a broken
  reporting/tooling path, a stranded commit) -- flag clearly, propose the
  fix, but don't implement unless told to. These are usually not worth an
  `AskUserQuestion` -- there's only one sensible answer, just say so.
- **Real design forks** -- multiple plausible, conflicting directions, or
  a big unbuilt system several reports assume exists. These are what
  `AskUserQuestion` is for. Ground each question in real counts/quotes
  from the tracker, not vibes -- cite which reports, how many, since when.
- **Already-settled** -- matches something already in `DESIGN-NOTES.md`/
  `FOCUS.md`. Don't re-litigate; note it's unchanged and move on.

## 3. Ask, don't guess

For genuine forks, ask directly (`AskUserQuestion`, up to 4 per call,
options with real tradeoffs). Don't implement speculatively while waiting
-- the answer changes the shape of the work, not just its priority.

## 4. Record and queue, don't build

For each decision (from this session or already-settled and just being
re-confirmed):
- Write the decision **and its rationale** into `DESIGN-NOTES.md` --
  future sessions and nightly-batch need the "why," not just the "what."
  If a decision corrects or refines an earlier entry, say so explicitly
  and mark what changed rather than silently overwriting it.
- Add or update the ordered priority list in `.scheduler/FOCUS.md`'s
  PRIORITY QUEUE block, pointing back at `DESIGN-NOTES.md` for detail --
  keep FOCUS.md itself short.
- If a decision needs a follow-up the user (not nightly-batch) must
  answer -- scope, credentials, something outside this repo -- append a
  real entry to `.scheduler/QUESTIONS.md`, not just a mention in this
  session's chat output.
- **Do not write feature/game code in this step.** Implementation is
  `/nightly-batch`'s job, working the priority queue on its own schedule.
  Exception: something explicitly urgent and small the user asks you to
  just fix right now -- that's a normal request, treat it normally.

## 4.5. Watch for "vision debt" — the queue growing faster than it drains

Named 2026-07-20 (cross-project pattern, via scheduler's own repo): the
user generates ideas faster than any implementation cadence can stabilize
them, so a priority queue that only ever grows is not a sign this command
is failing — it's the expected shape of the problem. What *would* be a
failure: letting that gap stay invisible. When updating the PRIORITY
QUEUE block, if it's been growing for a while without much draining,
**say so explicitly** in this session's summary (step 6) — oldest
un-started item's age, rough queue depth trend — rather than silently
folding another item in. The user's own call whether that's fine (a
backlog is often healthy) or a sign to re-scope; this command's job is
just to make the gap visible, not to solve it unilaterally.

## 5. Cross-project proposals go through the front door

If something learned here is really about the `scheduler` project itself
(a pattern worth generalizing, an engine bug, a template other projects
should get) -- propose it, don't hand-edit `scheduler`'s files directly
from a chezz session (it may have concurrent work in flight, and this
repo isn't the owner of that one). Use its own intake mechanism:
`scheduler -i scheduler "<the proposal>"` -- same front door any project
in this ecosystem uses to suggest something to another.

## 6. Commit, push, and stop

Commit `DESIGN-NOTES.md`/`FOCUS.md`/`QUESTIONS.md` changes (expect the
pre-commit hook's full test suite to take a few minutes -- run `git
commit` with a long timeout, not `--no-verify`). Push. End with a short
summary: what's now queued and in what order, what's still open in
`QUESTIONS.md` for the user's own ritual, and explicitly confirm no game
code was touched (or, if the user asked for an inline fix along the way,
what that was and that it's separate from the scheduled queue).
