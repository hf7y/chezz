<!-- Per-project "what's live right now" marker -- the Tier 2 nightly-batch
     job (.claude/commands/nightly-batch.md) reads this FIRST, before
     touching anything else, to decide what's actually in scope tonight.
     Keep it short; update by hand whenever the actual priority shifts. -->

Current focus: deepening bug-fix coverage on defects the Tier 1 bug sweep
can't verify alone (real mobile-device or WebKit-only repros this sandbox
lacks), and making progress on the two standing open engineering
questions: Rook/Queen material-sufficiency (needs playtesting + some
analytical solvability work) and the index1.html size budget (currently
~74KB against a 50KB soft target -- worth actually investigating what's
bloating it, not just raising the target).

Anything else sitting in the bug/feature tracker is fair game to analyze,
verify, and write up in tonight's report -- but should NOT be implemented
unless directly in service of the focus above. In particular: do not
implement anything from the feature-request backlog (`type=feature`
reports) without the user weighing in first -- that scope line was set
explicitly in `.claude/commands/bug-sweep.md` and still applies here.
Summarize feature ideas in the report; don't build them.
