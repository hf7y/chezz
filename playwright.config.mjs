import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    // The game is a single static file -- no server needed, just file://.
    headless: true,
  },
});
