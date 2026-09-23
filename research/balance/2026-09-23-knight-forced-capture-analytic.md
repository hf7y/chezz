# A lone King can never force "The Knight" boss's capture — pawn count isn't the lever

**Date:** 2026-09-23 · **Change type:** no game-code change; analytic finding + a corrected design record · **Commit:** see below

## What moved

Nothing in `index1.html`. This resolves the *question*, queued in this
file's own "Open, not yet studied" section on 2026-09-21, not a constant.

## What prompted it

hf7y/chezz#120: *"fence on knight level seems strange. fence/wall tiles
should gate the back rank until knight capture. but that would be
difficult. requires research pass for min number of pawns to force knight
capture."* Three prior triage passes (bug-sweep 2026-09-11, nightly-batch
2026-09-17, nightly-batch 2026-09-18) each agreed the concrete ask — a
researched minimum carried-pawn count that forces the Knight boss to
capture — was real analytic work belonging in this lane (issue #6's
"analytic proofs, not playtesting or statistics" method), but none of them
did it; the 2026-09-21 pass only filed a queue entry pointing at it.

## The measurement

**Method: exhaustive backward-induction solve of the reduced game, not
playtesting.** `research/balance/2026-09-23-knight-chase-solve.mjs`
enumerates every `(King square, Knight square, side to move)` state on
"The Knight" stage's actual board (`BOARD_COLS=8`, `BOARD_ROWS=9`,
`EXIT_ROW=0`, wall at row 6 open only at columns 3–4 — the stage's
authored, unshifted layout) and computes the exact set of states from
which White can force a capture, under the real movement rules in
`index1.html` (`legalMovesForPiece`'s King/Knight generation,
`kingSafeAfterMove`'s King-only hang restriction, the Black-can't-enter-
`EXIT_ROW` filter). This assumes Black plays **perfect adversarial
evasion** — the standard framing for a "is White's material sufficient"
question (same as asking whether K+R vs K is theoretically won, not
whether a specific bot finds it) — deliberately independent of whatever
`getBlackMoveRuthless` actually does search-depth-wise.

The algorithm is the standard attractor/backward-induction fixed point for
finite two-player reachability games: White-to-move states are OR-nodes
(win if any legal move captures or reaches a won Black-to-move state),
Black-to-move states are AND-nodes (win only if *every* legal Knight move
— including the single "no legal move, turn passes" case, which really
happens per `state.turn = "w"` being set unconditionally after Black's
reply in the real move loop — leads to a won White-to-move state). This is
exact and exhaustive (7,598 states total), not sampled.

**Result:**

| | |
|---|---|
| White-to-move states, total | 3,828 |
| ...that are forced wins for White | 438 (11.44%) |
| King-starts-at-home (rows 7–8, all 8 columns) vs. the Knight's authored square (col d, row 4) | **0 of 16 are forced wins** |
| Immediate King deadlocks among the losing states | 0 (Black evades forever; White is never stuck with zero moves) |

So from *every* realistic starting configuration — King anywhere on its
own back two ranks, Knight on its scripted square — a lone King cannot
force the Knight's capture. The 11.44% of state pairs that *are* forced
wins are concentrated in corner/edge configurations where the Knight has
already been chased into a low-mobility square; they're not reachable from
the stage's actual starting shape without the Knight cooperating.

Reproduce: `node research/balance/2026-09-23-knight-chase-solve.mjs` (plain
Node, no browser/Playwright — this is graph search over an abstracted
state space, not a simulation of the live game).

## The reasoning

**Why this matters beyond answering "what's the minimum pawn count":** it
dissolves the question rather than answering it with a number. The
2026-07-20 design refinement's own worked example is King-plus-pawns vs. a
lone Knight *behind a gate narrow enough that only the King fits through*
— the pawns are explicitly excluded from the fight by the gate's own
design. So "minimum pawn count to force the capture" has no answer under
that framing: pawns structurally never reach the Knight, and the lone King
that does reach it can't force the capture at all, for any N.

**A second, independent gap, found while reading `checkFloorProgression`
and `newFloor` to model the board correctly:** the wall doesn't actually
gate anything today. `checkFloorProgression` (index1.html) clears the
floor the instant `state.board[EXIT_ROW]` contains `"K"` — it never checks
whether the current stage's `bossPiece` is still alive. `newFloor` builds
the next floor by scanning the *whole* board for surviving White pieces,
not just the pieces that crossed the gate. So today, the King can walk
past the Knight to the exit without capturing it, and any pawns left
behind the wall carry over to the next floor anyway. hf7y/chezz#120's own
report FEN — filed at the moment right after a real capture
(`captured=Pn`, `last=...ng31xe32,Kd32xe32`) — independently shows a pawn
sitting on file c, one file outside the row-6 gate (files d/e): that pawn
reached the new floor without ever having walked through the gap, which
only makes sense if carryover really is position-independent, matching
the code reading.

**Put together:** the current shipped behavior (wall opens once the boss
happens to die, doesn't block progression either way) is the *safe*
reading, not a bug to fix by tightening it. Given the proof above, making
`checkFloorProgression` require `bossPiece` to be dead — the literal
reading of "mandatory, not optional" — would convert a cosmetic mismatch
into a genuine failure mode: a King that cannot force the kill and cannot
progress either, stuck facing a Knight that (per this proof) can evade it
forever. Nothing in the surrounding code makes that unreachable; it isn't
a deadlock (White always has *some* legal move — see the zero-deadlock
row above) but it is a floor that can never be cleared for as long as
Black keeps running, which is worse than the status quo, not better.

## Known limits

- Modeled only the stage's **authored, unshifted layout** (wall gap at
  columns 3–4, matching the actual `NARRATIVE_STAGES` entry).
  `placeScriptedStage`'s capture-safety cyclic shift can move the gap to
  other column pairs, and one shift value (+4) splits it into two
  *separate* one-wide gaps at opposite edges instead of one two-wide gap —
  a materially different topology not solved here.
- This is a **King-alone** solve, matching the "only the King can pass"
  gate framing literally. It does not check whether letting a *second*
  attacking piece (one pawn, say) through changes the verdict — two
  attackers routinely corner a lone Knight where one can't, so that's a
  plausible lever, but adding a piece multiplies the state space
  (attacker-pair positions × Knight position × side-to-move) well beyond
  what's justified for tonight without a concrete request for it.
- Says nothing about whether "Two Bishops" (the other `wallRow`/
  `bossPiece` stage, two sliding pieces rather than one knight-mobility
  piece) has the same problem — sliding pieces run out of safe squares
  against a King in enclosed terrain much faster than a Knight does, so
  the verdict likely doesn't transfer, but that's a separate solve, not
  assumed here.
- Assumes Black plays *perfect* evasion. The shipped
  `getBlackMoveRuthless` demonstrably does not always evade (player
  reports, including #120's own, show real captures happening) — this
  finding is a ceiling on what a hard gate could ever guarantee, not a
  claim about what the current bot does in practice.

## Follow-up

DESIGN-NOTES.md's 2026-07-20 terrain entry is corrected in place to point
here. The remaining question — accept the wall as one-time flavor for a
Knight boss, or invest in a different lever (extra attacker let through,
smaller arena, or a non-Knight boss) to actually deliver the "mandatory
encounter" the worked example described — is a real design fork, not an
engineering task, and is filed as hf7y/chezz#142.
