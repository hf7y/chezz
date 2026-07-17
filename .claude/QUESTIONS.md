# Questions for the user

Running log, appended to (never overwritten or trimmed) by `/bug-sweep`
and `/nightly-batch` whenever something bigger than a routine tracker note
comes up. Clear an entry by deleting its line once you've actually read
and dealt with it; that's the only thing that should ever remove
something from this file.

- **2026-07-17 (scheduler migration):** chezz's `.claude/commands/bug-sweep.md`
  and `.claude/commands/nightly-batch.md` predate three conventions
  vkv-inventory's now have: (1) the `NIGHTLY:` note-prefix hand-off from
  bug-sweep to nightly-batch for a real bug too big for a fast sweep, (2)
  this `QUESTIONS.md` file itself as a place either command can flag
  something for you, (3) the "build maximally autonomously, only stop for
  irreversible actions" policy (chezz's `FOCUS.md` still says "don't
  implement anything from the feature-request backlog without the user
  weighing in first" — that line needs to go, same as vkv-inventory's
  did). See `~/Documents/Project Archive/scheduler/examples/bug-sweep.md.template`,
  `nightly-batch.md.template`, and `FOCUS.md.template` for the current
  reference versions to copy from.
