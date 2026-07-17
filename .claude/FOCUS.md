<!-- Per-project "what's live right now" marker -- the Tier 2 nightly-batch
     job (.claude/commands/nightly-batch.md) reads this FIRST, before
     touching anything else, to decide what's actually in scope tonight.
     Keep it short; update by hand whenever the actual priority shifts. -->

Current focus: **autopilot mode**. The user's explicit goal (confirmed
2026-07-17) is to never have to open a Claude session for this project
again unless they want to -- players submit ideas through the in-game
chat box, and the nightly run is what turns those into shipped features,
unattended, no human review step. This supersedes the older, more
conservative default (this file used to say: analyze feature ideas but
never implement them without the user weighing in first -- they have now
weighed in, project-wide, standing until they say otherwise).

**Primary job, every night**: fetch the feature backlog
(`&status=open&type=feature`, see `leaderboard/Code.gs`'s doc comment),
and for each report, pick one of three outcomes:

1. **Implement it.** The common case for anything reasonably scoped
   (a concrete UI/gameplay/UX addition or tweak with a clear, single
   correct shape). Build it, test it (extend `test/*.spec.mjs`), commit,
   and mark it resolved on the tracker referencing the commit
   (`{"type":"resolve","timestamp":"...","status":"resolved","note":"Shipped in <hash>: ..."}`)
   -- same mechanism `/bug-sweep` already uses for bug reports.
2. **Defer it, with a real reason.** Genuinely ambiguous requests (two
   plausible, conflicting interpretations), requests that would blow the
   50KB soft target further without a clear trim elsewhere, or anything
   that reads as more of a redesign than a feature (touches core game
   rules, scoring, or the AI's search behavior) -- leave it open, add a
   note explaining what's blocking it and what would resolve the
   ambiguity, and write it up in the report. Deferring should be the
   exception, not the default outcome -- a request only needs a fully
   worked-out spec from the user if it's genuinely unclear what "done"
   means, not just because it takes real effort.
3. **Skip it.** Requests that are actually bug reports mis-filed as
   features, duplicates of something already shipped or already
   deferred, or too vague to act on even with reasonable judgment calls
   (leave a short note either way).

Backup work, when the feature backlog is empty or everything in it was
just resolved/deferred: the two standing open engineering questions --
Rook/Queen material-sufficiency (needs playtesting + some analytical
solvability work) and the index1.html size budget (currently ~74KB
against a 50KB soft target -- worth actually investigating what's
bloating it, not just raising the target) -- plus any bug reports Tier 1
left open with "needs a human call" notes (real mobile-device or
WebKit-only repros this sandbox lacks are still genuinely out of reach
here; don't force those).
