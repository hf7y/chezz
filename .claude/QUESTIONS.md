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

- **2026-07-20 (nightly): Automate `/bug-sweep` on a recurring schedule?**
  `2026-07-15T18:28:53.334Z` asks to run `/bug-sweep` on a cron instead of
  manual/nightly triggering, using Claude Code's scheduled cloud routines.
  This needs a repo-access story worked out first -- push credentials for
  a cloud environment reachable outside this machine -- which is a new
  external dependency / credentials-and-cost decision FOCUS.md's own gate
  says always needs the user's sign-off, no exception. Left open on the
  tracker; not attempted.
  > Deferred -- user wants the cost/security/reliability tradeoffs spelled
  > out before deciding. Do NOT implement or add credentials yet. Leave
  > this question in place (don't remove it) until a real decision lands;
  > tradeoffs writeup owed back to the user separately, not something to
  > guess into an implementation.
