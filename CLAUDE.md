# Chezz

A daily-seeded roguelike built on chess rules. Live at
https://hf7y.github.io/chezz/. Full context lives in a few specific
files, not here -- read them, don't duplicate them:

- `.claude/FOCUS.md` -- what's in scope right now (short, changes often).
- `DESIGN-NOTES.md` -- the durable vision/decision record.
- `.claude/QUESTIONS.md` -- open questions awaiting a human answer.
- `.claude/commands/bug-sweep.md`, `nightly-batch.md`, `ideate.md` -- the
  three standing modes this project runs in (fast mechanical fixes,
  unattended feature implementation, interactive triage/vision).

## When to suggest `/ideate` instead of just implementing

If an interactive request looks like open-ended prioritization, "what
should we build next," a genuine design fork with no single obviously
correct shape, or a broad "check in on the project" ask -- suggest
running `/ideate` instead of diving straight into implementation. This is
a suggestion, not a gate: if the user says to just build/fix something
specific, do that normally, in the same session, no detour required.
`/ideate`'s own job is pulling live state, asking direct questions on
real forks, and recording/queuing decisions for `/nightly-batch` to
implement -- not something to silently emulate inline without actually
invoking it, since part of its value is the durable record it leaves in
`DESIGN-NOTES.md`/`FOCUS.md`.
