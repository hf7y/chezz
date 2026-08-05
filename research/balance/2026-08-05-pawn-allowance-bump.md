# Pawn supply: PAWN_ALLOWANCE_CHANCE 0.3 -> 0.5

**Date:** 2026-08-05 · **Change type:** spawn budget (balance) · **Commit:** see below

## What moved

`PAWN_ALLOWANCE_CHANCE`, the per-spawn-attempt probability of one extra pawn
funded on top of the tiered piece budget: **0.3 -> 0.5**. Nothing else --
`PIECE_SPAWN_COST` and the tiered budget formula are untouched.

## What prompted it

Tracker `2026-07-16T07:44:06.011Z`: *"lack of pawns captured last turn makes
whites starting position too open. but there were no pawns to capture."*

This report is the second-oldest open feature report in the backlog. It was
previously retired-and-requeued on 2026-07-29 once balance tuning was
delegated, with a note that the baseline it disputes -- 0.95 pawns/floor,
36.5%-ish of floors with none -- was now a measured number rather than an
impression, but no tuning change was made at the time ("not done tonight for
time, not for permission").

The report's actual complaint is about a **specific floor with zero pawns**,
not the mean. That's the number this change targets first.

## The measurement

Reproduce: sweep `SWEEP_SIZE=30` procedural floors (offset past
`NARRATIVE_STAGES`) x 28 simulated days = 840 spawns, via `spawnBlackArmy()`
directly (same harness as `test/spawn-safety.spec.mjs`), at each candidate
value of `PAWN_ALLOWANCE_CHANCE` in turn (it's a `const`, so each value
requires editing the source and re-running, not a single parameterized pass).

| `PAWN_ALLOWANCE_CHANCE` | avg pawns/floor | floors with 0 pawns | avg army size |
|---|---|---|---|
| 0.3 (old) | 0.99 | 36.5% | 4.125 |
| 0.4 | 1.10 | 30.8% | 4.242 |
| **0.5 (new)** | **1.18** | **26.3%** | **4.317** |
| 0.6 | 1.31 | 19.6% | 4.461 |
| 0.7 | 1.39 | 15.1% | 4.545 |

(The pinned test in `spawn-safety.spec.mjs` measures 0.95 avg / higher
zero-pawn rate for 0.3 rather than 0.99 above -- same methodology, different
day-seed string in the two harnesses, so the exact decimal differs slightly
by construction. Both land in the same ballpark and neither changes the
conclusion.)

## The reasoning

**Why 0.5 and not one of the other four measured values?** The tradeoff is
monotonic and roughly linear across the whole 0.3-0.7 range: every step buys
a further zero-pawn-rate cut at the cost of a further army-size increase.
There's no inflection point in the data that picks a value on its own, so the
choice is a judgment call about how much of that tradeoff to spend in one
step. Two things argue for 0.5 specifically:

- **The delegation is bounded tuning, not a redesign.** Zach's broader
  direction ("more pawns, more terrain, never free on fodder levels") is a
  real signal to move in this direction, but it's a floor-composition goal
  set alongside terrain and difficulty-detection work this repo hasn't done
  yet (see the two still-open "fodder floors feel empty" reports and the
  analytic-material-sufficiency question). Spending the whole gap in one
  tuning commit, with no terrain or difficulty-curve work alongside it to
  absorb the resulting army-size growth, outruns what a bounded number change
  should do alone.
- **0.5 is the smallest step that moves both numbers by an amount too large
  to be noise.** 0.3 -> 0.4 cuts the zero-pawn rate by only ~6 points; 0.4 ->
  0.5 by another ~4.5. Past 0.5 the zero-pawn cut per 0.1 step keeps paying
  off, but so does the army-size cost, at very similar per-step ratios all
  the way to 0.7 -- there's no later point in the sweep that's a visibly
  better deal than 0.5 was already.

**Why not resolve the tracker report outright?** Because the change is
real but modest, and a specific player's "there were no pawns to capture" on
one floor is not guaranteed to feel meaningfully different at 26.3% zero-pawn
floors versus 36.5% -- it is still better than one in four floors, not solved.
The report is left open with this measurement attached rather than closed,
so a future run (or a human) has the full 0.3-0.7 table to decide whether to
push further, and the report itself stays visible until someone judges the
complaint actually addressed.

## The pin

`test/spawn-safety.spec.mjs`, `"pawn supply averages roughly one per floor
across floors and days"`: tightened from an 0.8-1.4 loose sanity range (wide
enough to pass at both the pre- and post-2026-07-14 values) to `> 1.05` /
`< 1.4`, plus a new `zeroPawnPct < 30` assertion. Verified to fail against
0.3 by temporarily reverting the constant (`avgPawnsPerFloor` measured 0.95,
fails the new `> 1.05` bound) and re-confirmed passing at 0.5.

## Known limits

- This does not touch the "fodder floors feel empty" reports or the pawn-
  spawn-safety work (`2026-07-29-pawn-spawn-free-material.md`) -- it only
  changes how OFTEN a pawn spawns, not where it's placed once it does.
- Army-size growth (+4.7% at floor level) was not checked against the
  material-sufficiency search proxy (`material-tuning.spec.mjs`) beyond the
  full test suite passing. If a future floor-difficulty pass finds floors
  running measurably harder post-bump, this is the first place to look.
- The sweep offsets past `NARRATIVE_STAGES`, so the hand-scripted early
  floors are unaffected by this change entirely -- as intended, since they
  carry no RNG to tune.
