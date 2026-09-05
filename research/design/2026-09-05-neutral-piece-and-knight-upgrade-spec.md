# The neutral evasive piece, the +knight upgrade chain, and the Knightrider — a spec, not a build

**Date:** 2026-09-05 · **Type:** design spec, no code shipped · **hf7y/chezz#98**

## Why spec-first

#98 is explicit: a neutral third side is not additive. `isEnemy`/`isFriendly`
and the search's White/Black alternation assume exactly two sides today —
building the feature before #89's core/narrative seam exists would decide
that seam by accident. This document answers the five questions #98 asked,
each grounded in the actual code (`index1.html`, current `main`), then names
the seam explicitly. It recommends concrete answers rather than leaving every
fork open, per the same instruction the King→Queen spec was held to
(DESIGN-NOTES.md item 4): draft a spec, then checkpoint it with Zach before
any game code.

## 1. Whose turn is it?

**Recommendation: no independent tempo. The neutral piece evades once per
round, resolved after Black's engine move and before control returns to the
player — not a third alternating side inside `search()`.**

The turn model is binary today, load-bearing in more places than the UI loop:
`state.turn` is `"w"`/`"b"` only, round-trips through the FEN-style share URL
(`boardToFen() + "_" + state.turn`), and `search`/`quiesce`/`collectMoves` all
recurse on a single `whiteToMove` boolean — there is no third branch anywhere
in the minimax tree. Giving the neutral piece its own search-visible tempo
would mean threading a third mover through every one of those functions, on
both classic's engine and narrative's — exactly the kind of core-widening
change #89 exists to avoid.

Piggybacking it onto the existing round boundary avoids that entirely: after
`makeMove` resolves White's move and Black's reply (`state.turn` back to
`"w"`), a new step runs the neutral piece's evasion as a plain deterministic
function over the board array — the same shape as `checkFloorProgression` or
`spawnBlackArmy`, which already run non-search logic between plies. The
search never has to know a third piece type exists.

## 2. What does capture mean for a third side?

**Recommendation: the neutral piece is capturable by White only. Black is
excluded from targeting it, by construction, in Black's own move generation
— not by a runtime side-check after the fact.**

`isEnemy(x, y)` today is `isWhitePiece(target) !== isWhite` — symmetric,
because there are only two sides. Making the neutral piece capturable by
*both* sides needs an explicit third branch there, which is a small, cheap
change (the same shape and cost as `isTerrain`'s existing special case,
measured in hf7y/chezz#89's finding at 67–82 bytes stripped). The harder
question is what Black *does* with that capability once it exists: Black's
search is not narrative-aware, and a piece that's simply present and
capturable will be captured by an engine tuned to maximize material the
moment it's profitable to do so — with no way to tell it "this one is the
player's reward, leave it." Making Black capture-eligible for it means the
upgrade chain also needs a Black-side branch (does Black's Bishop become an
Archbishop too?), which compounds Black's difficulty curve in a way nothing
in #98's own framing asked for — the feature's stated purpose is a
player-facing reward on flavor floors, not a new Black power spike.

Excluding the neutral piece from `collectMoves(b, /* whiteToMove */ false)`'s
enemy set is cheaper than adding a runtime rule and answers "why not" by
removing the case entirely: Black's search never sees it as a legal target,
so there is no Black-side upgrade to design, tune, or explain to the player.

## 3. Where does the seam fall against #89?

Named explicitly, in #89's own terms (core = what classic's stripped
artifact can afford; everything else is narrative-only, above the core):

| Piece | Seam | Why |
|---|---|---|
| A new board-cell type + `isEnemy`/`isFriendly` branch recognizing it (White-capturable, never friendly, never a Black target) | **Core** | Same shape and cost as the existing `TERRAIN_WALL`/`TERRAIN_HOLE` special case already in `legalMovesForPiece` — a few dozen bytes, unconditional on which shell loads it. |
| Where/when it spawns (pawn-fodder and terrain floors) | **Narrative-only** | Floor content is `spawnBlackArmy`/`NARRATIVE_STAGES` territory — classic has no floor-content authoring surface for this at all today. |
| The evasion heuristic itself | **Narrative-only** | Runs at the same point `checkFloorProgression` does; not part of `legalMovesForPiece`'s core dispatch. |
| Upgrade bookkeeping (which piece merged with knight movement, promotion-priority interaction) | **Narrative-only** | New persistent per-piece state with no classic equivalent; classic's `PROMOTION_PRIORITY`/pawn-bank model doesn't track piece provenance today. |
| The Knightrider move generator | **Core, and already free** — see §4 | Reuses the existing generic dispatch; costs nothing extra in either shell once the piece type is registered. |

So the actual core addition here is small and cheap (a board-cell type, two
one-line branches, one `PIECE_MOVE_SPEC` entry) — everything expensive and
narrative-specific (spawn placement, evasion AI, upgrade bookkeeping) stays
out of the core by construction, not by discipline.

## 4. The Knightrider generator

**Correction to #98's own framing: this needs no new generator.** `slide(dx,
dy)` (`legalMovesForPiece`'s helper) is direction-agnostic — it repeatedly
adds whatever `(dx, dy)` it's given and checks bounds/blocking each step,
with no assumption that the step is a unit vector:

```js
function slide(dx, dy) {
  let x = fromX + dx, y = fromY + dy;
  while (inBounds(x, y)) {
    if (isFriendly(x, y)) break;
    moves.push({ x, y });
    if (isEnemy(x, y)) break;
    x += dx; y += dy;
  }
}
```

A Knightrider is exactly `PIECE_MOVE_SPEC.<type> = { slides: [KNIGHT_JUMPS] }`
— the same `KNIGHT_JUMPS` array already defined for the Knight's own `jumps`
(line 576), reused as slide directions instead of single steps. Walking
`(2,1) → (4,2) → (6,3) → ...` and stopping at the first friendly piece,
enemy, or **terrain** square is exactly what `slide()` already does for a
Rook's `(1,0)`; nothing in it is rook-specific. Terrain interaction (#98's
Q4, second half) is therefore also free: `isFriendly` already treats
`isTerrain` as blocking, so a Knightrider's line stops at a wall or hole
exactly like a Rook's does, with zero new code.

This means the Knightrider is not the generator risk #98 flagged it as — the
actual new work in this whole feature is entirely in the narrative-only rows
of the table above (spawn placement, evasion AI, upgrade bookkeeping), not in
move generation.

## 5. Difficulty

**Recommendation: the evasion AI is the primary brake, tuned conservatively
at first — do not also gate this behind spawn-rate changes in the same
pass.** A free permanent upgrade is a real power spike, but #98 already
scopes this as flavor content on pawn-fodder/terrain floors, which this
project's own difficulty framing (DESIGN-NOTES.md's terrain section) treats
as tunable sub-systems independent of the main spawn-budget ratchet. Coupling
the upgrade's availability to spawn-rate tuning in the first pass repeats the
mistake #98 itself is trying to avoid — deciding a second open question
(spawn balance) inside a change whose actual job is establishing the seam.
Ship the naive evasion AI (same "don't over-invest the first time" instinct
auto-march's formation-follow was given, DESIGN-NOTES.md item 1), observe
whether it's a power spike in practice, and treat spawn-rate as a follow-up
tuning question if it is — not a prerequisite for landing this.

## Art

Already solved, free, per hf7y/chezz#97's rasterization probe:
`NEUTRAL CHESS KNIGHT` (U+1FA46) renders cleanly at 16×16 from Noto Sans
Symbols2, the webfont `index1.html` already loads. No new art, no
half-white/half-black treatment needed.

## Recommendation

Build the core seam (board-cell type, `isEnemy`/`isFriendly` branch,
`PIECE_MOVE_SPEC` entry for the Knightrider) as a small, self-contained,
classic-compatible change once #89's core exists. Hold the narrative-only
half (spawn placement, evasion AI, upgrade bookkeeping) for a scoped
follow-up. Checkpoint this spec with Zach before either half starts — filed
as hf7y/chezz#102.
