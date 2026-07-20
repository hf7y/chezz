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

- **2026-07-17 (scheduler migration):** checked before writing this --
  chezz already has its own "autopilot mode" policy in `FOCUS.md`
  (independently developed, arguably more mature than vkv-inventory's:
  work-oldest-first fairness, a 4-outcome triage for feature reports,
  stop-by-report-time on turn budget, and a genuinely good
  irreversibility gate -- "adding a NEW external service dependency
  always needs the user's sign-off first"). That part does NOT need
  porting from vkv-inventory. Two real gaps remain, though: chezz's
  `bug-sweep.md`/`nightly-batch.md` have no `NIGHTLY:` note-prefix
  hand-off (a real bug too big for a fast sweep currently has nowhere
  explicit to go except a generic "needs a human call" note), and no
  `QUESTIONS.md` convention until this file just now. See
  `~/Documents/Project Archive/scheduler/examples/bug-sweep.md.template`
  and `nightly-batch.md.template` for both conventions to copy in --
  worth doing the reverse too, backporting chezz's own good ideas above
  into vkv-inventory's `FOCUS.md` and the scheduler templates.
  > Bug sweeps should punt large bug to Nightly. Nightly should gain the
  > power to address bugs.

- **2026-07-20 (nightly): Should moving into check (hanging the King) be disallowed?**
  A recurring reporter cluster (`2026-07-15T18:17:33.709Z`, `2026-07-17T05:18:31.007Z`,
  `2026-07-16T11:51:25.998Z`, `2026-07-18T07:28:51.299Z` for the pawn-specific
  variant) keeps asking for real chess "can't move into check" -- White
  shouldn't be able to select a move that leaves the King (or, per one
  report, a pawn) capturable next turn. Tonight shipped the informational
  half of this (legal-move dots now color red/orange by threat, see
  `f7d0d0d`) without touching legality -- hanging the King is currently
  full risk/reward by design (`whiteSurvivesNextMove`'s own comment: "no
  check/checkmate rule exists here"). Actually disallowing it is a real
  rules change (bigger than a UI tweak, changes the game's difficulty
  curve) and was flagged, not guessed at, per FOCUS.md's redesign-defer
  criterion. First raised in the 2026-07-19 report; re-flagging here since
  it was never actually appended to this file that night.
  > Disallow hanging the King only (real chess-style legality: a move that
  > leaves the King capturable next turn becomes illegal). Pawns/other
  > pieces stay hangable -- risk/reward on those is unchanged. Standing
  > rule once shipped -- fold into FOCUS.md. Add a regression test
  > covering the case where the King has zero non-hanging legal moves
  > (should route through the existing stalemate/checkmate-adjacent
  > handling, not silently strand the player).

- **2026-07-20 ("Chezz Classic" scope): where does this codebase actually
  live, and what does "its own production stream" mean?**
  You asked for an older version of chezz -- still live at
  `hf7y.com/chezz.html` (not this repo's own `hf7y.github.io/chezz/`) --
  to be developed as its own production stream (custom fairy-piece font
  is explicitly tied to this version, not the current arcade-cabinet
  build). Checked before asking: no `hf7y.com` reference exists anywhere
  in this repo's git history, and no `main-classic` branch exists in this
  checkout despite an earlier session's note claiming one was created --
  either it never got pushed, lived only in a different clone, or that
  note was wrong. `readable-html`/`simplify-and-polish`, or an older
  commit on `main` before the arcade reskin (`f99415d`), are guesses at
  best, not a confirmed match. Full investigation notes in
  `DESIGN-NOTES.md`'s "Chezz Classic" section. Three things needed:
  1. Where the code actually lives (a specific commit/branch here, an
     untracked local copy, or deployed-only files on `hf7y.com` with no
     git history at all).
  2. Whether `hf7y.com` is deployable-to from this machine/an unattended
     run, or publishing there is always a manual step.
  3. What "its own production stream" means concretely -- a full new
     `scheduler` registration (own repo/branch/FOCUS.md/nightly cadence,
     sharing the same constrained account budget every other project
     already competes for) vs. something lighter (occasional interactive
     sessions, no unattended cron).
  > (answer inline here)

