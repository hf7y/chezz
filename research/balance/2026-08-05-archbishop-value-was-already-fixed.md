# Archbishop material value: already fixed, three weeks before this lane existed

**Date:** 2026-08-05 · **Change type:** none (record + pin only) · **Commit:** see below

## What moved

Nothing, tonight. The number itself moved on **2026-07-13** (`2c36fa3`),
`pieceValues.a`/`A`: 700 -> 780. This entry exists because that fix was never
reconciled against the tracker report it answered, and because nothing pinned
the number until now.

What *did* move tonight: `pieceValues` was hoisted from a `const` nested
inside `getBlackMoveRuthless` (re-declared, identically, on every search call)
to a top-level `const` in `index1.html`, alongside the other search weights it
sits next to. Pure organizational change, zero behavior difference -- verified
by the full 138-test suite passing unchanged before and after. It was
necessary, not incidental: nothing nested inside a function is reachable from
a Playwright `page.evaluate`, so there was no way to pin this constant at all
before the hoist. (`BOARD_COLS`, already a top-level `const`, is exactly the
existing precedent this follows -- `spawn-safety.spec.mjs` already reads it
directly.)

## What prompted it

Tracker `2026-07-14T00:23:52.315Z`: *"archbishop is still heavily underpriced
for how strong it is on an open board. perhaps just inflate material value."*

This is the **oldest open feature report** in the backlog as of tonight
(2026-08-05). Working the queue oldest-first is what surfaced it.

## The measurement

There isn't a new one -- the fix predates any measurement discipline this
lane established. What exists is the commit that made the change, same day as
the report, with its own stated reasoning (still the comment in the code):
bishop (300) + knight (300) sum to 600 alone; pricing the archbishop's
*combination* of the two at only 700 undersold it (+100 for two full pieces'
worth of extra mobility); 780 keeps it below the chancellor (rook+knight,
800), which has more raw mobility than bishop+knight.

No before/after sweep exists because no sweep tooling existed on 2026-07-13.
Retroactively constructing one (e.g. via `material-tuning.spec.mjs`'s harness)
was considered and set aside for tonight: the change is three weeks old,
already live in production, and nothing in the backlog or bug queue since
has reported the archbishop as *still* underpriced at 780. Absence of
complaint is weak evidence, but it is the only evidence available without
re-running history, and re-litigating an unreported-broken tuning change
places lower than the rest of tonight's queue.

## The reasoning

**Why resolve the tracker report instead of doing new tuning work against
it?** The report asked for one thing -- "inflate material value" -- and that
happened, same day, in direct response (filed 00:23 UTC, fixed 02:56 UTC).
Nothing about the report or the backlog since asks for a *specific* target
value or disputes 780 specifically. Treating an already-shipped fix as
still-open backlog work is exactly the failure this lane's other entry
(`2026-07-29-pawn-spawn-free-material.md`) already named once: *"the
justification was an inference that had hardened into a citation"* -- there
the citation was a stale comment; here it is a stale tracker note. Both times,
nobody checked the code before repeating the note. The `research/balance/`
README's own index compounded it: it has listed "Archbishop material value"
under "Open, not yet studied" since 2026-07-29, which was never true --
corrected below.

**Why hoist `pieceValues` rather than write an indirect behavioral pin?** An
exact pin via `getBlackMoveRuthless`'s output (the pattern `ai-determinism
.spec.mjs` uses for "known-position regression pins") requires hand-deriving
the exact minimax score of a multi-ply search, which the existing pins did by
tracing specific positions by hand -- fragile to construct fresh and it would
still only pin *relative* ordering (archbishop beats a rook capture), not the
literal 780 the report is actually about. Reading the constant directly is
simpler, exact, and matches how this codebase already tests other top-level
constants.

## The pin

`test/piece-values.spec.mjs`, new file: `pieceValues.a` equals 780, is greater
than `pieceValues.b + pieceValues.n` (600), and is less than
`pieceValues.c` (800). Verified to fail against the pre-2026-07-13 value (700)
by temporarily reverting the constant, running the test, confirming the
expected-780-got-700 failure, then restoring 780 -- not a test that merely
happens to pass.

## Known limits

- This is a pin, not a re-validation. It locks in that the number is 780 and
  is ordered correctly relative to its neighbors; it does not re-establish
  *whether 780 is the right number* with fresh play data. If a future report
  says the archbishop is underpriced (or overpriced) again at 780
  specifically, that is new information this entry does not address.
- The `research/balance/` README's "open, not yet studied" list is corrected
  by this entry (archbishop removed) but the other three items on it --
  pawn supply, the two empty-fodder-floor reports, analytic material
  sufficiency -- remain genuinely open. Don't infer from this entry that the
  index needed a broader audit; only this one item was stale.
