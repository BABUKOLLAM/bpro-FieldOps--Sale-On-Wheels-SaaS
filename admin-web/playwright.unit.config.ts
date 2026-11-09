import { defineConfig } from "@playwright/test";

/** Pure unit tests (no browser, no servers) — `npm test`. Kept separate
 * from playwright.config.ts, whose e2e suite boots Django + Next. */
export default defineConfig({
  testDir: "./unit",
  fullyParallel: true,
  reporter: "list",
});
