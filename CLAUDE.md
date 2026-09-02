# Chezz

A daily-seeded roguelike built on chess rules. Live at
https://hf7y.github.io/chezz/. Full context lives in a few specific
files, not here -- read them, don't duplicate them:

- **Open GitHub issues on `hf7y/chezz`** -- what's in scope right now.
  They are the backlog and the priority queue; there is no file channel.
- `DESIGN-NOTES.md` -- the durable vision/decision record.
- **GitHub issues on `hf7y/chezz`, label `question`** -- open questions
  awaiting a human answer. File one with `scheduler ask chezz "<question>"`;
  Zach answers by **commenting and leaving the issue OPEN** — no label, no
  close. Nothing applies an `answered` label and he does not want to; state
  and labels carry NO information about whether he answered. An issue is
  answered iff it has a comment from `hf7y` that is not agent-stamped
  (`scripts/answered-issues.mjs`, checked across ALL states). The label
  gate that used to be documented here was never real and silently ate
  four of his answers for up to 16 days. The repo is
  PUBLIC -- nothing private in a question. Moved here 2026-07-28 because
  the old on-disk question file was read through a symlinked checkout that
  went stale on every push and silently ate two of Zach's replies. The
  retired coordination files were deleted 2026-08-15 (realisateur#293);
  their history is in git, not on disk.
- `.claude/commands/bug-sweep.md`, `nightly-batch.md`, `ideate.md` -- the
  three standing modes this project runs in (fast mechanical fixes,
  unattended feature implementation, interactive triage/vision).

## When to suggest `/ideate` instead of just implementing

If an interactive request looks like open-ended prioritization, "what
should we build next," a genuine design fork with no single obviously
correct shape, or a broad "check in on the project" ask -- suggest
running `/ideate` instead of diving straight into implementation. This is
a suggestion, not a gate: if the user says to just build/fix something
specific, do that normally, in the same session, no detour required.
`/ideate`'s own job is pulling live state, asking direct questions on
real forks, and recording/queuing decisions for `/nightly-batch` to
implement -- not something to silently emulate inline without actually
invoking it, since part of its value is the durable record it leaves in
`DESIGN-NOTES.md` and the issue tracker.

## Landing work (2026-07-22; corrected 2026-09-02)

Open a branch and a PR, then merge on green — do not push to
`origin/main` directly. The 2026-07-22 grant here said Claude could push
straight to `origin/main` for ordinary work; this account's own permission
provisioner (`selfdev-permissions-provision.sh` in hf7y/realisateur) denies
`git push origin main` and `git push origin HEAD:main` outright, so the
grant described a route the harness already refuses
(hf7y/realisateur#801). Land by branch + PR instead, matching how work has
actually been landing here. Flag every merge in the next report/summary
(what shipped, why, and how to revert it — `git revert <sha>`). This
does not license skipping review of what goes into a commit, only the
push/merge step. Read it:

```
gh api repos/hf7y/chezz/branches/main/protection \
  --jq '{admins: .enforce_admins.enabled, checks: .required_status_checks.contexts}'
```



## Ecosystem protocols

When a change reaches outside this repo, three verbs are the interface. Each
prints its own contract; none of it is restated here, and none of it is a
checklist to recite from memory.

- `notify-senechal <door> <field>=<value>` — file a crontab, device or
  footprint change on senechal's registry. Standing policy for any change to
  crontabs, dotfiles, systemd units or WM config. `--doors` lists the doors.
- `check-project-busy <project>` — before writing DIRECTLY into another
  project's files. Front-door writes carry their own regulator.
- `consulte` — read the estate's own prose.

`discipline` and `BUILD-DISCIPLINE.md` were deleted by hf7y/realisateur#687:
the rows a mechanism already enforced are enforced by that mechanism, and the
rest were unenforced prose. Do not reinstate either here.
