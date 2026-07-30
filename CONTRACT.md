# CONTRACT — `joue`

play and score

Revised 2026-07-30 from `origin/bashified:CONTRACT.md` (2026-07-30), which
recorded zero subcommands and "no shell tooling existed in this project".
That finding was true of *shell scripts* and wrong about the project: the
HOW column asks whether a model is in the loop, not what language the work
is written in. chezz has a large mechanized surface — 138 named Playwright
assertions, three node guards, a git hook, three GitHub Actions workflows
and a pre-call spend cap — none of it reachable through a verb. The split
this document reports is therefore **mechanized but not reachable**, not
"nothing was ever mechanized".

## How to read the HOW column

| HOW | meaning | exit when unmet | cost |
|---|---|---|---|
| **bash** | mechanized. Runs free, unattended, no model in the loop. | 5 if it ran and broke | free |
| **summon** | SHOULD DO — in scope, not yet mechanized. | 4 (GAP), naming its own escalation | metered, printed before spending |
| **refused** | WON'T DO — out of scope on principle. | 7 (REFUSED) | n/a, no summon exists |

`--summon` is available on 4 and forbidden on 7. A gap names its
escalation; a refusal offers none, because having no escalation path is
what refusing on principle means.

## The obligations

### Play — the board must obey its own rules

| obligation | HOW | backed by |
|---|---|---|
| ship the entire game as one self-contained file with no build step | bash | `index1.html` (2367 lines, inline `<script>`); `deploy-narrative-pages.yml` uploads the file directly |
| refuse a move that leaves the King capturable, and only the King | bash | `kingSafeAfterMove` / `legalMovesFrom` / `isLegalMove` in `index1.html`; `test/move-into-check.spec.mjs` |
| keep a run alive when the player has zero legal moves — reset the current floor, never end the run, never restart at floor 1 | bash | `checkStalemate()` / `floorStart` in `index1.html`; `test/stalemate.spec.mjs` |
| never place a scripted narrative boss where it is capturable on move 1 | bash | `placeScriptedStage` (capture-aware against the carried army); `test/spawn-safety.spec.mjs`, `test/narrative-campaign.spec.mjs` |
| give the same seed the same board and the same AI reply | bash | `test/date-seed.spec.mjs`, `test/ai-determinism.spec.mjs`, `test/ai-quiescence.spec.mjs` |
| step a dragged piece to the nearest legal square, and rank surviving pieces up behind the King once Black is gone | bash | `test/auto-march.spec.mjs` (4 assertions, incl. the negative path: no formation-follow while Black remains) |
| make walls block and holes impassable | bash | `TERRAIN_WALL` / `TERRAIN_HOLE` in `index1.html`; `test/terrain.spec.mjs` (8 assertions) |
| keep every piece legible against every square | bash | `test/piece-visibility.spec.mjs`, `test/threat-coloring.spec.mjs` |

### Score — the ledger outside the game

| obligation | HOW | backed by |
|---|---|---|
| record daily and all-time scores | bash | `doPost` / `doGet` and `SCORES_SHEET_NAME` in `leaderboard/Code.gs` |
| accept a player's bug and feature reports from inside the game | bash | `BUGS_SHEET_NAME` in `leaderboard/Code.gs`; `test/bug-report.spec.mjs` |
| show the last unattended sweep's timestamp and fix count on the page, so a stalled sweep is visible without reading cron logs | bash | `#sweepStatus` in `index1.html`; `test/sweep-status.spec.mjs` |
| deploy the leaderboard backend when `Code.gs` changes | summon | `npm run sheet:push` (`clasp push --force`) exists and is run by hand. No hook, no workflow, and no check that the deployed script matches the tracked file — a drift this contract's own discipline says must fail loud, and today cannot |

### Guard — what must be true before anything lands

| obligation | HOW | backed by |
|---|---|---|
| parse the inline `<script>` before a typo can reach a browser | bash | `scripts/check-syntax.mjs` (`node --check` on the extracted block) |
| print `index1.html`'s size on every run so creep stays visible | bash | `scripts/check-size.mjs` |
| fail loud when `chezz-classic` exceeds its 100,000-byte hard cap | bash | `scripts/check-size.mjs`, `enforced = branch === "chezz-classic"` |
| run the full regression suite before a commit lands, and skip it only for changes that cannot touch gameplay | bash | `.githooks/pre-commit`; the `non_docs` allowlist is one source, not retyped |
| run the same checks on every push and pull request | bash | `.github/workflows/test.yml` |
| prove the game still plays — 138 named assertions across 26 spec files | bash | `npm test` (Playwright); `test/*.spec.mjs` |
| verify what a mobile WebKit device actually renders | summon | undetermined — five open bugs (two superscript rendering, three text-selection-on-drag) need a real device this sandbox does not have. What would settle it: one run on physical hardware, or a declared decision that WebKit is out of support |

### Publish

| obligation | HOW | backed by |
|---|---|---|
| publish `main` to `hf7y.github.io/chezz` | bash | `.github/workflows/deploy-narrative-pages.yml`, `on: push: branches: ["main"]`, `concurrency: pages` |
| be honest that publishing is autonomous | bash | same workflow — **and this contradicts the registry.** `schedule/chezz.conf` declares `AUTONOMY_TIER="medium"` glossed as "no autonomous merge/deploy", while the project charter permits pushing to `main` unasked and that push *is* the deploy. Recorded as an observed conflict, not resolved here: one of the two is wrong and only Zach can say which |

### Autopilot — the loop that runs when nobody is watching

| obligation | HOW | backed by |
|---|---|---|
| fail loud when it cannot reach the place Zach's answers live, because an unreachable API and a quiet night both look like zero answers | bash | `scripts/check-answer-channel.mjs`; wired into `nightly-batch.md` and `bug-sweep.md`, deliberately not into `npm run check` |
| read `.scheduler/FOCUS.md` before touching anything | summon | `BATCH_PROMPT` in `schedule/chezz.conf` states it; enforcement is a model reading an instruction, so it is metered and unverified. No check asserts the file was read |
| triage the tracker nightly and ship or defer each report | summon | a project command file, dispatched by `chezz-nightly-batch` via `_paced.conf`. Built and running — a model is in the loop, so it is metered by definition, not free |
| sweep for bugs on the same rotation | summon | a project command file, `chezz-sweep` in `_paced.conf`; `.github/workflows/bug-sweep.yml` is the cloud half |
| know what the loop costs per call | summon | undetermined — `GAPS.md` records the standing gap and it is still open. No before-measurement exists, so the saving from mechanizing anything here is **unmeasured, not zero and not assumed**. What would settle it: one real measurement, never an estimate |

### Art — the only path that can spend money

| obligation | HOW | backed by |
|---|---|---|
| refuse a sprite call that would exceed the cap, *before* the call | bash | `DEFAULT_RUN_CAP` (18) / `DEFAULT_MONTH_CAP` (60) in `tools/gemini-budget.mjs`; the ledger lives at `~/.config/chezz/gemini-spend.json`, outside the repo, because a scheduled run resets its clone `--hard` |
| guarantee a returned sprite is monochrome regardless of what the model did | bash | palette snap in `tools/sprite-postprocess.js`; `test/sprite-postprocess.spec.mjs`, `test/piece-sprites.spec.mjs` (11 assertions) |
| ship `PIECE_SPRITES` empty, so the committed game is byte-for-byte the glyph game | bash | `index1.html`; `test/piece-sprites.spec.mjs` |
| generate a sprite | summon | `npm run pieces:generate` exits non-zero with instructions when no key is present, and no `GEMINI_API_KEY` is reachable from an unattended run. Metered by construction; one `export` away from working |
| state what a call actually costs | summon | undetermined — `USD_PER_IMAGE = 0.04` is documented in `tools/gemini-budget.mjs` as unverified, never checked against an invoice. The call caps are the real guard precisely because they do not depend on it. What would settle it: one billed call reconciled against a real invoice |

### The front door

| obligation | HOW | backed by |
|---|---|---|
| make every mechanized obligation above reachable as `joue <subcommand>` | summon | `bin/joue` exists on `origin/bashified` with an **empty** `verb_subcommands` table, and `joue` is not on `PATH`. Every bash row above is real and none of it is callable through the verb. This is the single largest gap in this contract |
| speak the 4 / 5 / 6 / 7 exit vocabulary | summon | `lib/verb.sh` defines it and nothing behind it uses it. `scripts/*.mjs` signal every failure with `process.exit(1)`, so "the tracker is unreachable" (BLIND, 6) and "the syntax is broken" (BROKEN, 5) are indistinguishable to a caller |

## What `joue` WILL NOT do

| obligation | HOW | backed by |
|---|---|---|
| generate sprites as a side effect of `npm run check` or a nightly run | refused | `DESIGN-NOTES.md`: "generation is a deliberate manual step — never a side effect ... since each run costs money and returns different art" |
| let size be the reason a feature on the narrative build is deferred or trimmed | refused | `DESIGN-NOTES.md` size policy, 2026-07-25 human reply: "size must never again be the reason a feature is pre-deferred". `scripts/check-size.mjs` implements the refusal — it prints and exits 0 off `chezz-classic` |
| quietly trim `chezz-classic` to get under its cap | refused | `scripts/check-size.mjs`: fail loud and file a blocker to raise the threshold, "never trim silently to get under it" |
| add a build step, a runtime dependency, or a local asset to the game | refused | `DESIGN-NOTES.md`: data URIs keep chezz "a single self-contained HTML file (what makes the share links, the `file://` test harness and the Pages deploy work with no build step)" |
| install Python, `google-genai`, Pillow or numpy to port the sprite pipeline | refused | `DESIGN-NOTES.md`, "Zero new dependencies" — the port is a rewrite using Playwright's already-present `<canvas>`, not a copy of `vkv-inventory`'s |
| reintroduce a saturated or hued palette | refused | `.scheduler/FOCUS.md` standing rule: monochrome is an "explicit, repeated reporter ask — don't reintroduce ... without a fresh ask" |
| read `.scheduler/QUESTIONS.md` for pending work, or append to it | refused | the project charter: it is a "FROZEN historical record ... Do not append to it; do not read it for pending work." Questions moved to GitHub issues on `hf7y/chezz`, label `question`, 2026-07-28 |
| stand up a cloud `/bug-sweep` an assistant Code routine | refused | `.scheduler/FOCUS.md`, 2026-07-20: "PARKED INDEFINITELY ... Do not implement, do not re-ask unless something material changes." It would need its own push credentials and would draw on the same account-wide budget local automation already covers |
| edit the `scheduler` repo to fix chezz's own registry entry | refused | `.scheduler/FOCUS.md`, 2026-07-24: the `SCHEDULER_SUBDIR` line was needed and was flagged in a report rather than written from here. Chezz "correctly refused to edit THIS repo from there" — the cross-project boundary held even at the cost of a day of dangling symlinks |
| put anything private in a question | refused | the project charter and `schedule/chezz.conf`: `hf7y/chezz` is PUBLIC, so every question and answer is world-readable. Accepted knowingly for chezz, and explicitly not transferable to the next project |

**Deliberately not refused, and named rather than omitted.** "Chezz Classic"
as its own production stream is *not* filed as a refusal. `DESIGN-NOTES.md`
questions 2 and 3 — is `hf7y.com`/the OCF-Berkeley host deployable-to from
an unattended run, and does "own production stream" mean full scheduler
registration or occasional interactive work — are open and addressed to
Zach. Registering it is "a real recurring-budget commitment that shouldn't
be guessed into", which is a reason to wait, not a reason to refuse. It is
a **summon, `backed by: undetermined`**; what would settle it is an answer
to questions 2 and 3, not a decision made here.

## Universal clauses

Every subcommand, without exception:

- exits **0 only if the promise was kept**. Never an exit-0 no-op.
- exits **4 (GAP)** if the tooling does not exist, and says what is
  missing. `--summon` is available on 4.
- exits **5 (BROKEN)** if it ran and broke.
- exits **6 (BLIND)** if it cannot read its domain. "I cannot see" is
  never reported as "nothing to report".
- exits **7 (REFUSED)** if asked to do something out of scope on
  principle. `--summon` is forbidden on 7; no summon exists.
- **cannot spend** unless it declares `--summon`, which has no short form
  and is never implied. The cost is printed before it is spent.

## Verification

```
./test/contract-test.sh joue
```

## The finding

**23 bash rows, 10 summon rows, 10 refusals — and not one of the 23 is
reachable through the verb.** chezz is the most mechanized project in this
pass so far, and has the emptiest front door: `bin/joue`'s subcommand table
is literally blank. The gap is not the work; it is the surface. Two cheap
things would close most of it — wire `check-syntax`, `check-size`, `test`,
`check-answers` and `pieces:spend` into `verb_subcommands`, and make the
`.mjs` guards exit 4/5/6 instead of a uniform 1, so the vocabulary this
contract declares becomes something a caller can act on rather than
something only this document believes.
