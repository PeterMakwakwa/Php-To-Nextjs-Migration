import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (Playwright, headless Chromium) against the real, running apps — like the e2e suite,
 * they need Next.js (APP_URL, default :3000) and legacy PHP (:8000) started first.
 *
 * They cover what plain HTTP checks cannot: client-side navigation, full-page hand-offs to legacy,
 * and browser history across the two systems.
 */
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
