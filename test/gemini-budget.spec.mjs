/* Covers the hard pre-call spend cap (tools/gemini-budget.mjs).
 *
 * The property that matters is NEGATIVE: the cap must refuse. Every test here
 * that asserts a throw is guarding real money on an experimental account, and
 * the specific failure mode worth fearing is failing OPEN -- a cap that reads
 * a missing/corrupt ledger as "zero spent" and waves everything through.
 *
 * Uses CHEZZ_CONFIG_DIR to redirect the ledger into a temp dir, so no test
 * ever reads or writes the real ~/.config/chezz.
 */
import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const TMP = mkdtempSync(path.join(os.tmpdir(), "chezz-budget-"));
process.env.CHEZZ_CONFIG_DIR = TMP;

const {
  assertBudget, readLedger, recordCall, billedThisMonth, monthKey, report, LEDGER_PATH,
} = await import("../tools/gemini-budget.mjs");

test.afterAll(() => rmSync(TMP, { recursive: true, force: true }));

test("a missing ledger reads as zero spend, not as an error", () => {
  rmSync(LEDGER_PATH, { force: true });
  expect(billedThisMonth(readLedger())).toBe(0);
});

test("a CORRUPT ledger refuses to run rather than failing open", () => {
  // The whole point of the cap. Garbage on disk must never be read as "no
  // spend yet" -- that would silently disable the guard exactly when the
  // ledger is in a state nobody understands.
  writeFileSync(LEDGER_PATH, "{ this is not json");
  expect(() => readLedger()).toThrow(/unreadable|refusing/i);
  // A well-formed JSON file that is not a ledger must fail the same way.
  writeFileSync(LEDGER_PATH, '{"totally":"wrong"}');
  expect(() => readLedger()).toThrow(/unreadable|refusing/i);
  rmSync(LEDGER_PATH, { force: true });
});

test("refuses a run larger than the per-run cap", () => {
  expect(() => assertBudget(19, { months: {} }, { runCap: 18, monthCap: 60 }))
    .toThrow(/per-run cap is 18/);
});

test("refuses once the month cap is reached, and names the override", () => {
  const key = monthKey();
  const ledger = { months: { [key]: { billed: 60, attempts: 60 } } };
  expect(() => assertBudget(1, ledger, { runCap: 18, monthCap: 60 }))
    .toThrow(/already this month/);
  expect(() => assertBudget(1, ledger, { runCap: 18, monthCap: 60 }))
    .toThrow(/CHEZZ_GEMINI_MONTH_CAP/);
});

test("refuses a run that would CROSS the month cap, not just one that starts over it", () => {
  // 55 spent, cap 60, asking for 18: the naive check ("are we over yet?")
  // passes and then overspends by 13. This is the arithmetic bug the cap
  // exists to not have.
  const key = monthKey();
  const ledger = { months: { [key]: { billed: 55, attempts: 55 } } };
  expect(() => assertBudget(18, ledger, { runCap: 18, monthCap: 60 }))
    .toThrow(/only 5 left/);
});

test("allows a run that exactly fits the remaining allowance", () => {
  const key = monthKey();
  const ledger = { months: { [key]: { billed: 55, attempts: 55 } } };
  expect(assertBudget(5, ledger, { runCap: 18, monthCap: 60 })).toBe(5);
});

test("a previous month's spend does not consume this month's allowance", () => {
  const ledger = { months: { "1999-01": { billed: 500, attempts: 500 }, [monthKey()]: { billed: 2, attempts: 2 } } };
  expect(assertBudget(10, ledger, { runCap: 18, monthCap: 60 })).toBe(58);
});

test("recordCall persists across processes -- a killed run still counted", () => {
  rmSync(LEDGER_PATH, { force: true });
  recordCall({ billed: true });
  recordCall({ billed: true });
  recordCall({ billed: false });
  // Re-read from disk, not from memory: the nightly clone is reset --hard, so
  // the ledger surviving on disk outside the repo IS the mechanism.
  const onDisk = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  expect(onDisk.months[monthKey()].billed).toBe(2);
  expect(onDisk.months[monthKey()].attempts).toBe(3);
});

test("unbilled failures are recorded but do not consume the cap", () => {
  // The 2026-07-28 run made 18 rejected calls. Those cost nothing, so they
  // must not eat the allowance -- but they must still be visible.
  rmSync(LEDGER_PATH, { force: true });
  for (let i = 0; i < 18; i++) recordCall({ billed: false });
  expect(billedThisMonth(readLedger())).toBe(0);
  expect(readLedger().months[monthKey()].attempts).toBe(18);
  expect(report()).toMatch(/18 unbilled failures/);
});

test("the report labels dollar figures as estimates", () => {
  // Calls are exact; dollars are arithmetic on a constant nobody has verified
  // against an invoice. The report must not imply otherwise.
  rmSync(LEDGER_PATH, { force: true });
  recordCall({ billed: true });
  expect(report()).toMatch(/ESTIMATES/);
});
