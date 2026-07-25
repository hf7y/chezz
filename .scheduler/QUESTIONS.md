# Questions for the user

Running log, appended to (never overwritten or trimmed) by `/bug-sweep`
and `/nightly-batch` whenever something bigger than a routine tracker note
comes up.

## How to answer (this is the interface)

Reply **inline, directly under the question**, on a new line starting with
`> ` (a Markdown blockquote). That's it — you don't delete anything
yourself. Example:

```
- **2026-07-18 (nightly): Stalemate — reset the floor or die?**
  > reset to the start of the current floor, keep the run alive
```

On its next run, the automation reads this file first, treats any `> `
answer as authoritative (same standing as `FOCUS.md`), acts on it, and
then removes that question+answer block once it has (git history and the
run's report keep the record). A standing direction also gets folded into
`FOCUS.md` so it persists as scope. Unanswered questions are left alone
and never re-asked. If you'd rather just dismiss a question without action,
delete its line by hand — that still works.

---

- **2026-07-20 ("Chezz Classic" scope, part 2/3): is `hf7y.com` (OCF
  Berkeley-hosted) deployable-to from automation, and what does "its own
  production stream" mean concretely?**
  Part 1 (where the code lives) is resolved: you confirmed it lived on
  `main` before narrative-campaign overwrote it there, and git archaeology
  confirmed the exact commit -- `readable-html`'s tip (`6815336`) is the
  precise merge-base, so a new `chezz-classic` branch now points at it
  (pushed to `origin`, `readable-html` left unchanged). Full detail in
  `DESIGN-NOTES.md`'s "Chezz Classic" section, including a caveat: this
  session's sandbox can't reach `hf7y.com` to independently diff it
  against the live page (DNS resolves, TCP connect times out -- looks
  like a sandbox network restriction, not a site-down issue), so worth a
  real check when you have a chance. Two things still needed:
  2. Is the OCF-Berkeley host actually deployable-to from this machine or
     an unattended run (credentials, SSH/rsync access, whatever OCF
     hosting requires), or is publishing there always a manual step no
     matter what automation does?
  3. What "its own production stream" means concretely -- a full new
     `scheduler` registration (own repo/branch/FOCUS.md/nightly cadence,
     sharing the same constrained account budget every other registered
     project already competes for) vs. something lighter (occasional
     interactive `/ideate`-or-similar sessions against `chezz-classic`,
     no unattended cron at all).
  > (answer inline here)

- **2026-07-24 (nightly): should a spawned Black pawn ever be allowed to
  hang (attackable for a free capture) right on arrival?**
  Recurring cluster, at least 4 separate reports since 2026-07-18-20
  (e.g. "black pawn spawns hanging, major problem", "should not spawn
  under threat", "pawns should never hang on load"). Current design is
  intentional, not a bug: `isSafeSquare` in index1.html explicitly skips
  the free-capture check for pawns because "pawns are meant to stand in
  the open" (spawn-safety guarantees only cover the King and non-pawn
  pieces). One report explicitly asks to override that design. This is a
  real balance/risk-reward call, not a defect -- overriding it removes a
  source of early free material for the player, which changes difficulty
  tuning on the fodder floors terrain was just added to. Deferring
  instead of guessing given how often it recurs.
  > (answer inline here)

- **2026-07-24 (nightly): King->Queen -- 1:1 replacement, or a two-piece
  escort mode?**
  Priority-queue item 6's spec draft is in `DESIGN-NOTES.md` ("King->Queen
  -- design spec draft"). Recurring tracker cluster since at least
  2026-07-14 ("what if the player piece were a Queen instead of a King")
  doesn't disambiguate between two differently-sized projects: (a) the
  Queen simply replaces the King everywhere, including carrying the
  exit-row win condition, and every floor's spawn budget / eval weights /
  the King-only can't-hang rule gets re-tuned around a much more durable
  player piece -- or (b) a separate, still-fragile King is reintroduced
  behind the Queen, so the objective becomes escorting the King to the
  exit row while the Queen fights -- a genuinely different two-piece
  objective, not a strength buff. No implementation should start until
  this fork is picked; see the DESIGN-NOTES.md section for the full
  breakdown of what else changes under each option.
  > (answer inline here)

- **2026-07-24 (nightly): index1.html size -- raise the cap, split the
  single-file architecture, or trim comments with explicit sign-off?**
  Now 97,463 bytes against a 50,000-byte soft target and 100,000-byte
  hard cap -- only ~2.5KB of headroom left before the build itself starts
  failing `check-size`, and every night's shipped work eats into that.
  Comments are the single largest reducible chunk (~31KB, ~32% of the
  file when last measured); no other real bloat found (no dead code, no
  duplicate CSS, `NARRATIVE_STAGES` is proportional to its content). The
  2026-07-14 standing call was explicitly to stop and revisit rather than
  cut deeper into comments, so nightly-batch can't just trim its way out
  of this on its own judgment. Three live options: raise the soft/hard
  targets, split the deliberately-single-file architecture into separate
  CSS/JS files (changes the no-build-step deploy story), or selectively
  trim comments with your explicit go-ahead. This is now urgent enough
  that continuing to add features without an answer risks a build that
  fails outright mid-run.
  > (answer inline here)

- **2026-07-25 (nightly): your 10:00 QUESTIONS.md edit this morning hit
  an empty stub at the old path -- did you mean to answer something?**
  Commit `7beef04` ("Human edit via scheduler: QUESTIONS.md
  2026-07-25T10:00") created a brand-new, header-only file at
  `.claude/QUESTIONS.md` -- the pre-migration path -- because the
  scheduler project's `schedule/chezz.conf` still lacks
  `SCHEDULER_SUBDIR=".scheduler"`, so its `questions/chezz.md` symlink
  never got re-pointed after the 2026-07-24 migration. You most likely
  opened what looked like a questions file with zero questions in it,
  while the five real open ones sat here unseen. Tonight's run bridged
  this in-repo (the old `.claude/` paths are now symlinks to the real
  `.scheduler/` files, so a stale-path edit lands correctly from now
  on), but the proper fix is still the one-line `SCHEDULER_SUBDIR`
  setting in the scheduler repo, which this run can't edit from here.
  If you did intend to answer a question this morning, it never
  arrived -- the five entries above (and below) are all still open.
  > (answer inline here)

- **2026-07-24 (nightly): should White get a background move-hint
  ("best move" dots) once the engine finds one, if White hasn't moved
  yet?**
  Tracker `2026-07-20T04:02:46.442Z`: "use the engine to solve whites
  best move quietly in the background... signal white's best suggestion
  with dots" once it's ready. This is a genuine design fork, not an
  engineering judgment call: it turns the game from "a puzzle the player
  solves unaided" into "a puzzle with an available hint," which changes
  the core challenge the same way the King->Queen and spawn-gating asks
  do. It would also need engine time firing on White's side (today the
  background search only ever runs for Black's reply) and some UI for the
  suggestion dots, at a moment (see the size question above) where new
  UI surface is a real cost, not a free add. Deferring pending a human
  call on whether hints are wanted at all, and if so, always-on vs. an
  opt-in toggle.
  > (answer inline here)
