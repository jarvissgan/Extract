import { defineConfig, devices } from "@playwright/test";

// Browser tests. `npm run test:e2e` starts the app with `npm run local` (offline login +
// local database) unless it's already running.
// First time only: `npx playwright install chromium`.
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // optional: use an already-installed Chromium instead of Playwright's download
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    // phone-sized with touch; see CLAUDE.md for the mobile rules these tests guard
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run local",
    // the API answers 401 without a token, which Playwright counts as "up"
    url: "http://localhost:3000/authorized",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
