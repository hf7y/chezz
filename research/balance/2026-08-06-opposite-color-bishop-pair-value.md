# Opposite-color bishop pair: no change, and here's why

**Date:** 2026-08-06 · **Change type:** none (record only) · **Commit:** none

## What moved

Nothing. `pieceValues.b`/`.B` stays at 300.

## What prompted it

Tracker `2026-07-28T14:51:22.205Z`: *"two bishops needs to change its point
value to be worth more than a rook now that they're on opposite colors."*

## The measurement

Two things, both already true before tonight:

1. **The flat sum already clears the bar the report asks for.**
   `pieceValues` has no pairing logic -- each bishop is priced independently
   at 300, so two bishops already sum to 600, ahead of a rook's 500. The
   literal comparison in the report ("worth more than a rook") is already
   satisfied by simple addition; there is no flat number to bump.
2. **The existing `material-tuning.spec.mjs` harness already measures
   opposite-color bishops as an *attacking* force, and the result argues
   the other way.** Its `rookByForceType` and `queenByForceType` tables
   both include `"two Bishops (opposite-color)"` as a candidate force for
   White to attack with. Ran tonight's full suite: both came back `null`
   -- White's own opposite-color bishop pair could not corner a lone Black
   rook OR a lone Black queen within the 20-move budget, the same budget a
   lone Knight, a Knight+Bishop, or the matching piece each cleared. So the
   one existing empirical data point says two opposite-color bishops are a
   comparatively *weak* attacking force in this game's move-budget terms,
   not a strong one -- the opposite direction from "underpriced."

## The reasoning

The report is asking for something the flat-value architecture cannot
express as stated: a **bishop pair bonus** (extra value specifically for
holding *both* bishops on opposite colors, on top of their individual
values) is a real chess concept, but it is a new *conditional* evaluation
term -- detect both bishops present, detect opposite square colors, add a
bonus in `evaluateBoard()` -- not a number to change in the flat
`pieceValues` table the way the archbishop's fix was. That puts it a step
closer to new evaluation logic than to "change what a number is," and
unlike the archbishop case there is no measured evidence motivating a
specific target: the archbishop fix had a concrete formula (bishop+knight
sum undersold at 700, priced to 780, still under the chancellor's 800).
Here, the one measurement that exists cuts against adding a bonus, not for
one, at least for the *attacking*-force framing the existing harness tests.

**What might actually motivate a bonus, and why it isn't this entry:** the
report may really be about the *defensive* side -- how much the Black
engine should value keeping its own opposite-color pair intact when playing
a scripted Two Bishops encounter (`NARRATIVE_STAGES`), not about attacking
strength. That is a different, not-yet-measured question, and coincidentally
adjacent to a live open bug (tracker `2026-07-30T06:18:44.726Z`, still open
as of tonight): the Black engine abandoned one bishop of a pair to a free
King capture when it had a safe retreat available. A pair bonus would not
fix that specific defect on its own (the search failed to prefer an
available safe move at fixed full-width depth, not merely under-valued the
piece at risk), but a future pass investigating one should read the other.

## The pin

None -- no behavior changed.

## Known limits

- This does not establish that 300/bishop is *correct* for opposite-color
  bishops in general, only that the report's literal comparison already
  holds and that the one existing measurement doesn't support inflating it
  further. A genuine bishop-pair bonus, if built, needs its own before/after
  sweep the way the archbishop and pawn-allowance entries have -- there is
  no such sweep here because nothing was built to sweep.
- Did not re-run `material-tuning.spec.mjs` fresh for this entry; used
  tonight's full-suite run (already required by nightly-batch's own
  re-verify step). Same harness, same numbers either way.
