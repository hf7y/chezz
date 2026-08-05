# Chezz balance research

A record of every deliberate change to a *balance number* in Chezz -- piece
values, spawn budgets, spawn rules, floor composition -- written so that
someone outside the project can follow what was changed, what it was measured
against, and why it was believed to be an improvement.

This folder exists because of a specific instruction (Zach, 2026-07-28), when
he delegated balance tuning to the project's unattended nightly runs:

> "Yes. Balance tuning is good for nightly work. In fact, this research should
> be documented in its own lane, like a folder, since it may be interesting to
> other researchers. This is scholarship."

So the deliverable here is the *record*, not the constants. The constants are
its output. An entry that only says "changed X from 3 to 4" has not done the
job.

## What Chezz is, for a reader arriving cold

Chezz is a daily-seeded roguelike played by chess rules. The player controls a
single White King (plus whatever material they carry over between floors) and
descends a series of floors. Each floor spawns a Black army procedurally from a
budget that scales with floor depth, seeded from the calendar date -- so every
player faces the identical sequence on a given day, and a floor is reproducible
forever from `(floor, day)`.

That reproducibility is what makes tuning here measurable rather than
anecdotal: any claim in this folder can be re-derived by re-running the seed.

## The standing rule for a tuning change

Delegated tuning is bounded. A nightly run may change what a number *is*; it
may not change what a piece *does* or how a floor is *structured* -- those stay
human design calls. Every tuning change must land with:

1. **A regression test pinning the new behavior**, which demonstrably fails
   against the old one. A test that passes both ways is not a pin; if it can't
   be made to fail, say so in the entry rather than implying a witness that
   doesn't exist.
2. **An entry in this folder**, following the template below.
3. **A line in the run's report** saying what moved and why.

## Method notes, learned the hard way

- **Sweep, don't sample.** A single seed proves nothing. The convention here is
  30 floors x 28 simulated days = 840 spawns, achieved by overriding `todayKey`
  in the page rather than faking the system clock.
- **Offset past the scripted floors.** The early narrative floors
  (`NARRATIVE_STAGES`) are hand-authored and contain no RNG. Sweeping them
  measures authored content, not the procedural system under study.
- **Measure with a probe defined in the test**, not by calling the same helper
  the change introduced. Otherwise the test is a tautology and cannot fail
  against the pre-change build.
- **Read the measurement, not the diff.** Playwright's `Received + N` is a
  count of printed *lines*, not of findings. This folder's first entry was
  nearly published claiming 114 violations when the true count was 16 -- the
  same result printed at 7 lines per object. Cross-check any headline number
  against an independent count before writing it down.

## Entry template

Each entry is one file, `YYYY-MM-DD-<slug>.md`:

- **What moved** -- the constant or rule, old value -> new value.
- **What prompted it** -- the report, observation, or human call, quoted.
- **The measurement** -- before/after numbers, and exactly how to reproduce.
- **The reasoning** -- why this change and not a different one; what was
  considered and rejected.
- **The pin** -- which test now holds the line, and the evidence it fails
  against the old behavior.
- **Known limits** -- what this did NOT establish.

## Index

- [2026-07-29 — spawned pawns must never be free material](2026-07-29-pawn-spawn-free-material.md)
- [2026-08-05 — archbishop material value: already fixed, three weeks before this lane existed](2026-08-05-archbishop-value-was-already-fixed.md)

### Open, not yet studied

Named here so the gaps are visible rather than implied. Three of the original
four were unblocked by the 2026-07-28 delegation and are not yet done
(archbishop material value was removed from this list 2026-08-05 -- it turned
out to already be fixed, see the index entry above):

- **Pawn supply** — reported as too thin; `PAWN_ALLOWANCE_CHANCE` currently
  yields ~0.95 pawns/floor (measured 2026-07-29, 840-spawn sweep).
- **Fodder floors feel empty** — two separate reports. Relates directly to
  Zach's stated direction: "more pawns, more terrain, never free on fodder
  levels. Fodder levels should play like a platformer / puzzle."
- **Analytic material sufficiency** — the long-term ask: solve analytically
  what White material is actually needed to beat a given Black composition,
  rather than inferring difficulty from a search proxy. Research-scale.
