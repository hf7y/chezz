# GAPS -- what `joue` cannot yet do

Recorded 2026-07-30 during the bashify pass. These are to be closed
later; they are written down now so the utility never pretends.

## No shell tooling existed at all

This tree had **zero** shell scripts. So `joue` is currently a contract
and a front door with nothing behind it: every subcommand is a gap.

**This is the most important finding available here.** It is the honest
measure of how much of this work was ever mechanised, and the answer is
none of it.

## Tooling in other languages, not reachable through the verb (37 files)

This tree does real work in javascript/typescript. The verb wraps shell
only, so none of it is exposed yet. This is the largest single gap here:

- `playwright.config.mjs`
- `scripts/check-answer-channel.mjs`
- `scripts/check-size.mjs`
- `scripts/check-syntax.mjs`
- `scripts/setup-hooks.mjs`
- `test/ai-determinism.spec.mjs`
- `test/ai-quiescence.spec.mjs`
- `test/answer-channel.spec.mjs`
- `test/auto-march.spec.mjs`
- `test/bug-report.spec.mjs`
- `test/date-seed.spec.mjs`
- `test/exit-row-commit.spec.mjs`
- `test/gemini-budget.spec.mjs`
- `test/gemini-fatal.spec.mjs`
- `test/helpers.mjs`
- `test/layout.spec.mjs`
- `test/material-tuning.spec.mjs`
- `test/move-context.spec.mjs`
- `test/move-generation.spec.mjs`
- `test/move-into-check.spec.mjs`
- `test/narrative-campaign.spec.mjs`
- `test/piece-sprites.spec.mjs`
- `test/piece-visibility.spec.mjs`
- `test/playtest-campaign.spec.mjs`
- `test/share-link.spec.mjs`
- `test/smoke.spec.mjs`
- `test/spawn-safety.spec.mjs`
- `test/sprite-postprocess.spec.mjs`
- `test/stalemate.spec.mjs`
- `test/sweep-status.spec.mjs`
- `test/terrain.spec.mjs`
- `test/text-selection.spec.mjs`
- `test/threat-coloring.spec.mjs`
- `tools/gemini-budget.mjs`
- `tools/generate-pieces.mjs`
- `tools/sprite-postprocess.js`
- `tools/wire-pieces.mjs`

## Standing gap: the cost baseline

No before-measurement exists for what the previous implementation cost
per call, so the saving from mechanising it is **unmeasured, not zero
and not assumed**. Closing this needs a real measurement, not an estimate.
