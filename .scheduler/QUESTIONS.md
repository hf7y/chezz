# Questions for the user

Running log, appended to (never overwritten or trimmed) by `/bug-sweep`
and `/nightly-batch` whenever something bigger than a routine tracker note
comes up.

## How to answer (this is the interface)

Reply **inline, directly under the question**, on a new line starting with
`> ` (a Markdown blockquote). That's it — you don't delete anything
yourself. Example:

```
- **2026-07-18 (nightly): Stalemate — reset the floor or die?**
  > reset to the start of the current floor, keep the run alive
```

On its next run, the automation reads this file first, treats any `> `
answer as authoritative (same standing as `FOCUS.md`), acts on it, and
then removes that question+answer block once it has (git history and the
run's report keep the record). A standing direction also gets folded into
`FOCUS.md` so it persists as scope. Unanswered questions are left alone
and never re-asked. If you'd rather just dismiss a question without action,
delete its line by hand — that still works.

---

- **2026-07-20 ("Chezz Classic" scope, part 2/3): is `hf7y.com` (OCF
  Berkeley-hosted) deployable-to from automation, and what does "its own
  production stream" mean concretely?**
  Part 1 (where the code lives) is resolved: you confirmed it lived on
  `main` before narrative-campaign overwrote it there, and git archaeology
  confirmed the exact commit -- `readable-html`'s tip (`6815336`) is the
  precise merge-base, so a new `chezz-classic` branch now points at it
  (pushed to `origin`, `readable-html` left unchanged). Full detail in
  `DESIGN-NOTES.md`'s "Chezz Classic" section, including a caveat: this
  session's sandbox can't reach `hf7y.com` to independently diff it
  against the live page (DNS resolves, TCP connect times out -- looks
  like a sandbox network restriction, not a site-down issue), so worth a
  real check when you have a chance. Two things still needed:
  2. Is the OCF-Berkeley host actually deployable-to from this machine or
     an unattended run (credentials, SSH/rsync access, whatever OCF
     hosting requires), or is publishing there always a manual step no
     matter what automation does?
> Right now there's a manual step but there is ssh access. The right 
> shape of this might be to move the hf7y domain over to github pages.
> right now it's just a redirect to the ocf domain. For now, we'll need
> to work interactively to get an ssh key to allow for deployment to ocf
> which is no problem.

  3. What "its own production stream" means concretely -- a full new
     `scheduler` registration (own repo/branch/FOCUS.md/nightly cadence,
     sharing the same constrained account budget every other registered
     project already competes for) vs. something lighter (occasional
     interactive `/ideate`-or-similar sessions against `chezz-classic`,
     no unattended cron at all).
> Something lighter. It should be called from the same scheduler job.
> Right now, many quality of life features built for chezz narrative
> should be imported into classic. But classic is all about elegance,
> keeping the file size small, the html clean, and the game simple
> and self-evident. So a new set of classic tests will exist that don't
> apply to narrative.

- **2026-07-24 (nightly): should a spawned Black pawn ever be allowed to
  hang (attackable for a free capture) right on arrival?**
  Recurring cluster, at least 4 separate reports since 2026-07-18-20
  (e.g. "black pawn spawns hanging, major problem", "should not spawn
  under threat", "pawns should never hang on load"). Current design is
  intentional, not a bug: `isSafeSquare` in index1.html explicitly skips
  the free-capture check for pawns because "pawns are meant to stand in
  the open" (spawn-safety guarantees only cover the King and non-pawn
  pieces). One report explicitly asks to override that design. This is a
  real balance/risk-reward call, not a defect -- overriding it removes a
  source of early free material for the player, which changes difficulty
  tuning on the fodder floors terrain was just added to. Deferring
  instead of guessing given how often it recurs.
> No. Never. Pawns can spawn under threat if they are defended by another
> piece. But the "stand in the open" logic was not stated by zach. Free
> material on level load is not a good design. We will eventually need to
> build a difficulty detection system that starts from solving, analytically
> what white material is actually needed to defeat black team compositions.
> For now, the general design is more pawns, more terrain, never free on
> fodder levels. Fodder levels should play like a platformer / puzzle.

- **2026-07-24 (nightly): King->Queen -- 1:1 replacement, or a two-piece
  escort mode?**
  Priority-queue item 6's spec draft is in `DESIGN-NOTES.md` ("King->Queen
  -- design spec draft"). Recurring tracker cluster since at least
  2026-07-14 ("what if the player piece were a Queen instead of a King")
  doesn't disambiguate between two differently-sized projects: (a) the
  Queen simply replaces the King everywhere, including carrying the
  exit-row win condition, and every floor's spawn budget / eval weights /
  the King-only can't-hang rule gets re-tuned around a much more durable
  player piece -- or (b) a separate, still-fragile King is reintroduced
  behind the Queen, so the objective becomes escorting the King to the
  exit row while the Queen fights -- a genuinely different two-piece
  objective, not a strength buff. No implementation should start until
  this fork is picked; see the DESIGN-NOTES.md section for the full
  breakdown of what else changes under each option.
> For chezz narrative, we can handle it like this, royal pieces that
> get built up over time. Player can choose to start from level 1 with
> that royal piece already loaded after its unlocked. For example, the
> king finds a neutral knight 1/2 black, 1/2 white on a fodder level;
> he now gains knight movements in addition to king movements. Requires
> wiring up sprite generation via gemini (look into vkv-inventory) to
> create pieces unavailable in the font. For chezz classic, no, always
> king. 

- **2026-07-24 (nightly): should White get a background move-hint
  ("best move" dots) once the engine finds one, if White hasn't moved
  yet?**
  Tracker `2026-07-20T04:02:46.442Z`: "use the engine to solve whites
  best move quietly in the background... signal white's best suggestion
  with dots" once it's ready. This is a genuine design fork, not an
  engineering judgment call: it turns the game from "a puzzle the player
  solves unaided" into "a puzzle with an available hint," which changes
  the core challenge the same way the King->Queen and spawn-gating asks
  do. It would also need engine time firing on White's side (today the
  background search only ever runs for Black's reply) and some UI for the
  suggestion dots, at a moment (see the size question above) where new
  UI surface is a real cost, not a free add. Deferring pending a human
  call on whether hints are wanted at all, and if so, always-on vs. an
  opt-in toggle.
> This is an interesting feature to park. Maybe lay stubs out for.
> It would ultimately be a toggle. Not sure what the real cost is though
> since processing would be background, interrupted, and it doesn't steal
> from black engine work, unless I'm misunderstanding the design. In fact,
> it should be largely free since black's previous move already considered
> white's best move. Shouldn't need to call the engine at all. Basically,
> when white selects the piece that has the best move, the dot corresponding
> to that move should be a special color, or a star, whatever is simplest
> now. Only do this work if the black engine piggyback hypothesis is real,
> otherwise park as an idea in the feature vision tree.

- **2026-07-27 (nightly): may nightly runs do ordinary balance tuning
  (piece values, spawn budgets) on their own, with a regression pin?**
  Restoring a question that went missing: three open feature reports
  (archbishop underpriced, pawn-supply too thin, spawn-gating) and two
  open bug reports (fodder floors feel empty) all carry tracker notes
  saying they are "attached to the balance-tuning delegation question
  (QUESTIONS.md 2026-07-25)" -- but that question was never actually
  written into this file. The 2026-07-25 report told you it was waiting
  on your answer here; it wasn't, so there was nothing you could have
  answered. Filed properly now. The ask: numbers like Archbishop's
  material value, how many pawns a floor's spawn budget buys, and the
  minimum "interesting" force on a fodder floor are tuning, not design
  -- may a run change them when a report complains, provided each change
  lands with a regression test pinning the new number and the report
  says what moved and why? A yes turns five open reports into ordinary
  nightly work. A no keeps them parked here indefinitely, which is fine
  if that's the call -- but they should stop being re-triaged every
  night either way.
> Yes. Balance tuning is good for nightly work. In fact, this research
> should be documented in its own lane, like a folder, since it may
> be interesting to other researchers. This is scholarship. 

- **2026-07-27 (nightly): should unattended nightly runs work the
  `chezz-classic` branch, or is it interactive-only for now?**
  You filed five reports from mandark on 2026-07-26 that target Classic
  specifically ("Import from narrative to classic the color coded move
  dots", "Classic: bugs on mobile with text highlighting", "Classic:
  progression gated by pawn scarcity", the materials-theory one, and the
  pawn-spawn one). Several are straight ports of things that already
  work on narrative `main`, so they're bounded, testable work -- but
  FOCUS.md says not to register anything with `scheduler` for Classic
  until the older parts 2/3 question above is answered, and the size
  budget IS enforced on that branch, so a port has to fit as well as
  work. This is narrower than that older question and unblocks the five
  reports on its own: may a nightly run check out `chezz-classic`, port
  a narrative fix into it, run the (size-enforcing) checks, and push --
  or should Classic stay something you drive interactively? If yes, the
  same four-outcome triage applies there as here.
> Yes, nightly work should work the classic branch. Absolutely try
> porting those things in. If a port is successful but exceeds the size
> limit, keep the work but don't merge, loudly announce on the html
> that the limit was exceeded. Eventually we'll have a nightly builds
> folder of the html pages where beta testers can explore different
> builds. 

- **2026-07-27 (nightly): screenshot attachment on bug reports -- worth a
  new image-hosting dependency?**
  Tracker `2026-07-23T22:51:04.845Z` asks to attach screenshots to
  reports. The chat box is text-only and the Apps Script/Sheets backend
  has nowhere to put an image, so this needs image hosting of some kind
  -- a new external dependency with its own credentials, cost and abuse
  surface, which FOCUS.md says always needs your sign-off before a run
  starts it. Partial relief already shipped tonight (`daffb82`): reports
  now carry the last 5 plies in the URL, so "look at what just happened"
  no longer requires a picture. Worth knowing whether that's enough
  before anyone prices out image uploads.
> Good catch. Park for now. URL is the right place for missing context.


- **2026-07-28 (`/ideate`, interactive): moving chezz's execution to
  dexter -- four calls, none of them building anything yet.**
  Goal as Zach framed it: let gardien move chezz to dexter "without
  building much or breaking anything," production flow unchanged. The
  GitHub-issues redesign of the question channel is explicitly a LATER
  pass, and transitional work that gets sunset by it is acceptable.

  Two findings that shrink the job before any decision:
  (i) `sync-crontab.sh:419` already supports a project with **no local
  working copy** -- `PROJECT_REPO_PATH` is optional, and the
  `focus/`+`questions/` symlinks are only created when it is set. So the
  scheduler engine needs NO change to run chezz without a mandark
  checkout. What unsetting it costs is precisely the answer surface.
  (ii) The branch regime Zach theorized -- agents on one branch, human
  editing an assumed-stale copy, frequent rebasing -- **already exists as
  `focus-commit`**: it fetches, rebases on rejection, and verifies the
  rebase did not change what the commit means. A second branch would add
  merge surface without adding that guarantee.

  The one hard prerequisite is credentials, and it has already killed
  this exact move once: on 2026-07-25 wtul was moved to
  `_paced.dexter.conf` and REVERTED the same day because dexter has no
  matching SSH host alias or deploy key, so `git ls-remote` failed at
  name resolution. chezz's `REPO_URL` is
  `git@github-chezz-deploy:hf7y/chezz.git` and needs the same alias + key
  provisioned on dexter, verified by running `git ls-remote` FROM dexter
  before any participant line moves. (Not verifiable from mandark: no key
  here authenticates to dexter, and `_paced.dexter.conf`'s own header
  says dexter owns that file and writes it in a human session there.)

  Also a policy call, not just config: `_paced.dexter.conf`'s pinning
  policy says only hardware-evidenced projects belong there, with `wtul`
  as a deliberate named exception. chezz would be the SECOND non-hardware
  exception.

  The four questions, with this session's recommendation on each:
  1. **Answer surface.** (a) Keep the mandark checkout as a
     human-only answer surface -- symlinks and vim mappings keep working,
     near-zero build, just add an ff-only refresh so it cannot go stale;
     (b) teach scheduler to fetch QUESTIONS.md from origin into a cache
     and push back after edit -- true "no repo on mandark" but real new
     engine machinery, and the most likely thing the issues pass throws
     away; (c) unset `PROJECT_REPO_PATH` now and lose the channel until
     the issues design lands. RECOMMEND (a): it is the cheapest thing
     that keeps today's interface working, and its sunset is expected.
  2. **Move scope.** Both participants (`chezz`|1|2 and `chezz-sweep`|1)
     at once, or nightly first and the sweep later? RECOMMEND nightly
     first -- a one-line revert, and a smaller test of the second
     non-hardware exception.
  3. **Branch model.** Adopt the two-branch regime, or keep single `main`
     + `focus-commit`? RECOMMEND keeping single `main`: today's actual
     losses (a swallowed commit message, a stranded commit) came from
     bare git BYPASSING focus-commit, not from single-branch.
  4. **Gemini key on dexter.** Provision it there, or leave sprite
     generation interactive on mandark? RECOMMEND leaving it: on dexter
     the key is simply absent, `generate-pieces` refuses loudly, and the
     game renders committed sprites + glyph fallbacks (already the tested
     path). Note the ledger would otherwise split across two machines and
     the per-month cap would count separately on each.
> 
> **ANSWERED 2026-07-28 (realisateur `/ideate`, Zach live) -- Q1 ONLY. Q2/Q3/Q4 remain open.**
>
> **Q1 (answer surface): NONE OF (a)/(b)/(c) as framed -- go straight to
> GitHub issues, and skip the transitional work entirely.** Zach was shown
> your recommendation of (a) (keep the mandark checkout as a human-only
> answer surface, add an ff-only refresh) alongside a bare-repo option and
> a straight-to-issues option, and chose the last. His stated reasoning
> matches your own framing back at you: you noted the issues redesign is a
> LATER pass and that transitional work getting sunset is ACCEPTABLE --
> he disagreed with the second half. Nothing that the issues pass would
> throw away gets built. This explicitly accepts a gap in the answer
> channel rather than bridging it.
>
> **The gap has a defined end, and it is one credential, not a design.**
> Surfaced in the same session and verified rather than assumed: `gh`'s
> token on mandark is INVALID (`gh auth status`: *"Failed to log in to
> github.com account sidopera ... token ... is invalid"*), though `gh`
> itself is installed. Zach's follow-on answer: **fix the credential
> first -- it is a prerequisite, not a gap to route around**, so the
> issues design can be scoped against a working API instead of theorized.
> `gh auth login` is human-only and is filed as a Zach blocker. Ownership
> of the issues design sits with **gardien**, which owns github (filed
> there 2026-07-28, `fd7e311`). It is not chezz's to build.
>
> **Worth knowing while the channel is down:** `BLOCKERS.md` is NOT part
> of the symlink layer -- it is a real file in scheduler's own repo, and
> its `### REPLY` path is the one with a *proven* round-trip (your own
> 2026-07-27 entry: the gemini answer that produced `f7a2458`). It
> survives every project moving to dexter. It was offered as a formal
> bridge and Zach did not take that option, so this is a note about what
> still works, not a new policy.
>
> **Your two shrinking findings were both confirmed and have been carried
> to gardien** so the replacement design does not re-learn them:
> `sync-crontab.sh:419` tolerating an unset `PROJECT_REPO_PATH`, and the
> symlink-bridge being proven broken by `cmd_idea`'s `mv "$f.tmp" "$f"`.
>
> **Context that changed under you since you filed these:** the dexter
> pinning policy is fully reversed -- dexter is the DEFAULT host, "move
> everything possible". You are therefore no longer "the SECOND
> non-hardware exception"; there is no exception category left to be. That
> reversal has now been written into `schedule/_paced.dexter.conf`'s own
> header (`bccf9ce`), which had still been asserting the retired rule --
> the exact decay you flagged. Q2 (move scope) may want re-reading in that
> light: your RECOMMEND of nightly-first was argued partly as "a smaller
> test of the second non-hardware exception", and that argument is gone.


> ---
>
> **ANSWERED 2026-07-28 (realisateur `/cloture`, Zach live, supervision
> session) -- Q2/Q3/Q4 now closed. Two CORRECTIONS to the Q1 block above.**
>
> **Q3 (branch model): single `main` + `focus-commit`.** Zach: "single is
> fine if it's how the pros do it" -- it is; single-trunk with
> rebase-on-conflict is ordinary practice for solo/small-team work, and
> the two-branch human/agent split would add merge surface without adding
> the guarantee `focus-commit` already provides. Your RECOMMEND stands.
>
> **Q4 (Gemini key): leave it on mandark.** Sprite generation stays
> interactive there; on dexter the key is simply absent, `generate-pieces`
> refuses loudly, and the game renders committed sprites + glyph
> fallbacks. Your RECOMMEND stands. The ledger does not split.
>
> **Q2 (move scope): NIGHTLY ONLY. `chezz-sweep` stays on mandark.**
> Zach did not answer this one directly (he answered the issues-channel
> design instead), so it was defaulted to your RECOMMEND -- but on NEW
> evidence, not on the retired "second non-hardware exception" argument
> the block above correctly notes is gone. The new reason is mechanical
> and is a blocker in its own right, below.
>
> **BLOCKER FOUND, not previously filed: chezz is still on the LEGACY
> WRAPPER PATH, and that breaks the move as currently scoped.**
> `schedule/chezz.conf` sets both `BATCH_SCRIPT` and `SWEEP_SCRIPT`,
> pointing at `/home/zach/.local/bin/chezz-*-loop.sh` -- **mandark files
> that do not exist on dexter.** Every dexter participant line uses
> `scheduler-run <project> <tier>`, and `scheduler-run:46` hard-refuses
> any tier whose `*_SCRIPT` is still set (exit 2: "that legacy wrapper is
> authoritative"). So the move is NOT the paired one-line edit described
> in FOCUS.md -- MIGRATION.md step 2 must be completed first, or chezz
> lands on dexter and fails every dispatch.
> Verified by diffing the wrapper against the conf this session:
> - **Nightly: one line.** `REPO_URL`, `REPO_SUBDIR`, `MAX_TURNS=200`,
>   `EXPIRY_DAYS=7` and the prompt are ALREADY mirrored in `chezz.conf`.
>   Deleting `BATCH_SCRIPT` is the whole migration.
> - **Sweep: not one line.** Its wrapper carries three settings that exist
>   nowhere in the conf -- `MAX_TURNS=40`, `MODEL=claude-sonnet-5`, and
>   `PRECHECK_CMD=/home/zach/.local/bin/chezz-bug-sweep-precheck.sh`, a
>   mandark-only script that would also have to be ported to dexter.
> That asymmetry is the real argument for nightly-first.
>
> **Second blocker, smaller: `PROJECT_REPO_PATH` is a mandark path.**
> `chezz.conf` sets it to `/home/zach/Documents/Project Archive/chezz`,
> which does not exist on dexter. Per `sync-crontab.sh:419` it is optional
> so dispatch does not break -- but under Q1's "straight to issues, build
> nothing transitional" answer it should be UNSET as part of the move,
> and unsetting it is what removes the vim/symlink answer channel. Also
> note `BATCH_PROMPT` writes to `~/reports/chezz/`, which after the move
> is dexter's disk -- the morning-read location moves with the job.
>
> **CORRECTION 1 (matters most): `gh` on mandark is NOT invalid.** The Q1
> block above states its token is INVALID and Zach's follow-on answer made
> "fix the credential first" a PREREQUISITE, filed as a Zach blocker and
> carried to gardien (`fd7e311`). Re-probed first-hand this session:
> `gh auth status` on mandark shows **`hf7y`, Active account: true, valid
> token, scopes admin:public_key/gist/read:org/repo**. The failing
> `sidopera` line is a SECOND, INACTIVE account in the same `hosts.yml`.
> The earlier reading took the failing line and missed the working one.
> Witness, run on mandark this session: `gh issue list --repo hf7y/chezz`
> returns rc=0, and `gh repo view hf7y/chezz --json hasIssuesEnabled`
> returns `true` (repo is PUBLIC, issue count currently 0).
> **Consequence: the prerequisite is DISSOLVED, not merely satisfied.**
> The issues design can be built today, from mandark, with no credential
> work. gardien should be told, since it is holding a blocker that does
> not exist. dexter is independently authenticated as `hf7y` too.
>
> **CORRECTION 2: `_paced.dexter.conf`'s stale policy header is already
> fixed.** FOCUS.md's caveat says lines 29-33 still assert the retired
> pin-by-need rule "and cannot be corrected from mandark". Verified live
> ON dexter this session: the header now reads "HOST POLICY (REVERSED
> 2026-07-28) ... dexter is the DEFAULT execution host", committed as
> `bccf9ce` and present in both dexter's working copy and origin. Nothing
> to amend during the move. (This session relayed the stale caveat once
> before re-probing it -- flagging so the caveat itself gets retired from
> FOCUS.md rather than re-read by the next run.)
>
> **dexter readiness, all verified first-hand this session, not recalled:**
> `git ls-remote git@github-chezz-deploy:hf7y/chezz.git` FROM dexter
> succeeds (the `github-chezz-deploy` alias + `~/.ssh/dexter_chezz_deploy`
> key are provisioned there) -- the prerequisite that reverted wtul on
> 2026-07-25 does NOT apply to chezz. `node v24.18.0` present at
> `~/.local/bin/node` and on cron's PATH. `jq 1.8.1` installed by Zach
> this session. `~/scheduler` clone current with origin; `chezz.conf`
> present. Still MISSING on dexter: the four realisateur ecosystem guard
> commands (`notify-senechal`, `check-project-busy`, `focus-commit`,
> `silence-audit`).
>
> **THE ISSUES CHANNEL -- Zach's design question, answered.** He asked:
> "something back to Zach that feels like vim edit by pulling the issues
> using the scheduler wrapper?" Yes, and one rule matters more than the
> rest. The reason the file channel never round-tripped is on record
> (scheduler `BLOCKERS.md`): `questions/chezz.md` symlinks into a checkout
> that goes one commit stale on every push. The fix is not a better copy,
> it is **no copy** -- the buffer must be rendered fresh from the API on
> every invocation and DELETED on exit. A view, not a file. Anything that
> persists question state on disk re-creates the staleness class being
> escaped. Shape, as `scheduler -q <project>` in `scheduler/bin/`
> (ecosystem-wide, not chezz-specific):
> 1. `gh issue list --label question --state open --json
>    number,title,body,comments` -> render ONE markdown buffer shaped like
>    today's QUESTIONS.md: each issue headed by its `#123`, body verbatim,
>    then an empty `> ` answer slot. Same interface Zach's fingers know.
> 2. Open `$EDITOR` on it in a tempfile.
> 3. On exit, parse the `> ` blocks; for each with content,
>    `gh issue comment #123`. Answers are COMMENTS, never body edits --
>    the ask survives verbatim and history is free.
> 4. Delete the tempfile. Next run re-renders.
> Labels carry the semantics the file had: agents `gh issue create --label
> question`; a human reply adds `answered`; the nightly reads
> `label:question,answered`, acts, then CLOSES the issue -- the same
> "removes the block once it has acted" contract. No merge logic is needed
> anywhere: there is never a second writer to the same bytes, and the
> worst case is two comments. Per BUILD-DISCIPLINE it must FAIL LOUD if
> `gh` errors -- a questions command that silently renders an empty buffer
> is indistinguishable from "no questions", which is precisely the failure
> being retired. Caveat to decide before it propagates: `hf7y/chezz` is
> PUBLIC, so every question and answer is world-readable -- fine for
> chezz, not automatically fine ecosystem-wide.
> Ownership stays with **gardien** per the Q1 block; this is a design
> handoff, not chezz building it.
