import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  fullyParallel: true,
  // Capped at 2 (default is CPU-count-based, 6 on this machine): at full
  // concurrency, ai-determinism.spec.mjs races material-tuning.spec.mjs
  // for CPU and the AI's wall-clock search deadline lands at a different
  // depth on its second of two same-position calls, reliably failing a
  // test that isn't actually testing anything about concurrency. Doesn't
  // meaningfully slow the suite down -- material-tuning's own ~2.5min
  // runtime is the wall-clock floor either way, not worker count.
  workers: 2,
  reporter: [["list"]],
  use: {
    // The game is a single static file -- no server needed, just file://.
    headless: true,
  },
});
