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

- **2026-07-18 (nightly): Stalemate — reset the floor, or die roguelike-style?**
  Reporters are split (several want a reset; one argues dying is "more
  roguelike"). If reset: to where — the start of the current floor, or the
  whole run? There's a real underlying asymmetry too: `makeMove` hands the
  turn back to White even when Black has zero legal moves, and a White-side
  deadlock has no handling at all.
  > (answer inline here)

- **2026-07-18 (nightly): Scripted bosses can be captured for a free instant win — fix or accept?**
  Scripted `NARRATIVE_STAGES` bosses bypass the procedural spawner's
  `isSafeSquare` check (`placeScriptedStage` drops pieces at fixed columns),
  so e.g. the floor-9 queen on the d-file can be taken on move 1 by a
  carried rook/bishop/queen with a clear line. Make placement capture-aware,
  or accept it as variance in hand-tuned stages?
  > (answer inline here)

- **2026-07-18 (nightly): Color scheme — several reporters want "revert to monochrome." Confirm direction?**
  A cluster of color/readability complaints (incl. explicit "revert to
  monochrome" requests). It's aesthetic, so the nightly keeps deferring it
  under correctness work. Worth a screenshot pass, but the automation wants
  your direction before touching it: full monochrome, a readability-focused
  recolor, or leave as-is?
  > (answer inline here)

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
