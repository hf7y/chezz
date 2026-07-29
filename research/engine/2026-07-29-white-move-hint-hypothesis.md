# Does Black's search already know White's best reply?

**Date:** 2026-07-29 · **Type:** research, no code shipped · **Priority-queue item 13**

## The question, and why it was asked before any code

Zach parked the "show White a best-move hint" feature behind a specific
empirical claim, and made building it conditional on that claim being true:

> "Not sure what the real cost is though since processing would be background,
> interrupted, and it doesn't steal from black engine work, unless I'm
> misunderstanding the design. In fact, it should be largely free since black's
> previous move already considered white's best move. Shouldn't need to call
> the engine at all. [...] Only do this work if the black engine piggyback
> hypothesis is real, otherwise park as an idea in the feature vision tree."

So the task was never "build the hint." It was: **read the search and answer
whether the information is already there, retrievably, at no extra cost.**

## Verdict

**The hypothesis is half right, and the half that is wrong is the half that
decides the cost.**

- ✅ **The information is computed.** Black's search genuinely evaluates White
  replies, under the same evaluation function, meaning the same thing.
- ❌ **It is not retained, and most of it is not an answer.** The search
  returns a *number*, never a move. And because of alpha-beta pruning, most of
  the White replies it examines are proven *bounds*, not best moves.

So the hint does not need a second engine call — Zach is right about that —
but it does need the search to be changed to *remember* something it currently
throws away, and that memory has correctness conditions. It is cheap relative
to a new search, and it is not free.

## The evidence

### 1. The search returns a scalar, not a line

`search(b, depth, alpha, beta, whiteToMove, pool)` returns a single evaluation.
There is no principal-variation array, no transposition table, and no
best-move-at-this-node record anywhere in the engine. The only place a *move*
is ever retained is `searchRoot`, which tracks the best move among **Black's
own root moves** — the one thing that is not wanted here.

White's best reply is therefore computed many thousands of times per turn and
discarded every single time. Nothing needs recomputing; something needs
recording.

### 2. Alpha-beta means most White replies are refutations, not best moves

In `search`, the White branch minimizes and breaks on `beta <= alpha`. At such
a node the loop exits the moment a move is found that is *good enough to refute
the line* — the remaining moves are never examined, and the returned value is
an upper bound rather than the true score.

This is the substantive correction to the hypothesis. Naively recording "the
move that was best when the loop exited" would, at most nodes, record *a move
sufficient to refute Black*, which is frequently not White's strongest option
and occasionally quite a weak one that merely happened to clear the bar.

Only **PV nodes** — those searched with a full, exact window — yield a
trustworthy best move. Harvesting a hint means restricting collection to those
nodes, which is the standard triangular-PV-table technique. Well understood,
but it is real work in the hot path, not a free read.

### 3. The engine's White moves are pseudo-legal — a hint could point at a
move the player is forbidden to make

`collectMoves` builds its move list from `legalMovesForPiece`, **not**
`legalMovesFrom`. The difference is the King-safety filter added by the
2026-07-20 human call: White may not make a move that leaves its own King
capturable. `legalMovesFrom` applies it; `legalMovesForPiece` does not.

Measured over 60 procedurally spawned boards (White King + Rook + Bishop, so
pins and exposures are possible):

| | |
|---|---|
| Pseudo-legal White moves enumerated | 1312 |
| Of those, King-hanging and therefore **illegal for the player** | **208 (15.9%)** |
| Boards containing at least one such move | 30 of 60 |

The engine tolerates this because it only needs the *value* of White's best
resource, and a King-hanging line is scored catastrophically anyway. But a
**hint is a UI promise**: a dot on a square the player clicks and finds
rejected is worse than no hint. Any harvested move must pass `legalMovesFrom`
before display.

To be precise about what this number does and does not say: it is the rate of
illegal moves in the enumerated *set*, not a prediction that ~16% of hints
would be illegal. The best move is usually not a King-hanging one. It
establishes that the filter is necessary, not how often it would fire.

### 4. The search internals are not reachable from outside

`collectMoves`, `search`, and `searchRoot` are all closure-scoped — verified by
probing `window` for each and getting `undefined`, while `legalMovesForPiece`
and `legalMovesFrom` are global. So even a perfectly-retained PV would need
plumbing out to the UI layer. Minor, but it belongs in the cost.

### 5. A timing detail in the hypothesis's favor

Worth stating because it is the strongest part of the idea: Black searches from
the position *before* it moves, and the hint is wanted *after*. Those line up.
The node the hint needs is exactly the child of the Black move actually played,
searched with White to move. At the first iteration of iterative deepening that
child is searched at full window, so a true PV is available for precisely the
position the player is about to face.

The structure Zach intuited is genuinely there.

## What it would actually cost

Not a second engine call. Instead:

1. A triangular PV table (or a best-move field) updated **only on
   alpha-improvements at exact-window nodes**, so bounds are never mistaken for
   answers.
2. Extraction of ply 2 of the PV for the Black move actually chosen.
3. A `legalMovesFrom` filter before anything is drawn.
4. Plumbing out of the engine closure, plus the toggle and dot/star rendering
   Zach specified ("whatever is simplest").
5. A staleness rule: when the search hits `NODE_BUDGET` (`hitDeadline`), the
   retained line is partial. A stale hint must be suppressed, not shown — the
   engine already discards deadline-hit depths for exactly this reason.

## Recommendation

**Report the finding; do not build yet.** Zach's instruction was to build only
on a clean yes, and this is a qualified yes with three correctness conditions
attached (PV-node restriction, legality filter, deadline suppression). Each is
a way the feature ships subtly wrong — pointing at refutations instead of best
moves, at illegal squares, or at stale lines — and "subtly wrong hint" is worse
than no hint for a puzzle game whose appeal is that the player solves it.

The honest summary for the decision: *the information is there and no new
search is needed, but harvesting it correctly is a real change to the engine's
hot path, not a free read.* That is a different trade than the one the park was
based on, so it deserves a human call rather than an unattended run's judgment.

## Reproducing

The move-legality measurement uses only globals and can be re-run in the page
console against any spawned board:

```js
// per White piece, per board:
legalMovesForPiece(state.board, p, x, y).length   // what the engine enumerates
legalMovesFrom(state.board, x, y).length          // what the player may play
```

The scalar-return, cut-node, and closure-scope findings are code reading of
`search`, `searchRoot`, `quiesce`, and `collectMoves` in `index1.html`, plus a
`window` probe for each symbol.
