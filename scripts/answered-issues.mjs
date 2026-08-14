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

const STAMP_RE = /^<!--\s*agent:\s*\S+\/\S+\s+\S+\s*-->$/;

/** True iff BODY's last non-blank line is an agent provenance stamp. */
export function isStamped(body) {
  const lines = String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 && STAMP_RE.test(lines[lines.length - 1]);
}

/**
 * True iff ISSUE carries a human answer from OWNER: any comment authored by
 * OWNER that is not agent-stamped. The `answered` label is honoured as an
 * optional override if present, never required.
 *
 * ISSUE is a `gh issue list --json labels,comments` element.
 */
export function isAnswered(issue, owner) {
  if ((issue.labels || []).some((l) => l.name === "answered")) return true;
  return (issue.comments || []).some(
    (c) => (c.author || {}).login === owner && !isStamped(c.body || "")
  );
}
