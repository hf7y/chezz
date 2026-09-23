# The Knight stage's wall can't be a real gate -- any width that lets White through also lets the Knight bypass it, and gap=0 is a permanent dead end

**Date:** 2026-09-22 · **Change type:** none (record only) · **Commit:** none

## What moved

Nothing in the game. This is the queued item from research/balance/README.md's
"Open, not yet studied" section (added 2026-09-21, hf7y/chezz#138): the
minimum carried-pawn count that would let White force-capture the Knight
boss if its wall were made to actually gate the back rank until that
capture, per issue #120's literal ask. Answered analytically, not by
computer sweep -- and answered in the negative before the pawn-count
question is even reachable.

## What prompted it

hf7y/chezz#120 (player report, `4ad79e`): *"fence on knight level seems
strange. fence/wall tiles should gate the back rank until knight capture.
but that would be difficult. requires research pass for min number of
pawns to force knight capture."* Three prior triage passes (bug-sweep
2026-09-11, nightly-batch 2026-09-17 and 2026-09-18) each deferred this as
real analytic work belonging in this lane, without attempting it.

## The measurement

No sweep -- the claim is a proof, verified computationally against the
actual game functions (not a reimplementation) rather than sampled:

- Board is 8 cols x 9 rows, `EXIT_ROW = 0` (`index1.html:575-577`).
- "The Knight" stage: `{ rows: ["8","8","8","3n4","8","###11###"], wallRow: 6,
  bossPiece: "n" }` (`index1.html:1655`). `rows[5]` (`"###11###"`) becomes
  board row 6: three wall squares, a 2-square gap, three wall squares.
  `placeScriptedStage` (`index1.html:1702-1718`) cyclically shifts every
  row by the same amount to dodge a carried piece's line of attack, but
  the shift is applied identically to all 8 columns of row 6 -- the gap
  width never changes, only which columns it sits on. Verified for all 8
  possible shifts (a fresh Playwright probe, not shipped -- superseded by
  the permanent guardrail below): gap width is exactly 2 in every case.
- White's carried army spawns entirely on rows 7-8 before `spawnBlackArmy`
  runs (`NARRATIVE_STAGES`'s own comment, `index1.html:1633-1635`); nothing
  White controls starts above row 6.
- Terrain blocks *landing*, for every piece type, via `isFriendly`
  (`index1.html:682-688`, `isTerrain(target)` returns `true`) -- checked by
  both `slide()` and `step()`. The King moves by `step()`
  (`PIECE_MOVE_SPEC.k`, `index1.html:630`), so a fully-walled row 6 leaves
  it zero legal moves off rows 7-8: every square in row 6 fails
  `isFriendly` before the King can land there.
- A pawn's double-move is nested inside the single-step check
  (`index1.html:723-727`: the `fromY === startRow` branch only runs once
  `isEmpty(fromX, fromY + dir)` -- one square ahead -- already holds), so a
  fully-walled row 6 blocks a rank-7 pawn's single step and therefore its
  double-move too; it can never leapfrog the row.
- A Knight moves by `step()` too, but `step()` only tests the *landing*
  square -- there is no path-blocking check for a jump the way `slide()`
  blocks a rook/bishop/queen mid-slide. So a Knight one square above a
  fully-walled row 6 can jump straight into row 7 or 8 regardless: its
  landing square there is empty, `isFriendly` only inspects that one
  square, and the wall in between is never consulted.
- Confirmed directly against the live functions (`legalMovesForPiece`,
  via `page.evaluate` in Playwright, same harness the rest of this suite
  uses) rather than argued from reading alone: with row 6 entirely `#`
  and a King at (4,8) plus 7 White pawns filling the rest of rows 7-8 (the
  densest plausible carried-over rank), zero legal moves of any White
  piece land at `y <= 5`. In the same position, a Black Knight placed at
  (3,5) -- one square above the solid row -- has a legal move landing at
  `y = 7`, inside White's own rows. Both checks are now a permanent
  regression in `test/terrain.spec.mjs` ("closing The Knight stage's wall
  gap entirely would trap White behind it forever, for any pawn count"),
  so this isn't a one-off finding that could silently stop being true.

## The reasoning

The ask has exactly two possible shapes, and both fail:

**Gap width >= 1 (anything short of fully solid).** The King only needs
one open square per row-6 crossing, at any column, and can then move
freely afterward (rows 1-6 have no further terrain in this stage). So *any*
nonzero-width opening is exactly as passable as the current 2-square one --
narrowing it to 1 square changes nothing about whether it gates progress,
only how exposed the King is while crossing it (a combat-difficulty
question, not a gating one, and out of scope for this ask). This is
already the shipped behavior, and it's already pinned: `test/terrain.spec.mjs`
asserts `beforeHasGap` is `true` with the comment "never a full-width,
unpassable block." The player's report is accurate that this doesn't gate
anything -- that's confirmed intentional, not a bug.

**Gap width == 0 (a genuine hard gate).** This is what #120 is actually
asking for, and it can never be forced open by White, for any N. The
asymmetry is the whole story: White's King and pawns move by sliding or
single steps, both of which `isFriendly` blocks at a wall square, so they
are physically confined to rows 7-8 for as long as the wall stands --
confirmed above for a King plus 7 pawns, and the argument doesn't change
for any smaller N; adding pawns doesn't create a route across a row with
no open square in it. The Knight, by contrast, moves by jump, which never
checks the squares in between -- it can enter rows 7-8 at will regardless
of the wall, gap or no gap. So the *only* way the capture could ever
happen is if the Knight jumps into a square some White piece already
threatens. Black has no king on this board and nothing to protect or gain
by doing that (`kingSafeAfterMove`/`hasAnyLegalMove`'s own comments,
`index1.html:742-744,784-793`, establish Black has no self-preservation
constraint being *imposed* on it here -- the question is whether an
adversary trying to avoid capture ever has to accept it, and it doesn't).
A Knight that simply never jumps within reach of the King is never
captured. White cannot walk out to force the issue, so there is no pawn
count or arrangement -- 0, 1, 30 -- that changes the outcome. This isn't a
narrow gap that makes forcing the capture *hard*; it's a topology where
White has no route to initiate contact at all, so "hard gate" and
"forced capture eventually happens" are mutually exclusive under this
mechanism. (It's also a stronger break than just "the boss is
uncapturable": since row 6 is also this floor's only route toward
`EXIT_ROW`, a hard gate would make the entire floor unbeatable, not only
the boss fight, for as long as the wall stood -- which, under this
mechanism, is forever.)

## The pin

`test/terrain.spec.mjs`, "closing The Knight stage's wall gap entirely
would trap White behind it forever, for any pawn count" -- asserts zero
White legal moves cross a solid row 6 (King + 7 pawns), and that a Black
Knight adjacent to that same solid row *can* jump across it. No balance
number changed, so there's nothing to pin a before/after regression
against; this pins the underlying rule the impossibility rests on instead,
so a future change to jump/slide/terrain interaction that broke the
asymmetry would be caught here before someone tried to build the hard
gate on top of it.

## Known limits

- This rules out the wall+permanent-gap primitive specifically, as read
  today. It does not rule out every possible way to build "the Knight
  boss meaningfully gates progress" -- e.g. a scripted trigger that forces
  the Knight to advance after some number of turns, or a wall that opens
  only after a turn counter, are different mechanisms with their own
  tradeoffs and aren't analyzed here.
- Doesn't address the player's implicit secondary point, that the current
  wall is easy to read as "must defeat the Knight" when it doesn't
  actually require that. That's a communication/telegraphing question,
  not a rules question, and is a separate, smaller ask than the one #120
  filed.
