# Spec: the neutral evasive piece, the +knight upgrade chain, and the Knightrider

**Date:** 2026-09-05 · **Type:** spec, no code shipped · hf7y/chezz#98

Per #98: this is the reviewed deliverable, not the implementation. It answers
the five questions #98 asked, grounded in the actual engine (`index1.html` on
`main`, read function-by-function -- not guessed), and names the seam against
#89. Implementation must not start until this is reviewed; see the checkpoint
issue filed alongside this spec.

## What the feature is (from DESIGN-NOTES.md, 2026-07-20 seed list)

A neutral (half-white/half-black) horse-shaped piece that always tries to
evade capture, seeded as flavor on fodder/terrain floors. Capturing it grants
the capturing piece a permanent **+knight** upgrade: Bishop→Archbishop,
Rook→Chancellor, Queen→Amazon. A piece already knight-combined becomes a
**Knightrider** -- repeats a knight-leap vector in a straight line. Ruled
narrative-only per #95 (#89 makes the core what classic can afford; a neutral
third side is not that).

## 1. Whose turn is it?

**Recommendation: the neutral piece does not get its own ply.** It moves
reactively, spliced into `makeMove` (`:2100`) right after Black's move
resolves and before control returns to White (`state.turn = "w"` at
`:2167`) -- so it always sees the freshest board (both this White move and
this Black move already applied) before choosing where to flee, and never
consumes a turn slot from either side.

Rejected alternative: a third value for `state.turn` (`"n"`). `state.turn`
is read as a two-valued string at every one of its 8 assignment/comparison
sites today (per code reading; none of them null-check or default), so a
third value means auditing and branching every one of those sites for a
case they don't currently handle -- for a piece that, by design, always
moves immediately, so it never actually needs to *hold* the turn between
player interactions the way White/Black do. A same-tick reactive move
gets the same visible behavior (the piece relocates once per full turn)
for a fraction of the surface area changed.

## 2. What does capture mean for a third side?

**Recommendation: either side can capture it, and either side gets the
upgrade.** Nothing in DESIGN-NOTES restricts this to White, and restricting
it would need its own justification the seed list doesn't give. Concretely:

- **Representation gap (the real unsolved piece of this question).** Every
  piece today is a single char whose case is its color:
  `isWhitePiece(piece) { return piece === piece.toUpperCase(); }` (`:572`).
  A neutral piece has no case that makes it neither. The fix is the same
  *shape* of special-case the engine already has for terrain -- `isEnemy`
  and `isFriendly` (`:621`, `:630`) each already carry one exception line
  before falling through to the `isWhitePiece(target) === isWhite`
  comparison (`isTerrain(target)` returns `false`/`true` respectively).
  Adding `isNeutralPiece(target)` as one more line ahead of the
  `isWhitePiece` fallthrough in `isEnemy` (return `true` unconditionally --
  capturable by both) and `isFriendly` (return `false` unconditionally --
  never blocks like a friendly piece, unlike terrain) is the same pattern,
  not a new one. `pieceValues`/`evaluateBoard` need the analogous
  special-case wherever they key off `isWhitePiece`.
- **Capture side-effect hook.** There is currently no capture-side-effect
  hook at all -- pool bookkeeping and the upgrade would need a new branch in
  *two* places, because White's capture is inlined in `makeMove` (`:2101`)
  and Black's goes through the separate pure `applyMove` (`:878`). Whoever
  builds this should not unify those two paths as part of this feature;
  that unification is core-extraction work (#89's concern, see below), and
  bolting a narrative-only feature onto that refactor would conflate them.
- **Visibility.** The upgrade should be visible on the piece itself (its
  glyph changes to Archbishop/Chancellor/Amazon/Knightrider immediately),
  not a hidden stat -- consistent with how every other state change in this
  engine (promotion, terrain) is drawn directly on the board.

## 3. Where does the seam fall against #89?

**Nothing in this feature is core.** #89's core is move generation, legality,
search, and the board model -- byte-identical between classic and narrative
today, confirmed by the research finding on #100 (`PIECE_MOVE_SPEC` dispatch,
`legalMovesForPiece`, `attackersOf`, `applyMove` shape). Every new thing this
feature needs is a narrative-only addition:

- The neutral-piece representation gap (`isNeutralPiece`, and the
  `isEnemy`/`isFriendly`/`pieceValues` special-cases it needs) -- touches
  functions #89 wants to keep byte-identical, so it must land as an
  *addition* narrative's shell activates and classic's shell never calls,
  not a rewrite of the shared functions themselves.
- The evasion AI -- new code, no existing heuristic to extend (see below).
- The capture-upgrade branches in `makeMove`'s inline White path and
  `applyMove`'s Black path.
- The one exception: **the Knightrider's move generator itself is core-shaped.**
  See §4 -- it is a `PIECE_MOVE_SPEC` entry like any other fairy piece, and
  `PIECE_MOVE_SPEC` is already identical in both engines. If classic ever
  wants fairy-piece parity for some other reason, this entry costs nothing
  extra to carry; it just has no neutral piece to spawn it in classic today.

**For #89 specifically:** build the core extraction first. If this feature's
capture-upgrade hooks land before #89 unifies White's inline capture path and
Black's `applyMove` path, the hooks get written twice and one of the two
copies has to be re-derived when #89 does unify them. Landing #89 first means
the hook is written once, on whatever the unified capture path becomes.

## 4. The Knightrider generator

**It is not a new shape of rule.** DESIGN-NOTES calls it "a different shape
of rule entirely" (repeated knight-steps vs. the existing slide/step/jump
set) -- reading `slide()` (`:637`) shows this is not quite right:

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

`slide()` is direction-agnostic about what `(dx, dy)` means -- it just keeps
adding the same vector until blocked. Rook/bishop/queen pass unit vectors
(`ROOK_DIRS`, `BISHOP_DIRS`); nothing stops it from taking a `KNIGHT_JUMPS`
vector like `[2, 1]` instead, which produces exactly "repeat a knight leap in
a straight line" -- the L-shaped repeating path DESIGN-NOTES describes. A
`PIECE_MOVE_SPEC` entry `y: { slides: KNIGHT_JUMPS }` (one new letter; `n`,
`a`, `c`, `m` are taken) reuses the dispatch at `:660` with zero new
generator code. Blocker handling is free too, for the same reason terrain is
free for every other piece (§below): `slide()` already routes through
`isFriendly`/`isEnemy`, which already special-case `TERRAIN_WALL`/`HOLE`
(`:621`, `:630`). This should be built and play-tested before the spec's
recommendation here is trusted over DESIGN-NOTES' framing -- the code reading
says it should work, but "should work" and "confirmed by a test" are
different claims, and only the second belongs in a build ticket.

## 5. Difficulty

**Not this spec's call, and not guessable here.** A free permanent upgrade on
a fodder floor is exactly the shape of change `research/balance/README.md`'s
delegated-tuning convention exists for: a spawn-rate dial (how often the
piece appears, gated by floor depth the way `armyCost()`/`spawnBlackArmy()`
already gate army composition) needs a measured entry in `research/balance/`
*after* the feature exists and can be swept, not a guessed constant baked in
here. The evasion AI is the one piece of this that isn't a dial: nothing in
`getBlackMoveRuthless` (`:906`) maximizes distance from a threat -- it is
entirely attack-maximizing -- so "how good is the evasion" is an
implementation-quality question the checkpoint issue below should surface,
not a number.

## Done-when, carried from #98

- [x] a spec in `research/` answering all five questions above
- [x] the core/narrative seam named, and #89 references it (comment posted)
- [x] a `question`-labelled checkpoint issue filed for Zach, before any game code
