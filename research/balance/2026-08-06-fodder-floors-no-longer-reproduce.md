# "Fodder floors feel empty": doesn't reproduce under current code

**Date:** 2026-08-06 · **Change type:** none (record only) · **Commit:** none

## What moved

Nothing. `PIECE_SPAWN_COST`, the tiered budget loop, and the budget formula
(`state.floor + Math.floor(budgetRng() * 3) - 1`, ratcheted to never
decrease) are all untouched.

## What prompted it

Two open bug reports, consolidated as duplicates and both named in this
folder's own README as "Open, not yet studied":

- `2026-07-20T04:06:37.769Z`: *"fodder levels are boarding without even a
  minor piece to keep it interesting"* (attached screenshot state:
  `floor=5&budget=3`).
- `2026-07-20T04:55:20.898Z`: *"fodder levels like this feel like a waste of
  time"* (`floor=7&budget=6`).

Both notes still pointed at ".scheduler/QUESTIONS.md" for a balance-tuning
delegation answer that was actually given 2026-07-28 — a stale-note instance
of the class FOCUS.md items 15/17 already named, so this report was
re-triaged as part of tonight's usual note-freshness check rather than left
as found.

## The measurement

Swept the current procedural spawn system directly (same harness as
`test/spawn-safety.spec.mjs`): 30 floors x 28 simulated days = 840 spawns,
offset past `NARRATIVE_STAGES` (length 12, so floors 13-42), `lastSpawnBudget`
reset to 0 before each spawn (worst case -- no carryover ratchet inflating
the floor's own budget), counting any floor whose spawned Black army has zero
pieces above a pawn (`cell !== cell.toLowerCase()`-filtered, `p` excluded).

**Result: 0 of 840.** `minBudget` observed across the whole sweep: **12**,
at floor 13. `PIECE_SPAWN_COST.minor` is 3 -- a factor of 4 headroom even at
the sweep's single lowest point.

This isn't a sampling artifact the sweep got lucky on -- it's a closed-form
guarantee given the current constants. The budget formula's minimum value at
floor `f` is `f + 0 - 1 = f - 1` (the `Math.floor(rand*3)` term is >= 0, and
the ratchet only ever raises the floor's budget further). The first
procedural floor is `NARRATIVE_STAGES.length + 1 = 13`, so the *lowest budget
any procedural floor can ever roll* is `13 - 1 = 12`, unconditionally -- four
times the 3-point cost of a minor piece. A "budget too small to afford a
single minor" floor is not just rare under today's code, it is arithmetically
impossible as long as `NARRATIVE_STAGES.length >= 4` (`(stageCount+1) - 1 >=
PIECE_SPAWN_COST.minor`).

## The reasoning

Both reports are old (2026-07-20) and predate the current 12-stage narrative
campaign -- `floor=5&budget=3` and `floor=7&budget=6` are exactly the shape
the budget formula would have produced if floor 5/7 were procedural (as they
apparently were at the time the reports were filed). The campaign's growth to
12 hand-authored floors is what closed this gap, not any deliberate tuning
decision -- nobody set out to fix "fodder floors" by writing more narrative
content, but the side effect is that the procedural system now never starts
before a comfortably large budget.

This is why the change type is "none": there is no number here that needs
moving. The bounded-tuning lever the 2026-07-28 delegation named ("the
minimum interesting force on a fodder floor") turned out to already be
satisfied by unrelated prior work, the same shape as
`2026-08-05-archbishop-value-was-already-fixed.md`.

## The pin

None -- no behavior changed, so per this folder's own rule there is nothing
to pin that could be shown to fail against a prior version. The arithmetic
guarantee above (`NARRATIVE_STAGES.length + 1 - 1 >= PIECE_SPAWN_COST.minor`)
is the thing that would need re-checking if either constant moves in the
future -- flagged here rather than encoded as a test that cannot currently
fail.

## Known limits

- "Fodder" was operationalized narrowly, matching the reports' own words: a
  floor with zero non-pawn Black pieces. It does NOT capture a floor that has
  exactly one weak minor and is otherwise still thin -- Zach's broader
  direction ("more pawns, more terrain... fodder levels should play like a
  platformer/puzzle") is a floor-*composition* and terrain goal past this
  measurement's scope, not settled by this entry.
- Only checked the procedural system (floors past `NARRATIVE_STAGES`). The
  scripted campaign floors are hand-authored and were never in question.
- If `NARRATIVE_STAGES` is ever trimmed back down near or below 4 entries, or
  `PIECE_SPAWN_COST.minor` is raised past `NARRATIVE_STAGES.length`, this
  guarantee breaks silently -- there is no test watching for that (see "The
  pin" above).
