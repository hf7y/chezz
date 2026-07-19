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
