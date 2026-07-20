<!-- Per-project "what's live right now" marker -- the Tier 2 nightly-batch
     job (.claude/commands/nightly-batch.md) reads this FIRST, before
     touching anything else, to decide what's actually in scope tonight.
     Keep it short; update by hand whenever the actual priority shifts. -->

<!-- Standing rules from resolved human design calls (2026-07-19), folded in
     here so they persist as scope rather than living only in QUESTIONS.md:
       - Stalemate: a White-side (player) zero-legal-moves deadlock resets the
         CURRENT floor fresh; the run always stays alive (never ends, never
         restarts from floor 1). Implemented as checkStalemate()/floorStart.
       - Scripted NARRATIVE_STAGES bosses must never be capturable on move 1 --
         placeScriptedStage is capture-aware against the carried army.
       - Color scheme is monochrome (explicit, repeated reporter ask) --
         don't reintroduce a saturated/hued palette without a fresh ask. -->

<!-- Resolved human design call (2026-07-20, via QUESTIONS.md):
       - Move-into-check: disallow hanging the KING ONLY (real chess-style
         legality -- a move leaving the King capturable next turn becomes
         illegal). Other pieces stay hangable, unchanged risk/reward. NOT
         implemented yet -- this is scope for the next nightly-batch run:
         implement the legality check, add a regression test for the case
         where the King has zero non-hanging legal moves (route through the
         existing stalemate/checkmate-adjacent handling, don't strand the
         player), ship it, then this note can drop the "NOT implemented yet".
       - Cloud `/bug-sweep` (Claude Code scheduled cloud routine): PARKED
         INDEFINITELY, decided 2026-07-20. Local paced automation already
         covers this reliably; a cloud routine would need its own repo-push
         credentials (new external dependency/attack surface) and would draw
         on the same account-wide spend budget that's already the live
         constraint (see the 2026-07-20 report). Do not implement, do not
         re-ask unless something material changes. -->

<!-- QUEUED FOR NEXT BATCH (2026-07-20): migrate off `.claude/` for
     FOCUS.md/QUESTIONS.md, mirroring the scheduler project's own fix.
     Root cause (confirmed by scheduler's own controlled A/B test): the
     Edit/Write tool hard-refuses `.claude/**` writes in unattended runs as
     a "sensitive file," no approval path -- today's workaround (bash
     heredoc instead of Edit/Write) works but is fragile and has already
     cost at least one nightly run several retries. Fix: `git mv
     .claude/FOCUS.md .scheduler/FOCUS.md` and same for QUESTIONS.md (real
     files, not symlinks), update `.claude/commands/nightly-batch.md` and
     `bug-sweep.md`'s own references to these paths accordingly. This repo
     stays on `.claude/commands/` for the command files themselves (only
     scope/questions move) -- matches scheduler's own reference
     implementation of this fix. NOTE for whichever run does this: the
     scheduler repo's `schedule/chezz.conf` also needs
     `SCHEDULER_SUBDIR=".scheduler"` set afterward so its `focus/chezz.md`/
     `questions/chezz.md` symlinks re-point correctly -- that file lives in
     the scheduler project's own repo, so don't edit it from here; flag it
     in that batch's report instead (matches the cross-project boundary
     scheduler's own roadmap already documents for this exact migration --
     see scheduler's `.scheduler/FOCUS.md`, "Consolidation roadmap" axis 3,
     which already names chezz as one of the pending projects). -->

<!-- PRIORITY QUEUE (2026-07-20, human-directed vision session). Full
     rationale, tracker cluster analysis, and the reasoning behind each
     decision lives in `DESIGN-NOTES.md` (repo root) -- read that first if
     picking up any item below, this is deliberately just the ordered list.
     This OVERRIDES oldest-first triage until worked through; ordinary
     tracker triage (below) resumes for everything not covered here, and
     should keep running in parallel for reports that don't touch any of
     these items -- don't let this list starve routine mechanical fixes.
       1. Urgent, small: white pieces are likely near-invisible on light
          squares (hollow glyphs, no CSS color distinction from Black's
          solid glyphs, both inherit --cream on a light-grey square) --
          screenshot-verify and fix. Also fold bug-reporting into the
          existing feature-chat box (prompt() is blocked by Chrome's
          popup blocker for a real chunk of players -- several 2026-07-20
          reports confirm it).
       2. Move-into-check (King-only illegal-to-hang) + the `.scheduler/`
          migration -- already fully specified above, smaller in scope
          than what follows, do these first.
       3. Auto-march -- REFINED 2026-07-20, later same session: NOT an
          automatic system-driven march. It's a drag interaction: dragging
          a piece auto-steps it one square at a time toward the drag
          direction (King first; generalizes to other pieces -- Knight's
          L-shaped moves make "closest legal move to hover point" a real
          pathing problem, flagged as a follow-up, not a blocker).
          Formation-follow (pieces rank up alongside the King, strongest
          closest, naive for now) falls out of this naturally -- it is
          NOT a separate system to build. See DESIGN-NOTES.md's "Auto-march
          -- REFINED" note for the full mechanic before implementing.
       4. Terrain: build walls (boss-gated) + holes (impassable) together,
          sequenced after 3 since it wants a stable post-combat flow. Wall/
          hole COUNT is also an intentional carry-over-gate difficulty
          lever (e.g. a gate only the King can fit through, forcing a
          King+pawns-vs-Knight floor to actually require the capture) --
          see DESIGN-NOTES.md.
       5. Material-sufficiency: strengthen the tuning proxy (deeper
          search, real king-safety/tactical eval, not just material) --
          pure engineering, no playtesting needed from the user. Can run
          as backup/parallel work, doesn't block or get blocked by 3/4.
       6. King->Queen: this is a design-spec-first item, NOT
          implementation scope yet. Write the spec into `DESIGN-NOTES.md`
          (what changes, what stays, exit-row win condition, spawn/threat
          balance implications) and surface it via `QUESTIONS.md` for a
          human checkpoint before writing any game code against it --
          lowest urgency of the six, least reversible if rushed.

     NOT queued above, recorded in DESIGN-NOTES.md for a future pass --
     don't start building these without re-reading that file first: a
     neutral evasive flavor piece whose capture grants a knight-upgrade
     (Archbishop/Chancellor/Amazon/Knightrider chain), and a two-track
     graphics idea (autonomous Gemini-sprite pipeline shared with
     vkv-inventory -- NEW external dependency, needs sign-off like the
     existing sprite-replacement tracker report already deferred behind
     this gate -- vs. a custom fairy-piece font, no such gate). Also see
     QUESTIONS.md for an open "Chezz Classic" question that needs a human
     answer before any related work starts. -->

<!-- "Chezz Classic" -- part 1 RESOLVED 2026-07-20: it's the pre-
     narrative-campaign state of `main`, now pinned at a dedicated
     `chezz-classic` branch (pushed to origin, points at readable-html's
     tip, 6815336). Parts 2 (is hf7y.com/OCF-Berkeley deployable-to from
     automation) and 3 (what "own production stream" means -- full
     scheduler registration vs. lighter interactive-only work) are still
     OPEN, awaiting a human answer -- see QUESTIONS.md. Don't register
     anything with `scheduler` for this until those land. Full detail in
     DESIGN-NOTES.md. -->

Current focus: **autopilot mode**. The user's explicit goal (confirmed
2026-07-17) is to never have to open a Claude session for this project
again unless they want to -- players submit ideas through the in-game
chat box, and the nightly run is what turns those into shipped features,
unattended, no human review step. This supersedes the older, more
conservative default (this file used to say: analyze feature ideas but
never implement them without the user weighing in first -- they have now
weighed in, project-wide, standing until they say otherwise).

**Primary job, every night**: fetch the feature backlog
(`&status=open&type=feature`, see `leaderboard/Code.gs`'s doc comment) --
as of 2026-07-17 this is already ~45 open reports and growing daily, so
one night will not clear it. That's fine: work oldest-first (fairness --
nothing should silently sit forever just because newer, easier stuff
keeps landing on top), commit each one as it's done, and stop by the
report-writing step whenever the time/turn budget runs low. A handful of
real, tested, shipped features per night beats rushing all of them.
Check each report against the recent backlog dump in the previous
night's report (or the bug-tracker-backlog memory if this is the first
run) before starting, so a report already resolved/deferred last time
doesn't get redone from scratch.

For each report, pick one of four outcomes:

1. **Implement it.** The common case for anything reasonably scoped
   (a concrete UI/gameplay/UX addition or tweak with a clear, single
   correct shape). Build it, test it (extend `test/*.spec.mjs`), commit,
   and mark it resolved on the tracker referencing the commit
   (`{"type":"resolve","timestamp":"...","status":"resolved","note":"Shipped in <hash>: ..."}`)
   -- same mechanism `/bug-sweep` already uses for bug reports.
2. **It's actually a bug, not a feature.** Several reports filed/
   reclassified as `type=feature` are concrete defects in their own
   text (e.g. "pawn on b44 can't advance, highlighted yellow not
   green" reads as a real move-generation bug, not a design ask). Fix
   these directly with the same rigor as Tier 1 would (regression test
   included) rather than treating "it's in the feature queue" as a
   reason to only analyze it -- nightly-batch has the same tools and a
   much bigger turn budget than the bug sweeper does.
3. **Defer it, with a real reason.** Genuinely ambiguous requests (two
   plausible, conflicting interpretations), requests that would blow the
   50KB soft target further without a clear trim elsewhere, anything
   that reads as more of a redesign than a feature (touches core game
   rules, scoring, or the AI's search behavior), or anything that would
   require adding a NEW external service dependency (e.g. calling an
   image-generation API for sprites) -- that last category always needs
   the user's own sign-off first (new credentials/cost/attack surface),
   no exception. Leave it open, add a note explaining what's blocking it,
   and write it up in the report. Deferring should be the exception for
   ordinary requests, not the default outcome -- a request only needs a
   fully worked-out spec from the user if it's genuinely unclear what
   "done" means, not just because it takes real effort.
4. **Skip it.** Duplicates of something already shipped or already
   deferred/consolidated (several already are, e.g. the AI move-quality
   cluster under the 2026-07-15 dev-note), or too vague to act on even
   with reasonable judgment calls (leave a short note either way).

Backup work, when the feature backlog is empty or everything in it was
just resolved/deferred: Rook/Queen material-sufficiency (see priority
queue item 5 above -- decided direction is strengthening the tuning
proxy, not playtesting) and the index1.html size budget (currently
~84.7KB against a 50KB soft target, 100KB hard cap -- worth actually
investigating what's bloating it, not just raising the target; still the
user's 2026-07-14 standing call to stop and revisit rather than cut
deeper into comments) -- plus any bug reports Tier 1 left open with
"needs a human call" notes (real mobile-device or WebKit-only repros this
sandbox lacks are still genuinely out of reach here; don't force those).
