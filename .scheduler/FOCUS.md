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
- [x] The human-answer channel round-trips: a `> ` reply or `%%TAG` left by Zach demonstrably reaches and is acted on by the next run (no repeat of the 2026-07-25 stale-symlink loss). **Met 2026-07-27 (second run that day), via the `BLOCKERS.md` half of the channel:** Zach left two inline `### REPLY` blocks under `## chezz` in scheduler `BLOCKERS.md`; this run read them before anything else, and the first one ("Yes, pursue the gemini path...") is what produced `f7a2458` -- a question asked by automation, answered by the human, and acted on by the next unattended run, end to end. Earlier same day the "balance-tuning delegation" question exposed a second failure mode (five tracker notes and two nightly reports told Zach a question was awaiting his answer in `QUESTIONS.md`, where it had never actually been written; restored in `cf7b50f`). **Caveat, deliberately not papered over:** what round-tripped was the `BLOCKERS.md` `### REPLY` path. The `QUESTIONS.md` `> `-reply path specifically still has no demonstrated round-trip -- seven questions sit there unanswered. If that path is the one that matters, this bullet is met only in spirit. **Update 2026-07-27 (late run, `7fc0d3b`): the reason is now known and was a real defect, not human silence** -- the symlink Zach writes answers through pointed at a checkout 6 commits behind, so three of the seven questions had never reached him at all (see the root-cause note below). Channel repaired and guarded by `npm run check-answers`. The bullet stays as-is rather than being upgraded: a repaired channel is not a demonstrated round-trip, and the demonstration needs one reply from Zach that a run then acts on. First real chance is whichever question he answers next. **UPGRADED 2026-07-28 -- the `QUESTIONS.md` `> `-reply path has now round-tripped, on the repaired channel, for real.** Zach answered three of the questions inline (balance-tuning delegation: yes + document it as scholarship; `chezz-classic`: yes, port them in, keep-don't-merge over-cap builds; screenshots: park, the URL is the right place), and this session folded all three into scope -- see the two RESOLVED blocks and priority queue items 8/9/10. **One caveat, deliberately not papered over, and it is a NEW failure mode rather than the old one:** the answers reached the repo and were committed by the scheduler's reactive sweep (`3cf830e`, 10:15) -- but that commit sat UNPUSHED, and chezz's nightly resets its dedicated clone `--hard` to origin, so the next unattended run would have re-triaged all three as unanswered for a third consecutive night. It was caught by hand in an interactive session, not by any guard. So the human->repo half of the channel is demonstrated; the repo->origin->dispatch half still has a hole that only a human happened to notice. Filed scheduler-side 2026-07-28 (`8c94eff` in scheduler's own FOCUS.md) asking whether the ~30-minute sweeper can catch its own missed push; leading unverified hypothesis is that chezz pushes over the `github-chezz-deploy:` SSH alias and the sweeper has no key it can reach, so `focus-commit` dies at the push into a stderr with no reader.

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
     SUPERSEDED 2026-07-29 for the questions half -- see the block below.
     The paragraph that used to sit here told runs to fast-forward the
     symlinked checkout when `check-answers` failed; that remedy still
     applies to FOCUS.md, but there is no longer a QUESTIONS.md symlink to
     drift. -->

<!-- ANSWER CHANNEL: QUESTIONS ARE GITHUB ISSUES NOW (2026-07-28, human-
     directed: "move the full chezz over to test the githubs issues
     pipeline"; reaffirmed 2026-07-29 in scheduler BLOCKERS.md -- "new
     decision is to move the entire ecosystem over to github issues. thanks
     chezz for being first to the suggestion"). chezz is the ECOSYSTEM
     PILOT for this; other projects follow.
       - ask:     `scheduler ask chezz "<question>"` -> a `question`-labelled
                  issue on `hf7y/chezz`. Do NOT append to QUESTIONS.md.
       - answer:  Zach runs `scheduler -q chezz`, or comments on the issue.
       - consume: read `label:question,answered`, act, then CLOSE the issue.
     `.scheduler/QUESTIONS.md` is FROZEN history -- do not read it for
     pending work and do not append to it. All 8 of its entries were
     answered before the move, so nothing was stranded.
     The fix was NOT a better copy, it was NO copy: issue state is rendered
     fresh from the API on every read and never persisted, so the staleness
     class that ate two of Zach's replies cannot recur.
     LANDED ON `main` 2026-07-29 (`91725e3`, fast-forward of the
     `gh-issues-answer-channel` branch). It had been sitting on that branch,
     pushed but unmerged, while `main` still instructed runs to read the
     file -- and scheduler `schedule/chezz.conf` had ALREADY been switched
     to `ANSWER_CHANNEL="issues"`, so the two halves disagreed.
     `npm run check-answers` now probes the issues API (fails loud when it
     cannot look, since "could not look" and "no answers" are otherwise
     indistinguishable) and still byte-compares the FOCUS.md pair, which
     did NOT move. Revert: drop `ANSWER_CHANNEL="issues"` from
     `schedule/chezz.conf`; the file channel is untouched.
     CAVEAT, knowingly accepted: `hf7y/chezz` is PUBLIC, so questions and
     answers are world-readable. Fine for chezz; check repo visibility
     before migrating the next project. -->

<!-- UNPARKED 2026-07-28 -- Zach answered the 2026-07-27 QUESTIONS.md entry
     ("may nightly runs work `chezz-classic`?") with a plain YES. The five
     `chezz-classic` reports he filed 2026-07-26 from mandark (mobile text
     highlighting, move-dot/move-into-check port, pawn-scarcity
     progression, analytic material theory, pawn spawn) are now ordinary
     nightly work; see priority queue item 8. Standing rules from that
     answer, verbatim in intent:
       - Nightly runs MAY check out `chezz-classic`, port a narrative fix
         into it, run the (size-enforcing) checks, and push.
       - "Absolutely try porting those things in" -- attempt the port
         first; do not pre-decline one on a size guess.
       - If a port WORKS but exceeds the byte cap: **keep the work, do not
         merge it**, and announce the overage LOUDLY in the HTML itself.
         This supersedes the older "file a blocker and wait" half of the
         size policy below for the port case specifically -- the blocker
         still gets filed, but the work is no longer thrown away or
         deferred while it waits.
       - Destination for such a build: the nightly-builds folder (item 9),
         not `chezz-classic` proper. -->

<!-- RESOLVED 2026-07-28 -- balance tuning is DELEGATED to nightly runs.
     Zach's answer to the 2026-07-27 QUESTIONS.md entry: "Yes. Balance
     tuning is good for nightly work." A run MAY change numbers like
     Archbishop's material value, a floor's pawn/spawn budget, and the
     minimum interesting force on a fodder floor, on its own, when a
     report complains -- PROVIDED each change lands with a regression test
     pinning the new number and the report says what moved and why. This
     is tuning, not design; it does not extend to changing what a piece
     DOES or how a floor is structured, which stay design calls.
     Unblocks five reports that were parked on this: archbishop
     underpriced, pawn supply too thin, spawn-gating, and two "fodder
     floors feel empty" bugs. Retire their tracker notes pointing at this
     question -- it is answered, not pending.
     SECOND HALF OF THE ANSWER, not optional: "this research should be
     documented in its own lane, like a folder, since it may be
     interesting to other researchers. This is scholarship." So the
     deliverable is not just tuned constants -- it is a durable research
     record a stranger could read. See priority queue item 10; do the
     tuning THROUGH that lane, not alongside it. -->

<!-- RESOLVED 2026-07-28 -- screenshot attachment on bug reports: PARKED,
     by Zach's own call, answering the 2026-07-27 QUESTIONS.md entry.
     "Good catch. Park for now. URL is the right place for missing
     context." Tracker `2026-07-23T22:51:04.845Z` stays open but is NOT to
     be re-triaged: no image hosting, no new external dependency, no
     pricing exercise. The ply-history-in-the-URL relief shipped in
     `daffb82` is the accepted answer. If a future ask needs more context
     on a report, extend what the URL carries. -->

<!-- RESOLVED 2026-07-28 -- FOUR MORE answers, from the same sweep, that an
     earlier pass of this session missed. All seven questions in
     QUESTIONS.md were answered at once (2026-07-28, `3cf830e`); the first
     fold-in caught only the three dated 2026-07-27. These are the rest.

     (a) King->Queen (asked 2026-07-24) -- ANSWERED, and NOT as either
     option offered. Not 1:1 replacement, not a two-piece escort:
     **royal pieces that get built up over time.** "The king finds a
     neutral knight 1/2 black, 1/2 white on a fodder level; he now gains
     knight movements in addition to king movements." The player may
     later choose to start from level 1 with an unlocked royal piece
     already loaded. For `chezz-classic`: **no, always king** -- do not
     port this. HARD DEPENDENCY: the neutral half-black/half-white piece
     does not exist in Unicode, so this needs the Gemini sprite pipeline
     (item 7) to have actually run. Item 6 is therefore no longer waiting
     on Zach -- it is waiting on a generated sprite, same gate as item 7.

     (b) Classic test suite -- "Something lighter. It should be called
     from the same scheduler job." A separate, lighter set of classic
     tests that do NOT apply to narrative, run from the existing chezz
     job rather than a new one. Rationale in the answer, and it is the
     standing frame for all Classic work: "classic is all about elegance,
     keeping the file size small, the html clean, and the game simple and
     self-evident." Pairs with item 8.

     (c) Pawn spawn under threat (asked 2026-07-24) -- "No. Never." Pawns
     MAY spawn under threat **if defended by another piece**. Free
     material on level load is not good design. The current behavior is
     an INFERENCE nobody authorized: `placePawn()` (index1.html ~1471)
     carries the comment "no safety check, pawns stand in the open," and
     Zach's answer says flatly that logic "was not stated by zach."
     Note the asymmetry it creates -- the non-pawn spawn path a few lines
     below DOES try safe squares first and will spend budget shielding a
     piece with a pawn rather than scrap it; only the pawn path drops
     material in the open. Fixing that asymmetry is the work.
     General direction, quotable: "more pawns, more terrain, never free
     on fodder levels. Fodder levels should play like a platformer /
     puzzle." Longer-term he wants a difficulty-detection system that
     starts by solving analytically what White material is actually
     needed to beat a given Black composition -- that is the same
     research-scale analytic material theory parked below, now with a
     stated purpose; keep it parked, but stop treating it as idle.

     (d) White background move-hint -- PARK, with stubs, conditional.
     "Only do this work if the black engine piggyback hypothesis is
     real, otherwise park as an idea in the feature vision tree." The
     hypothesis, in his words: it "should be largely free since black's
     previous move already considered white's best move. Shouldn't need
     to call the engine at all." Shape if real: when White selects the
     piece holding the best move, that move's dot renders special (a
     color or a star -- "whatever is simplest"), behind a toggle. So the
     first task is not implementation, it is ANSWERING the hypothesis by
     reading the search: does Black's completed search already surface
     White's best reply, retrievably, at no extra cost? Report the
     finding either way; build only on a yes. -->

<!-- PARKED WITH A TRIGGER 2026-07-28 (Zach, interactive) -- moving the
     `hf7y` domain to GitHub Pages. Today it is only a redirect to the
     OCF domain, and OCF deployment is getting an ssh key anyway, so the
     move buys nothing right now. It is NOT a "someday" park: it becomes
     worth doing the moment the OCF hop is carrying weight it would not
     have to carry on Pages.
     MILESTONE THAT MAKES IT WORTH DOING -- any ONE of these is enough:
       - The nightly-builds folder (item 9) is live and beta testers are
         actually fetching builds through the domain. Serving a growing
         set of static HTML builds is precisely what Pages does for free
         and what the OCF redirect makes awkward.
       - The OCF ssh key breaks, expires, or needs a second manual rescue.
         Two rescues means the redirect is costing more than the move.
       - Anything needs HTTPS/CDN behavior or a custom 404 the redirect
         cannot give.
     TRIGGER THAT TELLS US THE TIME HAS COME -- this must be a real
     check, not a note nobody reads. Wire it as part of item 9: the
     nightly-builds index build asserts the domain can serve a build
     directly, and FAILS LOUD (blocker to Zach, scheduler BLOCKERS.md
     `## chezz`) the first time it cannot. Until item 9 exists there is
     nothing to wire it to, which is itself the honest status: this park
     has no live trigger yet, and item 9 is what gives it one. Do not
     mark this wired until that assertion exists and has run. -->

<!-- Parked 2026-07-27: tracker 2026-07-26T02:42 asks for an *analytic*
     material-sufficiency theory rather than the search-based proxy item
     5 already built and strengthened. That is research-scale, past the
     current milestone bar. -->
<!-- HISTORY CORRECTION 2026-07-28 -- `e3590c3` does not contain what its
     message says. It is titled "CLAUDE.md: adopt the silence-audit checklist
     retirement" and does carry that 6-line change, but it ALSO carries 329
     insertions of unrelated work that a concurrent interactive session had
     staged at that moment:
       tools/gemini-budget.mjs       (the whole Gemini spend cap)
       test/gemini-budget.spec.mjs   (10 tests for it)
       tools/generate-pieces.mjs     (key resolution + cap wiring)
       package.json, .gitignore
     Cause: a cross-project rollout script committed with a bare `git commit`
     (no pathspec) while those files sat staged behind a ~5min pre-commit
     suite. The staging session's own commit message -- which documented why
     the cap refuses instead of reporting, why the ledger lives outside the
     repo, and why it fails closed on a corrupt ledger -- was discarded.
     NOT rewritten, deliberately: `e3590c3` was already pushed, and force-
     pushing a ref the nightly clone and another live session may hold is a
     bigger risk than a wrong label. So this note is the record instead.
     `9bfd8e8`'s message compounds it slightly by describing the cap as
     though it landed there; only the sprite and its tests did.
     Filed scheduler-side as `15948a8`: should a cross-project script be
     required to pass an explicit pathspec, the way focus-commit does? -->

<!-- EXECUTION HOST: chezz is moving to dexter (policy, 2026-07-28).
     Zach, interactive: **the dexter pinning policy is reversed -- move
     everything possible to dexter.** dexter is now the DEFAULT execution
     host; the old rule (only hardware/network-evidenced projects may be
     pinned there, `wtul` as the lone named exception) is retired. Filed
     to scheduler as `a36d3c0` and to realisateur the same day.
     What this settles for chezz: it no longer needs a named exception to
     move. The "chezz would be the second non-hardware exception" concern
     raised earlier the same day is RETIRED -- permission is not the
     question any more.
     What it does NOT settle, still open in QUESTIONS.md (`d7f1229`):
     where Zach's answer surface lives, whether `chezz-sweep` moves with
     the nightly or later, the branch model, and whether the Gemini key
     follows to dexter.
     THE PREREQUISITE, unchanged and now MORE important rather than less:
     dexter must be able to reach `git@github-chezz-deploy:hf7y/chezz.git`
     -- live-verified with `git ls-remote` FROM dexter before any
     participant line moves. `wtul` was moved 2026-07-25 and reverted the
     same day for exactly this gap. A policy that moves projects faster
     than credentials get provisioned converts one revert into many.
     Mechanically the move is a PAIRED edit, and the halves happen on
     different machines: drop/disable `chezz` (and `chezz-sweep`) in
     scheduler `schedule/_paced.conf` on mandark, add them to
     `schedule/_paced.dexter.conf` ON dexter (that file is dexter-owned).
     Two hosts must never dispatch the same participant.
     CAVEAT RETIRED 2026-07-29 -- do not re-read it. This block used to warn
     that `_paced.dexter.conf` lines 29-33 still stated the OLD pinning
     policy and "cannot be corrected from mandark". It was verified ON
     dexter during the 2026-07-28 `/cloture` session and found already
     fixed: the header now reads "HOST POLICY (REVERSED 2026-07-28) ...
     dexter is the DEFAULT execution host", committed as `bccf9ce` and
     present in both dexter's working copy and origin. Nothing to amend
     during the move. The caveat outlived its own verification by a day,
     which is the exact decay it was written to flag. -->

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
6. (ANSWERED 2026-07-28; now waiting on a generated sprite, not on Zach) King->Queen -- neither option in the original question won: it is **royal progression**, the King absorbing movement from neutral pieces found on fodder floors (see resolved block above for the full answer). The 2026-07-24 DESIGN-NOTES.md spec is superseded on its central question and needs rewriting before implementation. Blocked on item 7 having actually run, because the neutral half-black/half-white piece has no Unicode glyph. Narrative only -- Classic stays always-king.
7. (waiting: a GEMINI_API_KEY on this machine) Gemini sprite pipeline -- BUILT 2026-07-27 (`f7a2458`), gate opened by Zach's `BLOCKERS.md` reply the same day. `tools/generate-pieces.mjs` + `sprite-postprocess.js` + `wire-pieces.mjs`, and `pieceGlyphHtml` renders a sprite when one exists / the Unicode glyph when it doesn't. Zero new dependencies (Playwright's canvas replaces vkv's Pillow+numpy; plain `fetch` replaces the google-genai SDK). Monochrome is enforced by a palette snap in the pipeline, not by prompt compliance. 11 new tests; everything downstream of the API call is green. **Not shipped: any actual sprite.** No key is reachable from an unattended run, and the reply's suggestion to lift creds from `vkv-inventory` is not possible -- vkv stores no key anywhere (verified 2026-07-27: `tools/generate_sprite.py` documents `export GEMINI_API_KEY=...` as an interactive human step; no key in its repo, its scheduler conf, or the env). This needs one `export` from a human, then `npm run pieces:generate`; do not re-triage it nightly until then. Full writeup in DESIGN-NOTES.md's "Graphics pipeline" section.

8. (LIVE, unblocked 2026-07-28; 3 of 5 shipped as of 2026-08-06, see items 17 and 18) `chezz-classic` ports -- work the five reports Zach filed 2026-07-26 from mandark: import narrative's color-coded move dots, mobile text-highlighting bugs, pawn-scarcity progression gating, the materials-theory one, and pawn spawn. Check out `chezz-classic`, port, run the size-ENFORCING checks, push. A port that works but busts the cap is kept and NOT merged, with a loud in-HTML overage announcement -- see the unparked note above for the full standing rules. Take them one at a time; each is independently shippable, so a run that lands one and leaves four is a good run. **Only real remainder: move-into-check** (tracker `2026-07-26T02:38:04`) -- needs a classic-appropriate deadlock fallback built first (item 17's finding), which is ordinary engineering, not a Zach-level question; don't re-park it as blocked-on-a-person.

9. (LIVE, new 2026-07-28) Nightly-builds folder -- Zach: "Eventually we'll have a nightly builds folder of the html pages where beta testers can explore different builds." This is where an over-cap `chezz-classic` port goes instead of being merged or discarded, so item 8 has a real destination rather than a dead-end branch. Needs: a published path (GitHub Pages already serves this repo), one HTML per build with enough label to tell builds apart, and an index page listing them. Keep it dumb -- static files, no build system, no new dependency. The loud overage announcement from item 8 lives in the build's own HTML, where a beta tester will actually see it.

10. OPENED 2026-07-29 (`50c0c3e`), and now the STANDING ROUTE for every tuning change -- `research/balance/`. README states the bounded-tuning rule (a run may change what a number IS, never what a piece DOES or how a floor is STRUCTURED), explains Chezz to a cold reader, and records method notes: sweep 30 floors x 28 days rather than sample, offset past NARRATIVE_STAGES so you measure the procedural system and not authored content, define a test's probe locally so it can fail against the pre-change build, and read the measurement rather than the reporter's diff-line count. First entry is item 11, written in full. The four still-unstudied questions the delegation unblocked (archbishop value, pawn supply, the two empty-fodder-floor reports, analytic material sufficiency) are named in the README's index as open, so the gaps stay visible. Every future tuning change lands through here.

11. DONE 2026-07-29 (`50c0c3e`) -- spawned pawns are never free material. A spawned Black pawn now takes an unattacked square, else an attacked-but-DEFENDED one, else none at all; the shield-pawn path in the tier loop was fixed too, since it placed a pawn directly (bypassing placePawn) and could leave the shield itself hanging. New `isDefendedSquare` probes with a WHITE occupant, because a black defender cannot "move onto" a square its own colour already holds. Measured: attacked-and-undefended pawns 16 -> 0 over a 288-spawn carried-army sweep, with pawn supply UNCHANGED at 0.95/floor (the real risk was starving promotion/carryover; it did not happen). Full writeup in `research/balance/2026-07-29-pawn-spawn-free-material.md`.
    STANDING LESSON, worth more than the fix: the old behavior was defended for months as intentional design by citing a source comment ("pawns are meant to stand in the open") that automation had written and automation then read back as authority. Nothing outside the codebase ever said it. Before deferring a recurring report as "intentional", check whether the intent has a human source.
    NOT closed by this: Zach's broader direction "more pawns, more terrain, never free on fodder levels -- fodder levels should play like a platformer / puzzle" is a floor-composition goal, which is design, not tuning. This removed the free material only.

12. (LIVE, new 2026-07-28) Classic test suite -- "something lighter," called from the SAME scheduler job, not a new one. Classic-only tests that don't apply to narrative, holding the line Zach stated: elegance, small file size, clean HTML, a game that is simple and self-evident. Prerequisite-ish for item 8 -- the ports need something to be checked against beyond the byte cap.

13. RESEARCH DONE 2026-07-29, AWAITING A HUMAN CALL (issue #3) -- White move-hint. The piggyback hypothesis is HALF real. Yes, the information is computed: Black's search does evaluate White's replies under the same eval, so NO second engine call is needed. But it is not retained (`search()` returns a scalar; there is no PV table and no transposition table anywhere) and most of it is not an answer (alpha-beta cut nodes yield a move sufficient to REFUTE the line, not White's best). Three correctness conditions any implementation must meet, each a way it ships subtly wrong: restrict PV collection to exact-window nodes; filter through `legalMovesFrom` before display, because `collectMoves` builds from `legalMovesForPiece` and so enumerates King-hanging moves the player may not play (measured: 208 of 1312, 15.9%, across 60 spawned boards); and suppress a hint when the search hit `NODE_BUDGET`, since the line is then partial. Timing does line up as Zach thought -- the node wanted is exactly the child of the Black move played, searched at full window on the first deepening iteration. NOT BUILT: his instruction was to build only on a clean yes, and this is a qualified yes, so it goes back to him rather than an unattended run deciding. Full writeup: `research/engine/2026-07-29-white-move-hint-hypothesis.md`.

14. DONE 2026-07-29 (second nightly, `48c1e68` + `cd446b8`) -- three
    tracker reports filed as features that were really defects in already-
    shipped work. Worth reading as a class, not three incidents:
      (a) **Terrain has been invisible since it shipped** (item 4,
          `ebdb1dc`, 2026-07-24). `td[data-terrain="wall"]` is specificity
          (0,1,1); the checkerboard rule above it is (0,2,2) and won every
          square, so walls painted as ordinary empty squares. All six
          terrain tests passed the whole time -- they assert MOVEMENT and
          the data attribute, never the paint. The reporter's question
          ("failed rendering of the wall tile or genuine unable to move?")
          had the answer BOTH, which is why it was unanswerable from
          outside the code.
      (b) **Formation-follow stranded anything more than one move behind**
          the King: it only accepted moves landing ON the King's new rank,
          and falling behind is precisely what makes that gap unclosable,
          so it was permanent. Now a piece with no rank-reaching move takes
          the legal move that gets it strictly closer.
      (c) A Black pawn marching off the board (correct, deliberate) did it
          **silently**, so a rule read as a piece vanishing. Announced now
          through the existing `#floorMessage` channel; the rule is
          unchanged.
    STANDING LESSON: (a) and (c) are the same failure in different clothes
    -- a feature whose LOGIC is tested and whose OUTPUT nobody looked at.
    Green tests are not a witness that a player can see the thing. When
    shipping anything visual, assert the computed paint, not the attribute
    that is supposed to cause it.

15. Feature backlog re-triaged 2026-07-29 (second nightly): 14 open -> 10,
    zero with an empty or stale note. Four notes RETIRED that claimed to be
    waiting on Zach and were not: three ("archbishop pricing", "pawn
    supply", "spawn-gating") pointed at the balance-tuning question he
    ANSWERED 2026-07-28, so they had been unblocked-but-labelled-blocked
    for a day; one pointed at the move-hint question item 13 has since
    answered. Those three are now ordinary queued work routed through
    `research/balance/` -- undone for TIME, not for permission, which is a
    different status and should be reported as one. Three genuinely new
    forks went to Zach as issues #4 (roguelike respawn-with-bank: floor
    structure, past the tuning delegation), #5 (earcons/vibration: audio
    default on/off + FM-synthesis bytes), #6 (difficulty theory: separate
    math branch or the research lane, and is agent playtesting in scope).

16. Nightly 2026-08-06 (first dispatch of the run, chezz's new `monkey`
    host): recovered a prior run's finished, tested commit that never
    reached `main` -- it survived only as a local
    `rescue/chezz-nightly-batch-20260806000011` branch (harness safety net,
    not a scheduler mechanism), one commit ahead of `main`, terrain
    brick-wall/circular-hole visual distinction (tracker
    2026-07-29T04:39:12). Re-verified independently (full 142-test suite,
    not just the prior commit's own claim), merged, pushed as `ba0972d`,
    tracker resolved. STANDING LESSON: this run also found TWO STALE
    scheduler auto-stash entries (`git stash list`, both titled
    "sweep-loop-common.sh auto-stash before reset") predating tonight --
    one was a second, worse, independent attempt at the exact same terrain
    report (different CSS, no tests, correctly superseded by the merged
    fix above, left untouched); the other (2026-08-05T18:00) was an
    UNTESTED, UNSWEPT bishop-pair evaluation bonus for tracker
    2026-07-28T14:51 that a LATER same-day research pass (`760684f`,
    "opposite-color bishop pair: no change, and here's why") investigated
    independently and fixed on -- without knowing this stash existed,
    since a stash is invisible to a fresh session starting from `main`.
    The later research's reasoning stands (no measured case for a bonus,
    and it is a new conditional term past bounded tuning either way), so
    the stash was correctly left unmerged, but check `git stash list`
    going forward before re-investigating a report from scratch -- a
    stash is exactly the kind of prior-run state step 1's "pick up don't
    restart" instruction means, and it will not show up in `git log`.
    Also re-triaged tracker 2026-07-29T04:37:19 (black pawn sprite):
    the standing note called it "blocked on the sprite pipeline" when the
    pipeline had actually already shipped that exact sprite in `9bfd8e8`
    (2026-07-28) -- the report was about the LIVE sprite's quality, not a
    pending pipeline. Fixed the "no padding in square" half in `d4cd05b`
    (postprocess now reserves real margin instead of touching the sprite's
    own canvas edges), regression-pinned. Investigated "white ghost pixels
    around edges" as a downsample/chroma-key blend and could not
    substantiate it -- worked the arithmetic and ran two synthetic repros,
    both came back clean against the OLD code, so a test claiming to pin a
    fix for it would not have been a real pin (would have passed against
    both). Left that half open, correctly reasoned as still blocked on a
    GEMINI_API_KEY to regenerate the actual asset (same gate as item 7),
    not on more pipeline work.

17. Nightly 2026-08-06 (second dispatch same day): found three tracker
    reports with STALE "waiting on Zach" notes -- same failure class item
    15 already named, recurring. `2026-07-20T03:59:26`/`17:54:49` and
    `2026-07-26T02:35:50` ("black pawn spawns hanging") all still claimed
    to be blocked on a design fork that was actually answered and SHIPPED
    a week earlier (item 11, `50c0c3e`, 2026-07-29). Resolved all three on
    the tracker, citing the shipped commit and its regression test. Same
    thing found on two of item 8's five chezz-classic reports
    (`2026-07-26T02:06:18`, `2026-07-26T02:38:04`): both still said
    "blocked on whether nightly runs should touch chezz-classic," a
    question Zach answered 2026-07-28. Corrected both notes to "unblocked,
    queued" rather than leaving the stale claim standing.
    STANDING LESSON, same shape as item 15's: a note that says "waiting on
    Zach" is a claim about a QUESTION's state, not the WORK's state --
    once the question is answered, the note needs updating even if nobody
    has gotten to the work yet. Re-verify before repeating a "blocked"
    claim more than a few days old, the same discipline item 15 already
    established for feature-backlog notes now also applies to the bug
    queue.
    Then actually worked item 8, unblocked-but-not-yet-done: shipped 2 of
    the 5 chezz-classic ports. **Text-selection** (`8f46f5b`, chezz-classic
    branch): ported narrative's `user-select: text` exception for
    `#instructions`/`#leaderboard` (classic has no featureChat/changelog/
    sweepStatus/appVersion panels, so only these two). **Color-coded move
    dots** (`0065e6d`, same branch): ported `moveDangerLevel` cleanly,
    zero new dependency (reuses classic's existing `attackersOf`). Both:
    regression test added and confirmed to FAIL against pre-port code
    (not just pass post-port -- build-discipline rule), full classic suite
    green (39 tests), size well under the 100000-byte hard cap (64842B).
    **Move-into-check deliberately NOT ported**, and this is a real scoping
    finding, not a stall: classic (cut 2026-07-16) predates narrative's
    entire stalemate/floor-reset system. Narrative bundled move-into-check
    with stalemate-reset as ONE item on purpose (priority queue item 2,
    `2783c357`) because King-only `kingSafeAfterMove` can produce a genuine
    zero-legal-move King deadlock -- without a floor-reset fallback,
    porting it alone would soft-lock a classic player with no move to
    click. Left open on the tracker (`2026-07-26T02:38:04`) with this
    scoping written down so the next run doesn't have to re-derive it: the
    remaining work is "port or build a classic-appropriate deadlock
    fallback first," not "port move-into-check."
    **Pawn-scarcity progression** (`2026-07-26T02:06:18`) NOT attempted --
    the reporter explicitly asked for "a net zero edit... check for
    elegance," which is a measured tuning pass in the `research/balance/`
    spirit, not a mechanical port; didn't rush it under this session's
    remaining time.
    **Item 12 (classic test suite) is still not built as a durable,
    from-the-main-job mechanism** -- tonight's testing used an ad hoc
    `git worktree` checkout of `chezz-classic`, run and torn down by hand.
    It worked (caught both regressions pre-fix, confirmed both fixes), but
    isn't wired into `npm run check` or anything the scheduler calls
    automatically. Worth automating along these lines, not yet done.
    Corrected 3 pawn-hang notes + 1 chezz-classic note; resolved 4 reports
    total (3 pawn-hang duplicates + text-selection). Verified every POST
    by re-fetching state after, not by trusting the response body --
    caught one silent write that returned a Google Drive error page
    instead of the expected JSON on the first attempt (transient Apps
    Script flakiness tonight, several other calls also timed out and
    needed 2-3 retries; all confirmed to have eventually landed correctly).

18. Nightly 2026-08-06 (third dispatch same day): re-verified everything
    from scratch first (`check-answers` OK, 5 open questions #3/4/5/6/9, 0
    answered; full 142-test suite green). Re-fetched the tracker
    (`&status=all&type=all`): 13 open bugs, 11 open features, all already
    correctly triaged with no stale notes and no `NIGHTLY:`-prefixed bug
    (confirmed by reading every open report's note, not by trusting last
    run's count) -- so tonight's primary and backup tiers were both
    already exhausted before this run started, and everything actionable
    came from item 8's remainder and the standing Ideas queue.
    **Shipped item 8's third chezz-classic port**: pawn-scarcity
    progression (tracker `2026-07-26T02:06:18`, "net zero edit... check
    for elegance"). Classic's `spawnBlackArmy` turned out to be the exact
    same tiered-budget generator narrative had before the 2026-08-05
    `PAWN_ALLOWANCE_CHANCE` bump (`research/balance/2026-08-05-pawn-
    allowance-bump.md`), including the same stale 0.3 value -- so this
    was a real port, not a from-scratch tuning pass. Measured directly on
    classic (same 30x28 sweep) rather than assuming narrative's numbers
    transferred: 0.3 -> 37.9% zero-pawn floors / 0.98 avg pawns / 2.90 avg
    army; 0.5 -> 26.8% / 1.18 / 3.11 -- same shape, close enough in
    magnitude to narrative's 36.5%->26.3% that the same value carries
    over. Shipped `hf7y/chezz@ca29e86` (chezz-classic branch). Tightened
    `spawn-safety.spec.mjs`'s loose 0.8-1.4 pawn-supply bound (passed at
    both 0.3 and 0.5, so it wouldn't have caught a regression) to >1.05/
    <1.4 plus a new zero-rate assertion; verified it fails against 0.3
    before landing at 0.5. Full 39-test classic suite green, 65165B,
    under the 100000B cap. Tracker resolved, verified by re-fetch.
    **Item 8's only real remainder is now move-into-check** -- see the
    priority-queue entry above; not attempted tonight, same scoping
    reason item 17 already found (needs a classic-appropriate deadlock
    fallback built first, which is more than a session's worth of new
    design surface, not a quick follow-on to the pawn-scarcity port).
    **Also closed the standing `scheduler -i` idea** (2026-07-28 13:34,
    Playwright `workers` derivation) that had sat unaddressed for 9 days
    -- `playwright.config.mjs` still hard-coded `workers: 2` with a
    comment claiming "6 on this machine," which was true on mandark where
    it was tuned but already false on both hosts chezz has run on since
    (monkey, this host, 4 cores; dexter, 16). Per FOCUS.md's own rule
    (never quietly decline a `scheduler -i`), implemented the filing's own
    suggested shape: `workers` now derives from
    `os.availableParallelism() / 3`, floored at a minimum of 2 so it
    reproduces the already-verified-safe value on both mandark (6/3=2)
    and monkey (4/3 floored up to 2) without changing behavior on either,
    plus a `CHEZZ_TEST_WORKERS` env override. Verified the override works
    and the full 142-test suite stays green (still deriving to 2 on this
    host). Shipped `hf7y/chezz@368fd1a` (main).
    STANDING LESSON, small but real: this run initially ran `git commit`
    for the classic port without exporting `LD_LIBRARY_PATH` first, and
    the repo's own pre-commit hook (`npm run check`) failed loud in
    exactly the "every test fails in ~2ms" shape the monkey-host-infra-
    gaps memory already documents -- the hook runs in its own subshell
    that doesn't inherit a shell-only `export` from the invoking session.
    No harm done (git correctly refused the commit on hook failure,
    nothing was lost), but re-export before every `git commit` on this
    host, not just before `npm run check` itself.

<!-- HISTORY CORRECTION 2026-08-06 -- the commit that carries the item 16
     text above, `4b59192`, is titled "FOCUS.md/QUESTIONS.md: flag missing
     .session-handoff on the new baudin/monkey account (26th pass)" and its
     body is about a DIFFERENT project's Home Assistant credentials. Neither
     the title nor body has anything to do with chezz or item 16; the DIFF
     it carries is exactly the item 16 text above and nothing else (verified:
     `git show --stat` touches only .scheduler/FOCUS.md, +40/-0). Cause: this
     run's own `cat > /tmp/focus-commit-msg.txt` failed with "Permission
     denied" (the file already existed, owned by a different unix user,
     `baudin`, group-writable but not writable by `chezz`) -- `focus-commit`
     then read that STALE, WORLD-READABLE, unrelated file as its msgfile
     argument without complaint, because reading it needs no special
     permission, only overwriting it does. `/tmp` on this host is shared
     across many concurrently-scheduled projects running as distinct unix
     accounts (`ecosim`, `bibliothecaire`, `vim-arcade`, `baudin`, `chezz`,
     at least), several of which independently reuse predictable names like
     `commit-msg.txt`/`focus-commit-msg.txt` -- a real collision, not a
     one-off fluke, and every one of those projects' own commit-message
     tooling on this host is exposed to the same failure mode chezz just hit,
     not just chezz's. NOT rewritten here, deliberately: `4b59192` was
     already pushed, and force-pushing a ref other clones may hold is a
     bigger risk than a wrong label -- same call as the `e3590c3` correction
     above. Filed to senechal (`notify-senechal`, 2026-08-06) as a
     shared-host hazard since it is a machine-wide /tmp collision risk, not
     a chezz-only bug; this run also switched to a PID-qualified tmp path
     for its own remaining commits tonight as a local mitigation, not a fix
     for the underlying shared-host race. -->

Backup work when the feature backlog (below) is empty: items 8-13 are all
LIVE as of 2026-07-28 and are the top of the queue -- items 1-5 are DONE;
6 and 7 are both now gated on the same thing, a generated sprite, which
needs one human `export` (item 7) and nothing else. Cheapest real wins in
that set: item 11 (a bounded correctness fix with a clear test) and item
13 (pure research, no shipping risk). Next backup tier after those: any
bug reports Tier 1 left open needing a human call (see below).

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

## Ideas (added via `scheduler -i`)

- **2026-07-28 13:34 (via `scheduler -i`): DONE 2026-08-06 (nightly, `368fd1a`, see item 18).** playwright.config.mjs: derive `workers` from the host's core count, not a magic 2 (2026-07-28, Zach-directed via realisateur /ideate; filed through the front door because chezz had a live interactive session at the time).

WHAT'S THERE NOW. `workers: 2`, with a good comment explaining it: at full concurrency ai-determinism.spec.mjs races material-tuning.spec.mjs for CPU, the AI's wall-clock search deadline lands at a different depth on its second of two same-position calls, and a test that isn't testing concurrency fails reliably. The reasoning is sound and should be kept. The problem is the number, and specifically this clause: "default is CPU-count-based, 6 on this machine".

WHY IT MATTERS NOW. "This machine" is about to stop being one machine. chezz is being migrated to dexter under the 2026-07-28 pin-by-contention-relief decision (filed to scheduler same day). mandark has 6 cores; **dexter has 16**. So the comment's stated premise is false on the new host the moment the move lands, while the code keeps working -- which is the worst version of this, because nothing fails and the next person reads a rationale that no longer describes anything real. The cap of 2 is still *safe* on 16 cores; it is the justification that decays, not the behavior.

WHAT TO DO INSTEAD. Derive it, and let the derivation carry the intent. Something like a fraction of `os.availableParallelism()` (node 18+, present on both hosts -- dexter now runs node v24.18.0) with a floor, plus a `CHEZZ_TEST_WORKERS` env override so a specific host or CI context can pin it without editing tracked code:

  workers: Number(process.env.CHEZZ_TEST_WORKERS) || Math.max(1, Math.floor(os.availableParallelism() / 3))

-- the exact fraction is chezz's call, not this filing's. What matters is that the number stops being typed and starts being computed, and that the comment then explains the RULE ("leave enough headroom that material-tuning's wall-clock deadline is not CPU-starved") rather than a measurement taken once on a laptop that is no longer the host.

THE GENERAL SHAPE, worth applying beyond this one line. This is a host-property dependency hiding in a config file -- the same class as crt's remote-Claude bridge being a reverse tunnel because mandark has no inbound path. It is filed to senechal as class 5 of five dependency classes (2026-07-28, "HOST DEPENDENCIES AS A DECLARED, PROBEABLE THING"). A constant tuned to one machine's hardware is fine while there is one machine; it becomes a latent lie the moment there are two. So while touching this: grep chezz for other numbers that were measured on mandark rather than reasoned from a rule -- timeouts, size budgets in scripts/check-size.mjs, any wall-clock deadline in the AI search itself. Each one is either genuinely host-independent (say so in the comment, and it's done) or it needs the same treatment. Better to sweep them once now, before the move, than to discover them one failing test at a time on a 16-core box.

Note the migration does NOT block on this and this does not block the migration -- workers:2 runs correctly on dexter today. This is a correctness-of-reasoning fix, not a bug.
