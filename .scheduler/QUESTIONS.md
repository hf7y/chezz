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
  3. What "its own production stream" means concretely -- a full new
     `scheduler` registration (own repo/branch/FOCUS.md/nightly cadence,
     sharing the same constrained account budget every other registered
     project already competes for) vs. something lighter (occasional
     interactive `/ideate`-or-similar sessions against `chezz-classic`,
     no unattended cron at all).
  > (answer inline here)

