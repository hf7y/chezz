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

- **2026-07-27 (nightly): may nightly runs do ordinary balance tuning
  (piece values, spawn budgets) on their own, with a regression pin?**
  Restoring a question that went missing: three open feature reports
  (archbishop underpriced, pawn-supply too thin, spawn-gating) and two
  open bug reports (fodder floors feel empty) all carry tracker notes
  saying they are "attached to the balance-tuning delegation question
  (QUESTIONS.md 2026-07-25)" -- but that question was never actually
  written into this file. The 2026-07-25 report told you it was waiting
  on your answer here; it wasn't, so there was nothing you could have
  answered. Filed properly now. The ask: numbers like Archbishop's
  material value, how many pawns a floor's spawn budget buys, and the
  minimum "interesting" force on a fodder floor are tuning, not design
  -- may a run change them when a report complains, provided each change
  lands with a regression test pinning the new number and the report
  says what moved and why? A yes turns five open reports into ordinary
  nightly work. A no keeps them parked here indefinitely, which is fine
  if that's the call -- but they should stop being re-triaged every
  night either way.
  > (answer inline here)

- **2026-07-27 (nightly): should unattended nightly runs work the
  `chezz-classic` branch, or is it interactive-only for now?**
  You filed five reports from mandark on 2026-07-26 that target Classic
  specifically ("Import from narrative to classic the color coded move
  dots", "Classic: bugs on mobile with text highlighting", "Classic:
  progression gated by pawn scarcity", the materials-theory one, and the
  pawn-spawn one). Several are straight ports of things that already
  work on narrative `main`, so they're bounded, testable work -- but
  FOCUS.md says not to register anything with `scheduler` for Classic
  until the older parts 2/3 question above is answered, and the size
  budget IS enforced on that branch, so a port has to fit as well as
  work. This is narrower than that older question and unblocks the five
  reports on its own: may a nightly run check out `chezz-classic`, port
  a narrative fix into it, run the (size-enforcing) checks, and push --
  or should Classic stay something you drive interactively? If yes, the
  same four-outcome triage applies there as here.
  > (answer inline here)

- **2026-07-27 (nightly): screenshot attachment on bug reports -- worth a
  new image-hosting dependency?**
  Tracker `2026-07-23T22:51:04.845Z` asks to attach screenshots to
  reports. The chat box is text-only and the Apps Script/Sheets backend
  has nowhere to put an image, so this needs image hosting of some kind
  -- a new external dependency with its own credentials, cost and abuse
  surface, which FOCUS.md says always needs your sign-off before a run
  starts it. Partial relief already shipped tonight (`daffb82`): reports
  now carry the last 5 plies in the URL, so "look at what just happened"
  no longer requires a picture. Worth knowing whether that's enough
  before anyone prices out image uploads.
  > (answer inline here)
