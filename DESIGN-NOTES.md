# Chezz — design notes / vision

The durable "big picture" doc for this project, mirroring how the
`scheduler` project keeps its own `DESIGN-NOTES.md` at repo root, outside
`.claude/`. `.claude/FOCUS.md` is the short, frequently-rewritten "what's
in scope right now" pointer nightly-batch reads first; this file is the
longer-lived record of *why*, for a human or an autonomous run trying to
reconstruct the whole shape of the project without re-deriving it from
scratch. Update it when a real direction gets decided, not every night —
it should read as a slower-moving log of decisions, not a duplicate of
FOCUS.md's day-to-day scope.

## What this game is

A daily-seeded roguelike built on chess rules: White starts as a lone
King, climbs floors fighting procedurally (or, in the narrative campaign's
opening floors, scripted) spawned Black material, and carries surviving
pieces forward floor to floor. `leaderboard/Code.gs` (Google Apps Script)
backs a daily/all-time leaderboard and a live player-feedback tracker (bug
+ feature reports, fed by an in-game chat box). Live at
https://hf7y.github.io/chezz/. Full deployment/CI shape in
[[project-chezz-automation]] (memory) — not repeated here.

## Where the backlog actually is (snapshot 2026-07-20, re-fetch before trusting counts)

Live tracker: 67 open reports (17 bug, 50 feature) as of this snapshot.
Grouped by what's actually driving the volume, oldest report per cluster
first:

- **Post-combat auto-march** (~10 reports, 2026-07-17 through 2026-07-20)
  — the single biggest cluster. Reporters consistently describe the same
  missing system: after a fight clears, the King (and surviving pieces)
  should advance toward the exit row (rank 9) mostly automatically,
  instead of dragging every piece every step. Several reports assume this
  mode already exists and describe bugs *in* it ("pawns should have
  followed," "piece like knight should stay selected") — it does not
  exist yet in the shipped code; those are really feature requests for
  the system, not bugs in one.
- **Terrain: walls + holes gating "fodder" levels** (~7-8 reports,
  2026-07-17 through 2026-07-20) — the pawn-heavy filler floors between
  named-piece encounters read as a formality; reporters want obstacles
  (holes as impassable squares) and boss-gated walls (a wall blocks
  progress until a mini-boss on that floor is captured) to make them
  matter. Related to but distinct from auto-march — both touch
  floor-progression flow, worth sequencing auto-march first since terrain
  will want a stable post-combat flow to gate against.
- **Piece rebalancing** — three separate threads, don't conflate:
  - Archbishop pricing: open since 2026-07-14 (bumped once already,
    2c36fa3), still reported as underpriced. No new data since the last
    bump — a numeric guess correcting a numeric guess.
  - Bishop-pair color (same-color vs. opposite-color): recurring
    complaint that a same-color bishop pair reads as weaker than it
    should, opposite-color possibly stronger than a Rook. No hard data
    either direction.
  - **"What if the player piece were a Queen instead of a King?"** — open
    since at least 2026-07-14, resurfaces regularly. This is not a value
    tweak, it's a different game (removes the King's fragility as the
    core tension). **Decided 2026-07-20: worth exploring as its own
    project**, not bundled with the numeric tweaks above — see "King→Queen
    exploration" below.
- **Rook/Queen material sufficiency** — not tracker-driven, this is the
  narrative campaign's own open research question (see
  [[project-chezz-narrative-campaign]] for full history). Nothing tested
  so far reliably beats a solo enemy Queen, not even a fair Queen mirror —
  and the tuning proxy's negative results aren't trustworthy yet (shallow
  search, material-only eval, King captured outright in re-tests). Current
  `NARRATIVE_STAGES` order (Knight → build-up → Two Bishops → build-up →
  Rook → Queen → back rank) is provisional past Two Bishops.
- **AI move-quality complaints** (hung pieces, "weird" trades) — same
  cluster the user already chose to close in bulk once
  (see [[project-chezz-open-items]]): not individually actionable without
  a reproducible seed, tracked under an eventual optimization pass, not
  fixed one report at a time.
- **50KB size budget** — `index1.html` is 84,654 bytes against a 50KB
  soft target (100KB hard cap). Open since 2026-07-14; the user's standing
  call back then was "stop and revisit," not cut deeper into comments —
  still unresolved, still growing.
- **Smaller, well-scoped items worth picking off opportunistically**
  (not big enough to need vision-level direction, just noted so they
  don't get lost among the bigger clusters): a black pawn reaching rank 1
  with no legal promotion/capture should proceed off-board instead of
  forcing a stalemate (two fresh, specific reports 2026-07-20); recurring
  "black pawn spawns hanging" reports (worth checking whether this is
  actually a bug or intentional — hanging enemy material is a *player*
  advantage, unlike White's own spawn-safety guarantee).

## Two things that read as urgent, not vision-scope (flagged, not asked about)

- **White pieces are likely near-invisible on light squares right now.**
  Traced from fresh reports + the CSS: White pieces render as
  hollow/outline glyphs (♔♕♖♗♘♙), Black as solid (♚♛♜♝♞♟), but there is no
  CSS color distinction between them — both just inherit
  `color: var(--cream)` (`#f2f2f2`). A hollow glyph in near-white on an
  `hsl(0,0%,74%)` light-grey square has almost no visible stroke contrast.
  This looks like real fallout from the 2026-07-19 monochrome revert
  (which was screenshot-verified at the time — worth checking whether that
  verification actually exercised a White piece sitting on a light
  square, or missed this case). Needs a real screenshot pass to confirm
  and fix (e.g. a subtle outline/shadow on `.piece` so the hollow glyphs
  read against light backgrounds), not a guess from CSS alone.
- **Bug reporting is broken for a meaningful chunk of players.** Reports
  are filed via `prompt()`, which Chrome's popup blocker kills by default
  — several 2026-07-20 reports explicitly say they couldn't file a bug
  because of this (one had to describe the failure *as* a bug report,
  through whatever path still worked). Reporters themselves suggest the
  fix: fold bug reporting into the existing feature-request chat box
  (already a real, working, non-popup UI shipped 2026-07-16/17), tagging
  `kind` instead of relying on a separate `prompt()` flow. Also flagged
  alongside this: reports would be more actionable with real move
  context (last few moves via URL) instead of a single FEN snapshot —
  worth doing in the same pass since it touches the same reporting path.

## Decided direction (2026-07-20, human-directed)

Four vision questions, asked directly, answered directly — recording the
decision and reasoning so a later autonomous run doesn't have to re-derive
or re-ask:

1. **Auto-march: King auto-marches, pieces follow in formation.** Not full
   free-drag auto-march for every piece (too little player control) and
   not manual-assist-only (doesn't address what reporters actually asked
   for). The King advances toward the exit row on its own; surviving
   pieces line up beside/behind automatically, matching the reports that
   describe pieces "getting behind king." Player can still intervene
   (drag overrides), per the reports asking for a "back button is undo"
   safety valve.
2. **Terrain: build walls + holes together, not staged.** Full system in
   one pass — holes as impassable squares, boss-gated walls that drop
   when that floor's mini-boss is captured. Sequence after auto-march
   (shares the post-combat/floor-progression surface, wants that flow
   stable first) — not explicitly bundled into the same implementation
   pass, just ordered second.
3. **Material sufficiency: strengthen the tuning proxy.** Pure
   engineering (deeper search, real king-safety/tactical eval instead of
   material-only), no playtesting asked of the user. This can run as
   backup/parallel work — doesn't block or get blocked by auto-march/
   terrain.
4. **King→Queen: worth exploring as its own project**, explicitly not
   bundled with the archbishop/bishop-pair numeric tweaks (those stay
   deferred, untouched — no new data justifies another guess at either).
   Given this changes the core tension of the game (the King's fragility
   *is* the game today), this needs a **design spec written and reviewed
   before any implementation starts** — same irreversibility instinct
   FOCUS.md's own redesign-defer criterion already applies to
   core-rule-touching work, now explicitly greenlit for exploration rather
   than indefinite deferral. Nightly-batch's job here is to draft the
   spec into this file (what changes, what stays, how it interacts with
   the King's exit-row win condition, spawn/threat balance, etc.) and
   surface it via `QUESTIONS.md` for a checkpoint — not to start writing
   game code against a redesign this size without one.

## Priority order this unlocks (see `.claude/FOCUS.md` for the live queue)

Nightly-batch's ordinary job (oldest-first through the tracker, four-
outcome triage) continues for everything not covered by this list — this
is an override ordering for the big-ticket items above, sequenced so nothing
in it competes with what `scheduler`'s own project is actively building
(the scheduler-side work is infrastructure — crontab, permission gates,
usage pacing — none of it touches chezz's actual game code or design, so
there's no real overlap to sequence around beyond not double-booking the
same account-wide usage budget both projects share).

1. Urgent, small: white-piece-visibility fix (screenshot-verified), fold
   bug-reporting into the feature chat box.
2. Already-queued near-term (decided earlier the same day, smaller in
   scope than the vision items below): move-into-check King-only
   legality, the `.scheduler/` layout migration.
3. Auto-march (King auto-marches, pieces follow in formation).
4. Terrain (walls + holes together).
5. Material-sufficiency tuning-proxy strengthening (parallel/backup —
   doesn't block 3/4).
6. King→Queen design spec (write-up + `QUESTIONS.md` checkpoint, not
   implementation) — lowest urgency of the four since it's genuinely
   exploratory and the least reversible if rushed.

Ordinary tracker triage keeps running underneath all of this for reports
that don't belong to any cluster above — don't let the vision roadmap
starve routine mechanical fixes.
