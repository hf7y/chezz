# CONTRACT -- `joue`

play, score and test the chess board

Derived 2026-07-30 from the tooling that actually existed in `chezz`.
Where there was no stated contract before, this is the first one; that
is a finding about the old tree, recorded rather than hidden.

## The promise

```
joue <subcommand> [args...]
```

| subcommand | promises | backed by |
|---|---|---|
| *(none)* | — | **no shell tooling existed in this project** |

## Universal clauses

Every subcommand, without exception:

- exits **0 only if the promise was kept**. Never an exit-0 no-op.
- exits **4 (GAP)** if the tooling does not exist, and says what is missing.
- exits **6 (BLIND)** if it cannot read its domain. "I cannot see" is
  never reported as "nothing to report".
- **cannot spend money** unless it declares `--summon`, which has no
  short form and is never implied.

## Verification

```
./test/contract-test.sh <command>
```

The same assertions run against the legacy tooling and against `joue`.
That is what makes "keeps the same contract" a measurement, not a claim.
