# Chezz — design notes / vision

The durable "big picture" doc for this project, mirroring how the
`scheduler` project keeps its own `DESIGN-NOTES.md` at repo root, outside
`.claude/`. `.scheduler/FOCUS.md` is the short, frequently-rewritten "what's
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

1. **Auto-march — REFINED 2026-07-20, later same session; this supersedes
   the "King auto-marches on its own after level clear" framing below.**
   The King does **not** start marching automatically on level clear.
   Instead, the interaction model is drag-driven and generalizes to every
   piece, not just the King:
   - **Click-and-drag stepping**: dragging a piece auto-steps it one
     square at a time in the dragged direction, rather than requiring a
     precise drop on the destination square. For the King this is the
     whole mechanic — no separate "auto-march mode" exists, it's just how
     dragging the King already works.
   - **Formation-follow is an emergent consequence, not a separate
     system**: once the King can be stepped this way, surviving pieces
     naturally "rank up" alongside it. For now, formation logic is naive —
     strongest pieces closest to the King — with the explicit long-term
     goal of custom-tuned positioning so the end formation resembles a
     classic chess back-rank arrangement. Don't over-invest in the tuning
     the first time; ship the naive version, leave it improvable.
   - **Generalizes to other pieces (e.g. Knight)**: the same drag-to-step
     interaction should work for any piece — on drag, find the legal move
     closest to the hover/drop spot and step there. Sliding pieces
     (Rook/Bishop/Queen) and the King have a natural "closest point along
     a line" answer; the **Knight's L-shaped, discontinuous move set makes
     "closest legal move to an arbitrary hover point" a real pathing
     problem, not a trivial one** — flagged explicitly as needing special
     treatment, worth solving as a distinct, smaller follow-up rather than
     blocking the King/sliding-piece version on it.
   - Player can still fully override (this was already true in the
     original framing and still holds): the drag itself IS the control,
     there's no separate autonomous system fighting the player for input.
2. **Terrain: build walls + holes together, not staged.** Full system in
   one pass — holes as impassable squares, boss-gated walls that drop
   when that floor's mini-boss is captured. Sequence after auto-march
   (shares the post-combat/floor-progression surface, wants that flow
   stable first) — not explicitly bundled into the same implementation
   pass, just ordered second.
   - **Refined 2026-07-20: wall/hole COUNT as an intentional carry-over
     gate**, tunable per floor's difficulty design, enabling deliberate
     "dramatic showdown" set-pieces. Worked example from the user: a floor
     with King + pawns vs. a lone Knight, where the gate is narrow enough
     that only the King can pass through it — the pawns literally cannot
     follow, so capturing the Knight before advancing becomes mandatory,
     not optional. This means terrain isn't purely an obstacle/flavor
     layer — floor design should treat gate width as a lever alongside
     material composition when tuning a floor's difficulty curve.
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

## Deep feature ideas (recorded 2026-07-20, NOT scoped for implementation)

User-originated ideas, deliberately captured here rather than left to
verbal memory, but explicitly not queued for nightly-batch yet — each
needs its own scoping pass before it's implementation-ready. Treat this
section as a seed list a future vision session picks from, not a to-do
list nightly-batch should start executing against.

- **Neutral evasive flavor piece + knight-upgrade-by-capture chain.** A
  neutral (half-white/half-black) horse-shaped piece that always tries to
  evade capture, appearing as flavor content on the pawn-fodder/terrain
  levels. Capturing it grants the capturing piece a permanent "+knight"
  upgrade — merges knight movement onto whatever piece took it:
  Bishop→Archbishop, Rook→Chancellor, Queen→Amazon. A piece that's already
  knight-combined (i.e. would become knight+knight) becomes a
  **Knightrider** instead — a fairy piece that repeats knight-move steps
  in a straight line — with a proposed graphic treatment of an
  upside-down knight glyph to visually distinguish it. Needs: capture
  logic for a non-aligned/neutral third side, an evasion AI for the
  neutral piece, upgrade-application logic per piece type, and a
  Knightrider move-generator (doesn't exist in the current fairy-piece
  set — Archbishop/Chancellor/Amazon are simple move-set unions, a
  knightrider's repeated-knight-step movement is a different shape of
  rule entirely).
- **Graphics pipeline — two independent tracks, not mutually exclusive:**
  1. **Autonomous AI-generated sprites**, extracting and adapting the
     pixel-art Gemini API workflow already built in the `vkv-inventory`
     project, made autonomous for chezz. **This is a NEW external service
     dependency** (an image-generation API call) — FOCUS.md's own gate
     already reserves this for explicit user sign-off, no autopilot
     exception (this is the same gate the tracker's existing
     `2026-07-17T07:25:16.315Z` sprite-replacement report is deferred
     behind). Cross-project too: would need coordinating with whatever
     `vkv-inventory`'s workflow actually looks like today, not something
     to build blind from a one-line description.
  2. **A custom font file with real typography for the fairy pieces**
     (Archbishop/Chancellor/Amazon/Knightrider etc., which today lean on
     Unicode knight-combo glyphs). No new external service dependency in
     the same sense — an asset-creation project, not an API integration.
     Explicitly associated with "Chezz Classic" below, not the current
     arcade-cabinet-reskinned build.

## "Chezz Classic" — question 1 resolved 2026-07-20, questions 2/3 still open

Raised 2026-07-20: the user wants an older version of chezz — live at
`hf7y.com/chezz.html`, which redirects to an OCF Berkeley-hosted copy
(note: **not** `hf7y.github.io/chezz/`, the current live site this repo's
automation deploys) — developed as **"its own production stream."** The
user confirmed directly: the code lived on `main`, and narrative-campaign
work eventually overwrote it there (file content, not git history — the
commits themselves were never destroyed).

**Resolved by git archaeology, not guesswork**: `readable-html` (an
already-existing branch, still pushed to `origin`) is the **exact
merge-base** between itself and current `main` — `git merge-base
readable-html main` returns `readable-html`'s own tip (`6815336`,
2026-07-16, "Merge simplify-and-polish: dedup pass, mobile touch-drag
fix, promotion dialog fix"), and `git log --oneline readable-html..main`
starts with `c13e228 Add a scripted narrative campaign` as the very first
commit past it. That's a clean, unambiguous boundary — no divergent
history to reconcile, no guessing between candidate branches. **Action
taken**: created and pushed a clearly-named `chezz-classic` branch
pointing at that same commit (`git branch chezz-classic readable-html`),
so it's a discoverable, purpose-named reference going forward instead of
an ambiguous old branch name — `readable-html` itself was left alone
(unchanged), `chezz-classic` is a second ref to the same commit.
**Not independently verified against the live `hf7y.com/chezz.html`
page** — this sandbox's network egress to `hf7y.com` times out (DNS
resolves fine, TCP connect hangs; looks like a sandbox network
restriction, not the site being down) — worth a real diff against the
live page next time someone has working access, but the git-side evidence
alone is solid enough to act on.

**Still open, still needs the user (not a guess):**
2. Is `hf7y.com`/the OCF-Berkeley host deployable-to from this machine or
   any unattended run, or is publishing there always a manual step
   regardless of what automation does?
3. What does "its own production stream" mean concretely — a new
   registered project in the `scheduler` ecosystem (its own repo/branch,
   `FOCUS.md`, nightly cadence, sharing the same constrained account
   budget every other registered project already competes for — see
   [[project-chezz-automation]]'s spend-limit note), or something lighter
   (e.g. occasional manual/interactive sessions against the new
   `chezz-classic` branch, no unattended cron)?

Not acted on further until 2/3 are answered — the branch now exists and
is safe either way, but registering it into the scheduler ecosystem is a
real recurring-budget commitment that shouldn't be guessed into.

## Priority order this unlocks (see `.scheduler/FOCUS.md` for the live queue)

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
3. Auto-march: drag-to-step interaction (King first, then generalize to
   sliding pieces; Knight's pathing is a flagged follow-up, not a blocker
   for the rest), formation-follow as the natural consequence.
4. Terrain (walls + holes together, including the carry-over-gate
   difficulty lever).
5. Material-sufficiency tuning-proxy strengthening (parallel/backup —
   doesn't block 3/4).
6. King→Queen design spec (write-up + `QUESTIONS.md` checkpoint, not
   implementation) — lowest urgency of the four since it's genuinely
   exploratory and the least reversible if rushed.

Ordinary tracker triage keeps running underneath all of this for reports
that don't belong to any cluster above — don't let the vision roadmap
starve routine mechanical fixes.
