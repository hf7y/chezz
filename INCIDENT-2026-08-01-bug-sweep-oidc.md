# Incident — the Bug Sweep failed for four days and nothing said so

**Filed 2026-08-01, from mandark, at the moment chezz left that host.**

## What happened

`.github/workflows/bug-sweep.yml` runs `/bug-sweep` unattended on a daily
`0 14 * * *` cron. It ran. It failed. It did that on **2026-07-29, 07-30,
07-31 and 08-01** — four consecutive scheduled runs, every one a failure, at
the same step:

```
Run anthropics/claude-code-action@v1
Action failed with error: Could not fetch an OIDC token.
Did you remember to add `id-token: write` to your workflow permissions?
```

`test.yml` was also failing on push over the same period.

## Why it went unnoticed

The job **starts cleanly**. Checkout, `setup-node`, `npm ci`, the Playwright
install and "Record starting commit" all pass; the failure is step 7 of 12.
A glance at the Actions tab shows a busy schedule doing its work, and the run
history is a column of red only if you look at the column.

Nothing outside GitHub watched it. chezz is unregistered with the scheduler
and has no crontab entry on mandark, so no ecosystem instrument had it in
domain. It was discovered only because someone asked whether chezz could be
removed from mandark, and confirming *"it works autonomously on GitHub"*
meant checking rather than assuming.

    A SCHEDULED JOB AND A WORKING JOB ARE TWO WORLD-STATES.
    A RUN HISTORY SHOWS BOTH AS ACTIVITY.

## The cause

`anthropics/claude-code-action@v1` authenticates by OIDC. The workflow grants:

```yaml
permissions:
  contents: write
```

and OIDC needs `id-token: write`. The `ANTHROPIC_API_KEY` secret is present
and was never the problem — which is worth stating, because "the key expired"
is the first guess and it is wrong here.

## The fix, which is one line

Add `id-token: write` to that permissions block, and restore the cron **in the
same commit**, so the schedule cannot return without the permission it needs.

## What was done instead, and why

The cron is **commented out in the file**, not switched off from the Actions
tab. A workflow disabled in GitHub's UI still reads as scheduled to anyone
opening this YAML, and a state the repository cannot see is a state nobody
maintains. The pause is therefore visible in `git log` and carries its own
reason.

Fixing it properly was left to a human because re-enabling an unattended agent
that pushes to `main` is a decision about spending and about trust, not a
syntax change.

## Context: chezz left mandark the same day

The local copy at `~/Documents/Project Archive/chezz` was removed (203M) after
recoverability was verified three ways: `fauche check` REMOVABLE,
`git rev-list --branches --not --remotes` = 0, and all 8 local heads matched
`git ls-remote` by sha. Four branches were pushed first — `feature/movement-qol`,
`minimalist-fork`, `simplify-and-polish` existed only on that host, and
`readable-html` was 13 commits ahead — though none carried commits absent from
some remote, so only the names were ever at risk.

Recover the working copy with:

```
git clone git@github-chezz-deploy:hf7y/chezz.git
```

**The consequence worth naming:** chezz's only automation is now this
repository's own Actions, and that automation is paused. Nothing on any host
advances chezz until a human restores the cron with the permission fixed.
