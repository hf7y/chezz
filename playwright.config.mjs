import { defineConfig } from "@playwright/test";
import os from "node:os";

// Derived from core count rather than a number typed once on one machine
// (2026-08-06, scheduler -i 2026-07-28: the old `workers: 2` said "default
// is CPU-count-based, 6 on this machine" -- true on mandark where it was
// tuned, already false by the time chezz ran on monkey (4 cores), and
// wrong again on dexter (16). Nothing failed; the comment just stopped
// describing anything real, on every host after the one it was written on.
// The cap itself is still needed: at full concurrency, ai-determinism.spec.mjs
// races material-tuning.spec.mjs for CPU and the AI's wall-clock search
// deadline lands at a different depth on its second of two same-position
// calls, reliably failing a test that isn't testing anything about
// concurrency. `/ 3` reproduces the verified-safe 2 on both mandark (6) and
// monkey (4, floored up by the minimum below); CHEZZ_TEST_WORKERS overrides
// it for a host that needs a different number without editing tracked code.
const derivedWorkers = Math.max(2, Math.floor(os.availableParallelism() / 3));

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
