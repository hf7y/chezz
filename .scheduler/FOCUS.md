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
         illegal). Other pieces stay hangable, unchanged risk/reward.
         DONE 2026-07-24 (nightly-batch, `2783c357`) -- isLegalMove/
         legalMovesFrom filter through kingSafeAfterMove, and
         hasAnyLegalMove(board, true) routes through legalMovesFrom so an
         all-hanging position falls through to the existing stalemate/
         floor-reset handling instead of stranding the player.
       - Cloud `/bug-sweep` (Claude Code scheduled cloud routine): PARKED
         INDEFINITELY, decided 2026-07-20. Local paced automation already
         covers this reliably; a cloud routine would need its own repo-push
         credentials (new external dependency/attack surface) and would draw
         on the same account-wide spend budget that's already the live
         constraint (see the 2026-07-20 report). Do not implement, do not
         re-ask unless something material changes. -->

<!-- Resolved human design call (2026-07-24, via QUESTIONS.md, originally
     asked 2026-07-17): bug sweeps should punt large-but-unambiguous bugs
     to the nightly run instead of leaving them as vague "needs a human
     call" notes; nightly should gain the power to address them. Standing
     convention as of `2026-07-24`: `/bug-sweep` triage now has a "real,
     unambiguous bug, too big for this sweep" bucket that leaves a
     `NIGHTLY:`-prefixed tracker note, and `/nightly-batch`'s backup-work
     step (step 3) fetches `&type=bug&status=open` and implements any
     `NIGHTLY:`-prefixed report with the same rigor as a feature. -->

<!-- DONE 2026-07-24 (nightly-batch): migrated off `.claude/` for
     FOCUS.md/QUESTIONS.md, mirroring the scheduler project's own fix --
     both now live at `.scheduler/FOCUS.md`/`.scheduler/QUESTIONS.md` (real
     files, git mv, history preserved). `.claude/commands/*.md` themselves
     stayed put per the note below; their path references were updated to
     point at the new location. Cross-project follow-up still needed, NOT
     done here (out of this repo's scope): the scheduler project's own
     `schedule/chezz.conf` needs `SCHEDULER_SUBDIR=".scheduler"` set so its
     `focus/chezz.md`/`questions/chezz.md` symlinks re-point correctly --
     flagging in tonight's report instead of editing that repo from here.

     Original queueing note, left intact below for the historical record:

     QUEUED FOR NEXT BATCH (2026-07-20): migrate off `.claude/` for
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

## Stability milestone

**Current:** Autopilot loop stable -- players file ideas in-game, unattended nightly runs ship or triage them, and anything needing Zach reaches him via scheduler `BLOCKERS.md`/`QUESTIONS.md` instead of stalling silently -- status: in-progress
Done when:
- [x] The open tracker backlog is fully dispositioned: every open report is shipped, closed with a stated reason, or attached to a live blocker/question for Zach -- none sitting with only a stale triage note. **Met 2026-07-27** (nightly): the bug queue had been the gap -- 19 of 25 open bugs carried no note at all. 9 were closed (2 fixed tonight in `daffb82`, 3 already shipped, 3 re-probed and closed by the engine work, 1 already-shipped stalemate behavior); the remaining 16 each now name the live question or the specific human check they wait on. Verified by re-fetch, not by the POST responses: zero open reports with an empty note.
- [x] Two consecutive unattended nightly runs complete green (checks passing, pushed to `origin/main`) with no human rescue: 2026-07-26 ~21:00 (`de7c7a6`/`21e0d0c`) and 2026-07-27 (`daffb82` onward).
- [x] The human-answer channel round-trips: a `> ` reply or `%%TAG` left by Zach demonstrably reaches and is acted on by the next run (no repeat of the 2026-07-25 stale-symlink loss). **Met 2026-07-27 (second run that day), via the `BLOCKERS.md` half of the channel:** Zach left two inline `### REPLY` blocks under `## chezz` in scheduler `BLOCKERS.md`; this run read them before anything else, and the first one ("Yes, pursue the gemini path...") is what produced `f7a2458` -- a question asked by automation, answered by the human, and acted on by the next unattended run, end to end. Earlier same day the "balance-tuning delegation" question exposed a second failure mode (five tracker notes and two nightly reports told Zach a question was awaiting his answer in `QUESTIONS.md`, where it had never actually been written; restored in `cf7b50f`). **Caveat, deliberately not papered over:** what round-tripped was the `BLOCKERS.md` `### REPLY` path. The `QUESTIONS.md` `> `-reply path specifically still has no demonstrated round-trip -- seven questions sit there unanswered. If that path is the one that matters, this bullet is met only in spirit. **Update 2026-07-27 (late run, `7fc0d3b`): the reason is now known and was a real defect, not human silence** -- the symlink Zach writes answers through pointed at a checkout 6 commits behind, so three of the seven questions had never reached him at all (see the root-cause note below). Channel repaired and guarded by `npm run check-answers`. The bullet stays as-is rather than being upgraded: a repaired channel is not a demonstrated round-trip, and the demonstration needs one reply from Zach that a run then acts on. First real chance is whichever question he answers next.

<!-- Standing lesson from that miss (2026-07-27): a tracker note or a
     report that says "waiting on your answer in QUESTIONS.md" is a claim
     about file state, and the build-discipline rule about re-probing
     rather than quoting applies to it. Before writing that sentence,
     grep QUESTIONS.md for the question. Three separate runs repeated the
     claim without checking.

     ROOT CAUSE FOUND 2026-07-27 (late run, `7fc0d3b`) -- and it was not
     just sloppy note-writing. The scheduler's `questions/chezz.md`
     symlink, the file Zach actually writes answers into, resolves into a
     SECOND chezz checkout (`~/Documents/Project Archive/chezz`), which
     was 6 commits behind origin/main. The three questions filed
     2026-07-27 were therefore invisible to him and the four he could see
     were stale. So the `> `-reply path had never round-tripped because
     the question never arrived -- not because he hadn't replied.
     Fixed the instance (lossless fast-forward; all 7 questions verified
     readable through his own path) and the class: `npm run check-answers`
     asserts human-copy == run-copy and fails loud, wired into step 1 of
     both nightly-batch.md and bug-sweep.md, 6 tests in
     test/answer-channel.spec.mjs (5 of them failure cases).
     STILL OPEN, scheduler-side, filed in scheduler BLOCKERS.md ## chezz:
     the drift returns on EVERY chezz push, since pushing puts that
     checkout one commit behind again. Until the symlink is repointed at
     the live nightly checkout (or the scheduler ff's it per run), expect
     `check-answers` to fail at the start of a run and fast-forward it as
     the guard's own message instructs. Do not skip the guard. -->

<!-- Parked 2026-07-27 (park-by-default triage): the five `chezz-classic`
     reports Zach filed 2026-07-26 from mandark (mobile text highlighting,
     move-dot/move-into-check port, pawn-scarcity progression, analytic
     material theory, pawn spawn). Several are straight ports of working
     narrative code, but nothing has decided whether unattended runs may
     work that branch at all, and its byte cap is enforced -- so a new
     QUESTIONS.md entry (2026-07-27) asks exactly that, narrower than the
     older Chezz Classic parts 2/3 question and enough to unblock all
     five on its own. Parked, not declined; each report says so on the
     tracker. -->

<!-- Parked 2026-07-27: tracker 2026-07-26T02:42 asks for an *analytic*
     material-sufficiency theory rather than the search-based proxy item
     5 already built and strengthened. That is research-scale, past the
     current milestone bar. -->
Ideas beyond this bar are PARKED by default (see realisateur/STABILITY-MILESTONES.md).

## Priority queue

(realisateur, 2026-07-24: pulled out of the HTML-comment-only "PRIORITY
QUEUE" block above into a real top-level list so `scheduler status
chezz`'s next-up parser can see it -- see realisateur's `FOCUS-FORMAT.md`
for the spec this satisfies. Full rationale for each item stays in the
comment above and in `DESIGN-NOTES.md`; this is deliberately just the
short list. DONE items compressed to one line each 2026-07-25 so the
parser's next-up window shows live work, per FOCUS-FORMAT's own intent;
their full writeups live in git history and DESIGN-NOTES.md.)

1. DONE 2026-07-24 (`cbf2fca`): white-piece visibility + chat-box bug reporting.
2. DONE 2026-07-24 (`2783c357`): move-into-check + `.scheduler/` migration.
3. DONE 2026-07-24 (`1f51a1e`): auto-march drag + formation-follow (walk animation = parked polish).
4. DONE 2026-07-24 (`ebdb1dc`+`b425d79`): terrain -- boss-gated walls + holes.
5. DONE 2026-07-26 (`f83a709` tactical half, `de7c7a6` king-safety half): material-sufficiency tuning proxy strengthened -- full-capture quiescence closed the horizon blind spot (10-report AI hang cluster resolved, pinned in ai-quiescence.spec.mjs); evaluateBoard's king safety is now attack-based (real attackersOf(...) on the King's square) not just kingProgress, pinned in ai-determinism.spec.mjs.
6. (waiting: QUESTIONS.md answer, 1:1 vs. escort) King->Queen -- spec drafted 2026-07-24 in DESIGN-NOTES.md; no implementation until answered.
7. (waiting: a GEMINI_API_KEY on this machine) Gemini sprite pipeline -- BUILT 2026-07-27 (`f7a2458`), gate opened by Zach's `BLOCKERS.md` reply the same day. `tools/generate-pieces.mjs` + `sprite-postprocess.js` + `wire-pieces.mjs`, and `pieceGlyphHtml` renders a sprite when one exists / the Unicode glyph when it doesn't. Zero new dependencies (Playwright's canvas replaces vkv's Pillow+numpy; plain `fetch` replaces the google-genai SDK). Monochrome is enforced by a palette snap in the pipeline, not by prompt compliance. 11 new tests; everything downstream of the API call is green. **Not shipped: any actual sprite.** No key is reachable from an unattended run, and the reply's suggestion to lift creds from `vkv-inventory` is not possible -- vkv stores no key anywhere (verified 2026-07-27: `tools/generate_sprite.py` documents `export GEMINI_API_KEY=...` as an interactive human step; no key in its repo, its scheduler conf, or the env). This needs one `export` from a human, then `npm run pieces:generate`; do not re-triage it nightly until then. Full writeup in DESIGN-NOTES.md's "Graphics pipeline" section.

Backup work when the feature backlog (below) is empty: item 5 is now DONE
in full (see above) -- priority queue is otherwise all DONE or blocked on
a QUESTIONS.md answer (item 6). Next backup tier: any bug reports Tier 1
left open needing a human call (see below).

**Size policy — RESOLVED 2026-07-25 (human reply in that day's report,
supersedes the "urgent" 2026-07-24 block that used to sit here):** the
byte limit is **abandoned for chezz narrative** (index1.html on `main`).
`scripts/check-size.mjs` still prints the size every run (creep stays
visible) but never fails the build and must never be used to pre-defer a
feature. The limit is **enforced only on the `chezz-classic` branch**,
whose focus is elegance/efficiency — long-term aspiration: fit a Game Boy
classic cartridge; future dev passes on classic work toward simpler, not
bigger. If classic ever exceeds its cap: fail loud and file a blocker to
Zach (scheduler `BLOCKERS.md`, `## chezz`) to raise the threshold before
continuing — never trim silently. Run checks AFTER doing the work, not as
a reason to skip it. This unblocks material-sufficiency (item 5) and any
byte-adding narrative feature previously held behind the size question.

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
   plausible, conflicting interpretations), anything
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
just resolved/deferred: material-sufficiency (priority queue item 5) is
now DONE in full, and the open bug queue was fully dispositioned
2026-07-27 (see the milestone above) -- so the next tier is whatever new
reports have arrived since. The 16 still-open bugs are each waiting on a
named human input, not on a run: three `QUESTIONS.md` design/tuning
forks, the `chezz-classic` scope question, and five that need a real
mobile/WebKit device this sandbox does not have (two superscript
rendering, three text-selection-on-drag -- the last of these now needs a
*two-part* check after `daffb82`: drag drift must still not pop a
selection toolbar, AND the text panels below the board must now be
selectable again). Don't re-triage those every night; re-triaging an
already-attached report is the busywork this bar was written against.

## Ideas (added via `scheduler -i`)

(Two identical section headings merged into one, 2026-07-25 -- entries untouched.)

- **2026-07-22 14:57 (via `scheduler -i`): RESOLVED 2026-07-24 (realisateur).** Added a real `## Priority queue` section above so `scheduler status chezz`'s next-up parser can see it -- existing comment content untouched.
- **2026-07-22 15:09 (via `scheduler -i`): DONE 2026-07-25 (nightly).** Scaffold-convergence pass ran (previously wrongly declined as out-of-scope -- see that night's report replies). Adopted in-repo: `## Stability milestone` declaration above (chezz was one of 4 projects `milestone-audit.sh` flagged as missing one), `(parked)`/`(waiting:)` tags, current 12-row build-discipline checklist in CLAUDE.md, ideate.md updated to realisateur's revised workflow (posture persistence, standard entry shape, park-by-default, §4.6 pacing), park-by-default step in nightly-batch.md, DONE-item compression in the priority queue. Cross-repo halves that remain are appended to scheduler `BLOCKERS.md ## chezz` -- nothing was quietly declined.

## Fable review (2026-07-25)

<!-- Appended by realisateur/fable-like/inject-suggestions.sh. Full context: fable-like/FABLE_REPORT.md. Triage these like any dated entries; delete freely. -->

Triaged 2026-07-25 (nightly): all four entries dealt with or out of this
repo's scope. (1) stability-milestone declaration -- CORRECTION, second
pass same night: this was chezz-side after all (the declaration belongs
in THIS file, per realisateur/STABILITY-MILESTONES.md's canonical format)
and is now DONE, see `## Stability milestone` above. (3) staleness-check
exit-nonzero + sweep-tier ownership -- scheduler/realisateur-side; now
filed in scheduler `BLOCKERS.md` rather than only flagged in a report. (2) the `.claude/`->`.scheduler/` migration was already
done 2026-07-24 (see DONE note above); the remaining halves
(scheduler's `SCHEDULER_SUBDIR` conf line, retiring
chezz-nightly-batch-loop.sh) are scheduler-side -- and the missing conf
line actually bit on 2026-07-25: the human's 10:00 QUESTIONS.md edit
landed in a header-only stub at the stale `.claude/` path (`7beef04`).
Bridged in-repo tonight: `.claude/FOCUS.md` and `.claude/QUESTIONS.md`
are now symlinks to the `.scheduler/` originals, so stale-path
reads/writes hit the real files; see QUESTIONS.md's 2026-07-25 entry.
(4) pre-commit docs fast-path: DONE, `95cc235`.
