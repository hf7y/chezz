// What counts as an ANSWER, in one place, because the wrong answer to that
// question silently ate four of Zach's replies for up to 16 days.
//
// 2026-08-14. The `question`/`answered` label contract written down in
// CLAUDE.md was never real: nothing applies the `answered` label — not
// GitHub, not the scheduler, not Zach, who said plainly he answers by
// commenting and LEAVES THE ISSUE OPEN. So every consumer that queried
// `--label question --label answered` matched nothing, forever, and
// `check-answer-channel.mjs` reported "N open question(s), 0 of them
// answered" and exited OK — a check passing on the exact failure it was
// written to catch. Meanwhile hf7y/chezz#3 (answered 2026-07-29), #4, #5
// and #6 sat with real direction in their comments; on #6 Zach wrote "this
// should have been answered already. maybe that was lost."
//
// The predicate that works, and the only one that needs no cooperation from
// anybody: an issue is ANSWERED if the repo OWNER left a comment on it that
// is not agent-stamped. Under one shared `hf7y` token an agent's own reply
// looks exactly like Zach's, which is what the stamp is for.
//
// `isStamped` is hf7y/vim-arcade#77's predicate — LAST NON-BLANK LINE ONLY,
// so a stamp quoted mid-body out of another comment does not count —
// mirrored from ecosim's `lib/provenance.py` and realisateur's
// `bin/gh-comment.sh`. Reused as a convention, not imported: those
// dependencies run the wrong direction across repos.
//
// Neither issue STATE nor LABEL gates any of this. Both have already
// dropped answers: `--state open` would have missed a reply on a closed
// issue, `--state closed` the four live ones above. The `answered` label
// still works as an optional override where someone bothers to apply it,
// but is never the trigger.
//
// 2026-08-29: STAMP_RE required a `<project>/<job>` stamp body and matched
// nothing else. `/usr/local/bin/gh` is realisateur's gh-sign.sh now (every
// host, unconditionally) and it stamps `<!-- agent: <account>@<host> ...
// build ... -->` — no slash, an account/host pair instead of a project/job
// one. The old regex never matched that, so it fell through to "unstamped",
// and every comment this project's own automation has posted since gh-sign
// landed (#68, #53, #9, ...) counted as an answer from Zach. This is the
// exact failure the stamp exists to prevent, the other direction: not a
// missed reply, a phantom one. Widened to match realisateur's canonical
// `lib/answered.jq` (hf7y/realisateur#568, the one place this predicate is
// meant to live now) — prefix-only, so it recognises whatever a stamp says
// after `agent:` rather than a specific grammar for it. `stamp()` below is
// unaffected: it still writes `chezz/${job}`, which this still matches.
const STAMP_RE = /^<!--\s*agent:/;

// realisateur's `answered.jq`: Zach sometimes answers OUT LOUD (an `/ideate`
// session on another machine) rather than typing a GitHub comment himself,
// and what lands here is an agent relaying that decision. `<!-- decision-by:
// ... -->` marks a relayed answer so it still counts even though the same
// comment also carries an agent stamp — without this, a spoken answer that
// only reaches an issue through a relay would look identical to an agent
// note asking one. Not yet a live gap for chezz's own history (the relayed
// issues here all also had a separate unstamped comment), but decision-rot
// already reads it and this predicate should not disagree with the one
// place it is meant to live.
const RELAY_RE = /<!--\s*decision-by:/;

/**
 * The stamp this project's own automation appends to anything it posts
 * (hf7y/chezz#21). JOB identifies the script or run doing the posting.
 *
 * It lives here, next to `isStamped`, because the reader and the writer of a
 * grammar drifting apart is the whole failure this file documents: ecosim's
 * Zach-blocked sensor read chezz's unstamped agent comments as answers from
 * Zach and reported BLIND_NO_STAMP_DISCIPLINE instead of a real ratio.
 * `isStamped(stamp(job))` is true by construction, and there is a test on it.
 */
export function stamp(job, now = new Date()) {
  return `<!-- agent: chezz/${job} ${now.toISOString()} -->`;
}

/** BODY with a provenance stamp as its last non-blank line. */
export function stamped(body, job, now = new Date()) {
  return `${body}\n\n${stamp(job, now)}`;
}

/** True iff BODY's last non-blank line is an agent provenance stamp. */
export function isStamped(body) {
  const lines = String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 && STAMP_RE.test(lines[lines.length - 1]);
}

/** True iff BODY carries a relayed-decision marker anywhere in it. */
export function isRelayed(body) {
  return RELAY_RE.test(String(body || ""));
}

/**
 * True iff ISSUE carries a human answer from OWNER: any comment authored by
 * OWNER that is either not agent-stamped, or is a relayed decision (stamped
 * by whichever agent relayed it, but still Zach's own answer). The
 * `answered` label is honoured as an optional override if present, never
 * required.
 *
 * ISSUE is a `gh issue list --json labels,comments` element.
 */
export function isAnswered(issue, owner) {
  if ((issue.labels || []).some((l) => l.name === "answered")) return true;
  return (issue.comments || []).some((c) => {
    if ((c.author || {}).login !== owner) return false;
    const body = c.body || "";
    return !isStamped(body) || isRelayed(body);
  });
}
