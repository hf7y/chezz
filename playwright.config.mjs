import { defineConfig } from "@playwright/test";
import os from "node:os";

// Derived from core count, not a number typed once on one machine
// (2026-08-06): `/ 3` gives 2 on mandark (6 cores), 5 on dexter (16). At
// full concurrency, ai-determinism.spec.mjs races material-tuning.spec.mjs
// for CPU, so some floor above the naive per-core count is real -- but
// `max(2, ...)` pushed monkey's own derivation of 1 back up to 2: 2
// Chromium workers plus the agent's node process on monkey's 4-vCPU
// swapless VM, matching the soft lockups in hf7y/chezz#54. 1 worker can't
// race itself, so `max(1, ...)` still guards the concurrency bug while
// fixing monkey; 177/177 stayed green there. CHEZZ_TEST_WORKERS overrides
// this per host without editing tracked code.
const derivedWorkers = Math.max(1, Math.floor(os.availableParallelism() / 3));

export default defineConfig({
  testDir: "test",
  fullyParallel: true,
  workers: Number(process.env.CHEZZ_TEST_WORKERS) || derivedWorkers,
  reporter: [["list"]],
  use: {
    // The game is a single static file -- no server needed, just file://.
    headless: true,
  },
});
