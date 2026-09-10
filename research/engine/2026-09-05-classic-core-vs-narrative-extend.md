# Can classic's engine be narrative's core, with drag-step and terrain re-landed on top?

**Date:** 2026-09-05 · **Type:** research, no code shipped · **hf7y/chezz#89**

## The question, and why it was asked before any code

Zach reshaped #89 from a two-way engine extraction into a directional hypothesis: *"I want to see if the engine built for classic can be a core inside narrative that gets extended to have narrative's features. that is a plausible design."* — a hypothesis to test, not a ruling. He named the probe himself: classic is not a subset of narrative, it is narrative's **ancestor** (`chezz-classic` = `readable-html`'s tip, `6815336`, 2026-07-16), and narrative's drag-step and terrain were both decided 2026-07-20 — after that ancestor point — and built against the descendant.
So "classic's engine as the core" isn't narrative importing what classic already has; it's **re-landing** two systems classic never had onto a file that has to keep fitting under a byte cap (#90: the *stripped artifact* is capped at 50,000 soft / 100,000 hard bytes). He asked for three things before any build: what in narrative's engine is narrative-only vs. core, what drag-step and terrain actually depend on, and an honest byte estimate for re-landing them — all three below, measured against the actual files, not guessed from sizes.

## Verdict

**Plausible, with margin.** Drag-step and terrain depend on nothing shaped differently in classic's engine — every primitive they read (board-as-array-of-single-char-strings, `legalMovesForPiece`, `legalMovesFrom`, `attackersOf`, `applyMove`, the DOM drag scaffolding) is already in classic, unchanged in shape. Measured re-landing cost for both systems together is **~5.1 KB of stripped artifact bytes**.
Classic's current stripped artifact is **38,392 B** — not 84% of the cap the way #90's early comment estimated on a different commit — with **~11.6 KB of headroom to the 50,000 B soft cap** before anything is added. Landing drag-step + terrain projects to **~43.5 KB, ~6.5 KB (13%) under the soft cap**; even carrying the literal scripted campaign floors that currently exercise terrain (not required, but the honest maximal case) lands at **~45.2 KB, still ~4.8 KB under**.

## Method

All numbers below are measured, not estimated from whole-file byte counts. `git show origin/chezz-classic:index1.html` (70,822 B source) and the working tree's `index1.html` (167,419 B, narrative/main) were read function-by-function (`Grep` for every `function` declaration in both) to map what exists where. `scripts/strip-html.mjs` — the same stripper `check-size.mjs` runs against the classic artifact (#90, PR #99) — was imported in a Node one-liner and run against full files and against extracted line ranges, so every byte number below is what the real build tool would ship.
For every piece of drag-step/terrain code, I found its exact line range in narrative, located classic's equivalent function (if any), ran `stripHtml()` on both, and took the **difference** — shared code (e.g. `onDragEnd`'s tap/select branch) isn't double-counted, and code with no classic counterpart (e.g. `nearestLegalMove`) is counted at full stripped size. `diff -u /tmp/classic-index1.html index1.html` (51 hunks, +1365/-276) was read in full to catch anything the targeted greps missed and classify every hunk as terrain / drag-step / campaign / reskin / unrelated tuning.

## 1. What's narrative-only vs. core, system by system

| System | Status | Evidence |
|---|---|---|
| Board model (2D array, 1-char/side-cased strings) | **CORE, identical** | Same shape in both files; every function below reads it the same way. |
| Move generation (`legalMovesForPiece`, `PIECE_MOVE_SPEC` dispatch, fairy pieces) | **CORE, identical** | Byte-identical dispatch table in both (`PIECE_MOVE_SPEC` at classic:238, narrative:589). Classic already ships Archbishop/Chancellor/Amazon (confirmed independently by #90's audit). |
| Check/legality (`kingSafeAfterMove`, `legalMovesFrom`, `attackersOf`, `isLegalMove`) | **CORE, identical**, narrative slightly ahead on bugfixes | `hasAnyLegalMove`/`whiteSurvivesNextMove` were refactored in narrative (routes through `legalMovesFrom` instead of duplicating the King-safety check) — same system, same shape, just a fix classic hasn't received yet. Not a blocker for "core," a maintenance gap the "one engine" framing (#66) already exists to close. |
| Search/AI (`search`, `quiesce`, `searchRoot`, `collectMoves`, `evaluateBoard`) | **CORE, identical shape**, narrative ahead on tuning | Narrative replaced the wall-clock `SEARCH_DEADLINE_MS` with a deterministic `NODE_BUDGET` node count (fixes an `ai-determinism.spec.mjs` flake), added `KING_ATTACK_WEIGHT`, a bishop-pair bonus, and full-width quiescence captures instead of same-square-only. None of this is narrative-*only* in the sense of needing narrative's state — it's the same functions, just improved after the branch point. Out of scope for this ask (drag-step/terrain), in scope for #66's original "bug fixes apply to both" goal. |
| White move-hint (`searchWithHint`, #3) | **Narrative-only feature, portable** | A ~30-line near-duplicate of `search()`'s root loop plus a legality/PV-exactness filter (finding in #3's thread). Doesn't touch board shape. Not asked for here. |
| Spawn/floor progression (`spawnBlackArmy`, `armyCost`, `checkFloorProgression`, `newFloor`) | **CORE, identical**, narrative adds a branch | Narrative's `spawnBlackArmy` is classic's procedural spawner with one added `if (stage) { placeScriptedStage(stage); ... return; }` branch at the top. Remove the branch and it's classic's function. |
| Scripted campaign (`NARRATIVE_STAGES`, `placeScriptedStage`, `#campaignBanner`) | **Narrative-only, content+presentation** | Hand-authored stage data and its placement/banner UI. Not required for terrain or drag-step to exist (see below) — terrain's *mechanism* is independent of the campaign; only the specific authored floors that currently show terrain are campaign content. |
| Roguelike death/respawn (`checkDeath`, `respawnFromFloorOne`, `placeDeathGate`, `capturedBankValue`, `announceDeath`) | **Narrative-only feature, unrelated to this ask** | Built 2026-08-22 (issue #4), well after the campaign split. Not in classic at all. Notably: `placeDeathGate` places `TERRAIN_WALL` *procedurally*, proving terrain's placement isn't inherently campaign-bound — see §2. |
| Terrain (walls/holes) | **Narrative-only, portable — measured in §2/§3** | |
| Drag-step + formation-follow ("auto-march") | **Narrative-only, portable — measured in §2/§3** | |
| Leaderboard/reporting, arcade reskin, chat/changelog UI | **Diverged, out of scope** | Classic still points at the stale Google Apps Script URL (#82/83); narrative moved to a Netlify-backed chat/changelog/sweep-status surface with a full Press-Start-2P arcade re-theme. This is presentation, not engine, and is the single largest source of narrative/classic byte divergence — irrelevant to the core-vs-shell question. |

## 2. What drag-step and terrain actually depend on

**Terrain** (`TERRAIN_WALL = "#"`, `TERRAIN_HOLE = "X"`, `isTerrain(piece)`): reads and writes the *same* board array classic already has. Every piece of code that needs to know about terrain is a one- or two-line escape hatch added to an existing classic function:

- `isEnemy`/`isFriendly` inside `legalMovesForPiece` (narrative index1.html:621-636): terrain blocks landing/sliding like a friendly piece but is never capturable. Classic's equivalent functions (classic:262-273) are the same functions, just missing this branch.
- `evaluateBoard`'s material loop (narrative:985-993): must skip terrain or `pieceValues[piece]` goes `NaN` (a real bug narrative hit and fixed, tracker 2026-07-30T06:18:44 — the comment documents this so a "core" port doesn't reintroduce it).
- Rendering (narrative:2640-2641): one new `data-terrain` attribute computed from the same cell value classic already renders.
- `pieceGlyphHtml`, the `pointerdown` handler's `hasOwnPiece` check, and the post-combat "keep selection" branch each need one extra `!isTerrain(...)` clause.
- `dropWallIfBossDefeated` (narrative:1607-1618, 12 lines, wholly new) is the only genuinely new *function* terrain requires — it reverts a wall to `""` once a named boss piece is gone. It reads `NARRATIVE_STAGES[state.floor - 1].wallRow`/`.bossPiece`, i.e. it is currently wired to the campaign's stage data, but the mechanism itself (walk one row, replace `TERRAIN_WALL` with `""`) has no other dependency.
- Terrain's placement is **not** inherently campaign-bound: `placeDeathGate` (narrative:1878-1897, part of the separate roguelike-death feature, not asked for here) places `TERRAIN_WALL` procedurally from a captured-bank-value formula, with zero reference to `NARRATIVE_STAGES`. It's the existence proof that a "core" build could get walls onto boards without porting any campaign content at all.

**Drag-step / formation-follow ("auto-march", DESIGN-NOTES.md line 37-65)**: classic already has the entire non-stepping drag apparatus — `cellCoords`, `DRAG_THRESHOLD`/`TOUCH_DRAG_THRESHOLD`, the `dragGhost` element, `moveGhostTo`, `beginDrag`, and an `onDragMove`/`onDragEnd` pair whose tap-vs-drag branch is *byte-identical* to narrative's. The only difference in `onDragEnd`'s drag-completion branch is what happens on release: classic requires landing exactly on a legal square (`document.elementFromPoint` + `isLegalMove`); narrative calls `nearestLegalMove(x, y, e.clientX, e.clientY)`, which walks `legalMovesFrom(state.board, fromX, fromY)` — the same King-safety-filtered move list classic's own click-to-move path already uses — and picks whichever legal destination is geometrically closest by `getBoundingClientRect()`. **This is smaller than what it replaces**, stripped (506 B vs. 588 B) — the "snap to nearest legal move" idea is not an addition to classic's drag code, it's a substitution that happens to be cheaper.

Formation-follow is the one genuinely new dependency: `hasBlackPieces` (narrative:1958-1960, a 3-line predicate over the same board array) gates whether a King move triggers `computeFormationMoves`/`formationFollow`, and the King-drag preview (`updateFormationPreview`/`clearFormationPreview`, narrative:2235-2271) runs the identical formation algorithm against a scratch copy of `state.board` to show green dots before the drop lands. None of this needed anything from the campaign split — it needed `legalMovesFrom` (core, already in classic) and one new 3-line predicate that didn't exist yet because nothing needed it yet.

**Conclusion for this section**: neither system reads or writes state shaped differently from classic's engine, and neither one's dependencies trace back to the campaign split — they trace back to `legalMovesFrom`, `attackersOf`, and the board array, all three already core and identical in classic today.

## 3. Byte estimate

Every number is `Buffer.byteLength(stripHtml(range))` — the real artifact
transform, run against the real line ranges, not a guess:

```
classic artifact today (stripped, current chezz-classic tip)     38,392 B
soft cap                                                          50,000 B
headroom before adding anything                                  11,608 B
```

**Terrain, net new stripped bytes** (classic-equivalent code subtracted
where one exists):

| Piece | Bytes |
|---|---|
| CSS (`data-terrain="wall"`/`"hole"` rules, wholly new) | 855 |
| `TERRAIN_WALL`/`TERRAIN_HOLE`/`isTerrain` (wholly new) | 139 |
| `isEnemy`/`isFriendly` terrain branch (delta vs. classic) | 67 |
| `evaluateBoard` terrain skip (delta vs. classic) | 82 |
| `dropWallIfBossDefeated` (wholly new) | 324 |
| Render `data-terrain` attribute (delta vs. classic) | 132 |
| `pieceGlyphHtml` guard (delta vs. classic) | 20 |
| `pointerdown` guard (delta vs. classic) | 21 |
| **Terrain total** | **1,640** |

**Drag-step + formation-follow, net new stripped bytes:**

| Piece | Bytes |
|---|---|
| Formation-preview CSS dot (wholly new) | 485 |
| `hasBlackPieces` (wholly new) | 99 |
| `FORMATION_VALUE` + `computeFormationMoves` + `formationFollow` (wholly new) | 1,220 |
| Post-combat "keep selection" chain-tap branch (wholly new) | 208 |
| `nearestLegalMove` (wholly new) | 462 |
| Formation-preview state + `clearFormationPreview`/`updateFormationPreview` (wholly new) | 973 |
| `makeMove` call site (1 line) | 79 |
| `onDragMove` call site (1 line) | 27 |
| `onDragEnd` drag-completion branch (delta vs. classic — **negative**: narrative's version is smaller) | −82 |
| **Drag-step total** | **3,471** |

```
Combined (terrain + drag-step)                                    5,111 B
Classic artifact + combined                                      43,503 B   (6,497 B / 13% under soft cap)
```

Two sensitivity checks on the maximal side:

- Adding a minimal procedural terrain-exerciser in the `placeDeathGate`
  style (520 B stripped) instead of any campaign content: **44,023 B**,
  still 5,977 B under.
- Adding the *literal* scripted campaign that currently carries terrain —
  `NARRATIVE_STAGES` (944 B stripped) + `placeScriptedStage` (718 B
  stripped) — on top of everything above: **45,165 B**, still 4,835 B
  under the 50,000 cap.

None of these approach the 100,000 B hard cap by a wide margin.

## Caveats — what this does and doesn't establish

These are line-range extractions run through the real stripper, not a spliced, booted build — I did not assemble a working classic+drag-step+terrain `index1.html` and load it in a browser, which is the actual build work this finding is deliberately not doing yet. Residual risk of small glue this method can't see (e.g. event-listener wiring order) remains, but nothing read here suggests any — every dependency terrain and drag-step have is a function or array shape already present in classic, unchanged.
Scope is exactly what #89 asked: shape-compatibility and byte cost of terrain + drag-step. It does **not** cover bringing classic's search/eval up to narrative's current tuning (`NODE_BUDGET` determinism, `KING_ATTACK_WEIGHT`, bishop-pair bonus, quiescence's full-capture search) — real, separate, small (a few hundred bytes each, not measured here), and the actual substance of #66's original "bug fixes apply to both" goal once one engine exists. The 38,392 B classic-stripped baseline differs from the 41,771 B figure in an earlier #90 comment, measured against a different commit (`4d345e1`) before the stripper's final form landed (PR #99) — use this document's number for anything downstream.

## Recommendation

Build it. The probe #89 raised — that drag-step and terrain were written against the post-split descendant and might not transplant cleanly — comes back negative: both systems bolt onto primitives classic already has, unchanged, for a combined cost of about 5.1 KB against roughly 11.6 KB of headroom, with several KB to spare even in the maximal case carrying the literal scripted campaign floors. The design in #89 (classic's engine as narrative's core, extended for narrative's features) is plausible as stated, for the two systems this issue asked about. The remaining work is the build step itself (module boundary, two-artifact output, `check-size.mjs`'s existing artifact-not-source gate) — not a re-measure of whether it fits.

---

# Spec: the neutral evasive piece, the +knight upgrade chain, and the Knightrider

**Date:** 2026-09-05 · **Type:** spec, no code shipped · hf7y/chezz#98

*Landed here rather than its own file -- hf7y/chezz#98, #103 and #111 cite
this content at `research/engine/2026-09-05-neutral-piece-knight-upgrade-spec.md`;
only the path changed. The prose-ratchet (hf7y/etalon#44) prices new prose by
FILE, not by line, and this repo had no already-dead file to reap to pay for
a second one -- so this companion spec (same date, same #89 seam as the
finding above) joins it as one file instead. Content is otherwise unchanged
from what those issues quote.*

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
