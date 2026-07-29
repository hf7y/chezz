# Spawned pawns must never be free material

**Date:** 2026-07-29 · **Change type:** spawn rule (balance) · **Commit:** see below

## What moved

The rule governing where a procedurally spawned Black pawn may be placed.

| | Old | New |
|---|---|---|
| `placePawn()` | first empty square found, **no safety check at all** | prefers an unattacked square; falls back to an attacked-but-**defended** square; places nothing if neither exists |
| shield-pawn path (tier loop) | pawn placed to shield a back-rank piece, **shield itself unchecked** | shield must also be unattacked or defended |

No numeric constant changed. `PAWN_ALLOWANCE_CHANCE` (0.3) and
`PIECE_SPAWN_COST` are untouched.

## What prompted it

A report cluster of at least four, recurring since 2026-07-18: *"black pawn
spawns hanging, major problem"*, *"should not spawn under threat"*, *"pawns
should never hang on load"*.

For months this was triaged as **intentional design, not a defect**, on the
strength of a comment in the source: pawns are *"meant to stand in the open."*
That reading was escalated as a design fork on 2026-07-24 and answered by Zach
on 2026-07-28:

> "No. Never. Pawns can spawn under threat if they are defended by another
> piece. But the 'stand in the open' logic was not stated by zach. Free
> material on level load is not a good design. [...] For now, the general
> design is more pawns, more terrain, never free on fodder levels. Fodder
> levels should play like a platformer / puzzle."

The methodological point worth recording: **the justification was an inference
that had hardened into a citation.** A comment written by automation was later
read by automation as authority, and three separate triage passes deferred a
real defect because of it. Nothing outside the codebase ever asserted it.

## The asymmetry this closes

This was never a whole-spawner policy — it was one path missing a check the
path directly beside it already had.

- The **non-pawn** spawn path already tried every back-rank column for a safe
  square, and, failing that, would *spend additional budget* placing a shield
  pawn rather than drop the piece somewhere it hung.
- The **pawn** path took the first empty square, unconditionally.

So the spawner would pay real budget to protect a bishop and simultaneously
hand over a pawn for nothing. The fix makes the cheap path obey the rule the
expensive path already followed.

## The measurement

Reproduce: `npx playwright test spawn-safety -g "hangs against a carried"`.

Sweep: 12 procedural floors (offset past `NARRATIVE_STAGES`) x 3 carried White
piece types (R, Q, B) x 8 files = **288 floor spawns**, producing ~276 pawns.
A carried long-range piece is what actually threatens the pawn ranks, which is
why this and not the bare-King sweep is the meaningful configuration.

| | Old | New |
|---|---|---|
| Attacked-and-undefended spawned pawns | **16** | **0** |
| Total pawns spawned in sweep | 276 | 279 |
| Pawn supply, 840-spawn sweep (avg/floor) | 0.95 | 0.95 |

**Pawn supply is unchanged**, which was the main risk: a stricter placement
rule could have starved the promotion and carryover mechanics that depend on
pawn availability. It did not — the spawner simply finds a different square,
and the count even rises slightly (276 -> 279) because a pawn that previously
consumed budget while hanging is now placed somewhere it survives.

So the cost of this change is approximately zero and the benefit is the removal
of ~5.8% of spawned pawns being free material.

### A correction worth preserving

The first draft of this entry claimed **114** violations. That was Playwright's
`Received + 114` — a count of printed *lines* in the diff, not of findings: 16
objects at 7 lines each, plus two bracket lines, is exactly 114. It was caught
only because an independently written measurement returned 16 and the two
numbers were reconciled instead of the convenient one being trusted. Recorded
here because the failure mode generalizes to any measurement read off a test
reporter rather than counted directly.

## The pin

`test/spawn-safety.spec.mjs`:

- **"no spawned black pawn hangs against a carried long-range army"** — the
  real regression witness. Verified to fail against the pre-fix `index1.html`
  (16 violations) and pass against the fix (0), reproduced three times with
  `--workers=1` so the attribution is not an artifact of interleaved output.
- **"no spawned black pawn is ever attacked and undefended (840 combinations)"**
  — a broader standing invariant guard. **It passes against the pre-fix build
  too** and is therefore *not* a witness: with only a King on the board, almost
  nothing reaches the pawn ranks. Documented as such in the test itself rather
  than left to look like evidence it isn't.

Both define their defender probe locally rather than calling the game's new
`isDefendedSquare`, so they test behavior instead of restating the fix.

## The reasoning

**Why "defended" and not "never attacked"?** Zach's answer explicitly permits a
pawn to stand under threat when defended. That is ordinary chess: an attacked-
but-defended pawn is a trade offer, and trades are content. An undefended one
is a gift. The rule targets gifts only, which also keeps the spawner's
placement freedom wide enough not to distort floor composition — borne out by
the unchanged pawn average.

**Why prefer safe squares over defended ones, rather than treating them as
equal?** Making a trade the fallback rather than the default keeps floors from
drifting toward a uniform texture of mutual captures. Cheap to do: the safe
pass runs first and usually succeeds on the first square it tries.

**Why place nothing when neither exists, instead of placing the pawn anyway?**
Because "never free material" is the rule being implemented, and a spawner that
abandons it under pressure has not implemented it. No pawn beats a free pawn.
In practice this branch is nearly unreachable — the pawn ranks are 5 rows deep
and would have to be almost entirely covered by White for it to trigger.

## Known limits

- Measured only against **carried long-range pieces on open files**. A dense
  carried army with knights was not swept; knight-vector threats are the case
  the shield logic already documents as hardest to block.
- Says nothing about whether the *resulting* floors are more fun. It removes a
  category of unearned material; it does not establish that fodder floors now
  "play like a platformer / puzzle," which is a larger design goal needing
  terrain and pawn-count work, not just a placement rule.
- The scripted `NARRATIVE_STAGES` floors are unaffected — their pawns are
  hand-authored, and a stage's front pawn wall facing a clear file is normal
  chess exposure rather than this defect.
