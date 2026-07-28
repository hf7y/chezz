/* Hard pre-call spend cap for the Gemini sprite pipeline, plus the ledger the
 * cap reads. Zach's account is experimental with a small balance, and the
 * pipeline is being wired so unattended nightly runs can reach it -- an
 * after-the-fact spend report would only ever tell us the balance was already
 * gone. So the cap REFUSES before the call; the report is a readout of the
 * same ledger, not the safety mechanism.
 *
 * WHERE THE LEDGER LIVES, and why not in the repo: a scheduled run works in a
 * dedicated clone that is reset --hard to origin before every dispatch, so a
 * ledger committed to the repo would be wiped (or, worse, pushed -- publishing
 * usage history). It lives next to the key, under ~/.config/chezz/, which is
 * the same directory SECRETS_SRC_DIR copies into the clone. The ledger is
 * written back to the REAL path, not the copy, so counts survive the run.
 *
 * CALLS ARE THE EXACT UNIT; DOLLARS ARE AN ESTIMATE. The API returns no price
 * and no balance, so any dollar figure here is arithmetic on a constant a
 * human typed. USD_PER_IMAGE is therefore documented as unverified and the
 * caps that actually bite are call counts. Do not let a dollar estimate be the
 * only thing standing between an experimental balance and a loop.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/* ONE source for both the key and the ledger -- the generator must not retype
 * either path. */
export const CONFIG_DIR = process.env.CHEZZ_CONFIG_DIR || path.join(os.homedir(), ".config", "chezz");
export const LEDGER_PATH = path.join(CONFIG_DIR, "gemini-spend.json");
export const KEY_PATH = path.join(CONFIG_DIR, "gemini.env");

/* UNVERIFIED as of 2026-07-28 -- nobody has yet completed a single billed call
 * to check it against a real invoice, because billing was not enabled on the
 * account (see test/gemini-fatal.spec.mjs for that run). Treat every dollar
 * figure this module prints as an estimate until someone stamps this line
 * `# verified <date> via <invoice//pricing page>`. The call caps below are the
 * real guard precisely because they do not depend on this number. */
export const USD_PER_IMAGE = 0.04;

/* Deliberately small. This is an experimental account, and the pipeline's full
 * piece set is 18 -- so the monthly cap allows a handful of full regenerations
 * and nothing resembling a runaway. Raise them by env var for a one-off large
 * run rather than editing the file, so the default stays conservative. */
export const DEFAULT_RUN_CAP = Number(process.env.CHEZZ_GEMINI_RUN_CAP || 18);
export const DEFAULT_MONTH_CAP = Number(process.env.CHEZZ_GEMINI_MONTH_CAP || 60);

export function monthKey(when = new Date()) {
  return `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function readLedger() {
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
    // A ledger that exists but is malformed must NOT read as "no spend yet" --
    // that is the one failure mode that silently disables the cap. Throw.
    if (!parsed || typeof parsed !== "object" || typeof parsed.months !== "object") {
      throw new Error("ledger is missing its `months` object");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return { months: {} };
    throw new Error(
      `gemini ledger at ${LEDGER_PATH} is unreadable (${error.message}) -- refusing to run.\n` +
      `  Fix or delete it deliberately; a corrupt ledger must never be treated as zero spend.`,
    );
  }
}

export function billedThisMonth(ledger, key = monthKey()) {
  return ledger.months?.[key]?.billed ?? 0;
}

/* The guard itself. Returns how many calls this run may make, or throws with a
 * message naming the number and the fix. Call ONCE before the loop starts and
 * again is harmless -- but the per-call recording is what keeps it honest
 * across a long run. */
export function assertBudget(requested, ledger = readLedger(), opts = {}) {
  const runCap = opts.runCap ?? DEFAULT_RUN_CAP;
  const monthCap = opts.monthCap ?? DEFAULT_MONTH_CAP;
  const key = opts.month ?? monthKey();
  const already = billedThisMonth(ledger, key);

  if (requested > runCap) {
    throw new Error(
      `refusing: ${requested} generations requested but the per-run cap is ${runCap}.\n` +
      `  Raise deliberately for a one-off: CHEZZ_GEMINI_RUN_CAP=${requested} npm run pieces:generate`,
    );
  }
  const remaining = monthCap - already;
  if (remaining <= 0) {
    throw new Error(
      `refusing: ${already} billed generation(s) already this month (${key}), cap is ${monthCap}.\n` +
      `  Estimated spend so far: ${formatUsd(already)} (estimate -- see USD_PER_IMAGE).\n` +
      `  Raise deliberately: CHEZZ_GEMINI_MONTH_CAP=<n>, or wait for ${key} to roll over.`,
    );
  }
  if (requested > remaining) {
    throw new Error(
      `refusing: ${requested} generations requested but only ${remaining} left under this month's cap ` +
      `(${already}/${monthCap} used in ${key}).\n` +
      `  Generate a subset instead -- e.g. npm run pieces:generate -- <letters> -- or raise ` +
      `CHEZZ_GEMINI_MONTH_CAP deliberately.`,
    );
  }
  return remaining;
}

/* Recorded per call, immediately, BEFORE the next one goes out -- so a run
 * killed halfway still leaves an accurate count. `billed` is what the cap
 * counts: a request rejected by the API (429/403) is not charged, but it is
 * still recorded under `attempts` so the ledger explains itself. */
export function recordCall({ billed, when = new Date() } = {}) {
  const ledger = readLedger();
  const key = monthKey(when);
  const month = ledger.months[key] || (ledger.months[key] = { billed: 0, attempts: 0 });
  month.attempts += 1;
  if (billed) month.billed += 1;
  ledger.updated = when.toISOString();
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
  return ledger;
}

export function formatUsd(calls) {
  return `~$${(calls * USD_PER_IMAGE).toFixed(2)}`;
}

/* `npm run pieces:spend` -- the readout half. Secondary to the cap by design. */
export function report(ledger = readLedger()) {
  const keys = Object.keys(ledger.months).sort();
  if (!keys.length) return `No Gemini generations recorded yet (ledger: ${LEDGER_PATH}).`;
  const lines = keys.map((key) => {
    const { billed, attempts } = ledger.months[key];
    const failed = attempts - billed;
    return `  ${key}  ${String(billed).padStart(4)} billed  ${formatUsd(billed).padStart(8)}` +
      (failed ? `   (${failed} unbilled failure${failed === 1 ? "" : "s"})` : "");
  });
  const total = keys.reduce((sum, key) => sum + ledger.months[key].billed, 0);
  return [
    `Gemini sprite generations (ledger: ${LEDGER_PATH})`,
    ...lines,
    `  ${"".padEnd(4)}  ${String(total).padStart(4)} total  ${formatUsd(total).padStart(8)}`,
    ``,
    `Caps: ${DEFAULT_RUN_CAP}/run, ${DEFAULT_MONTH_CAP}/month. This month (${monthKey()}): ` +
      `${billedThisMonth(ledger)}/${DEFAULT_MONTH_CAP}.`,
    `Dollar figures are ESTIMATES at $${USD_PER_IMAGE}/image -- see USD_PER_IMAGE in tools/gemini-budget.mjs.`,
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  console.log(report());
}
