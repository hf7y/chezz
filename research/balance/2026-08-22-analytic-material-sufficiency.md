# Analytic material sufficiency: a decision procedure, one proven small case, and a non-monotonicity

**Date:** 2026-08-22 · **Change type:** none (record only) · **Commit:** none

## What moved

Nothing in the game. This is the research this folder marked "Open, not yet
studied" -- routed to hf7y/bibliothecaire#57 per the 2026-08-16 direction in
issue #6, answered analytically (no playtesting, no statistics), and
recorded here in full since that direction also said this lane is the right
home for it.

## What prompted it

The README's own "Open, not yet studied" entry: *"solve analytically what
White material is actually needed to beat a given Black composition, rather
than inferring difficulty from a search proxy... I want real analytic math,
not playtesting or statistics"* (Zach, hf7y/chezz#6).

## The measurement

Not applicable in the usual sense -- there is no before/after sweep, because
the deliverable is a proof and a decision procedure, not a tuned constant.
The rules relied on below are read directly from `index1.html`, not
inferred:

- Board 8x9, `EXIT_ROW = 0`; White's King reaching it ends the floor
  immediately (`index1.html:527,586`).
- Black may never move onto `EXIT_ROW` (`index1.html:657`).
- Black has no king anywhere on the board -- no check/checkmate rule
  restricts Black's moves (`index1.html:707-708`).
- White's legality check is real chess-style self-check prevention, applied
  to *every* White move (not just King moves): `isLegalMove` routes all of
  them through `kingSafeAfterMove` (`index1.html:668-690`). A White King is
  therefore only ever captured in the classical checkmate sense -- never by
  a move that was legal to make.
- Captured material feeds promotion on **both** sides through one shared
  pool string (`autoPromote`, `index1.html:803-838`): a pawn promotes only
  by spending an already-captured piece of matching type from the opponent.

## The reasoning

**1. General characterisation.** A floor's state (board + captured pool +
side to move) is finite, so this is exactly a finite two-player,
perfect-information reachability game. Such games are determined (Zermelo,
1913) and their winning region is computed exactly by backward induction /
retrograde analysis -- the same method that builds exhaustive chess endgame
tablebases (e.g. Thompson, 1986):

```
W_0 = { White King already on EXIT_ROW }
W_(n+1) = W_n
        ∪ { White-to-move states with some legal move into W_n }
        ∪ { Black-to-move states where every legal Black move stays in W_n }
```

The fixpoint of this (reached in finitely many steps -- the state space is
finite) *is* the set of `(B, W, position)` triples where White forces the
win: exhaustive and exact, not sampled. That's the general answer to
"characterise `W`" -- there's no reason to expect, and this doesn't claim, a
closed-form formula for an unconstrained Black army; the fixpoint is the
decision procedure the question actually admits.

**2. Proven small case.** A single unsupported Black piece (any type -- p,
n, b, r, q, a, c, m) never suffices against bare White King alone, on a
terrain-free floor. It's necessarily undefended (Black has no king). Either
it's off the King's current lines and the King routes around it (one piece
covers only one line or line-pair; board width 8 leaves other columns
free), or it's adjacent, in which case the King simply captures it
(`kingSafeAfterMove` only forbids landing on a square a *remaining* Black
piece attacks), collapsing the position to the trivial `B=∅` win. This is
the kingless-Black analogue of the standard chess-endgame fact that a lone
piece can't force mate without its own king's help, strengthened here
because the lone piece is outright capturable rather than merely
insufficient.

**3. A non-monotonicity the flat `pieceValues` sum misses.** Because the
captured pool is shared, giving White a *stronger* piece that later gets
captured can hand Black a promotion (to `q`, `m`, etc.) it would otherwise
never reach -- a Black pawn one step from `BLACK_PROMOTION_ROW` with an
empty pool just steps off the board instead of promoting
(`index1.html:817-818`). So `W ⊆ W'` does not imply `W'` wins whenever `W`
does: sufficiency is not upward-closed in material, and the engine's own
flat point-sum (`index1.html:860-867`) doesn't capture this at all.

Full proofs and the exact reasoning for (2) and (3), plus the fixpoint's
precise treatment of `checkStalemate`'s floor-reset case, are consigned at
`/srv/ecosystem1-vault/chezz-research/analytic-material-sufficiency.md`.

## The pin

None -- no behavior changed; nothing here is code.

## Known limits

- The general n-piece coordinating-army boundary (several Black officers,
  terrain, the promotion-pool coupling from (3) all in play) has no
  closed-form answer here. Given (3) alone, I doubt a useful closed form
  exists -- the sufficiency set isn't even monotone in the natural partial
  order, so a general "bound" would have to be a per-composition table, not
  a formula. The fixpoint in (1) is the tool for deciding any specific case
  exactly; (2) is the one case small enough to have proved by hand instead.
- This does not touch terrain (walls/holes) -- those are floor-authored, not
  part of a material composition, and are out of scope for this question by
  construction.
