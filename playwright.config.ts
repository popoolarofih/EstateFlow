import { defineConfig, devices } from "@playwright/test";

/**
 * End to end tests run against a production build backed by the Firebase emulators:
 *   npm run build && npm run test:e2e
 * `test:e2e` starts the emulators, seeds two estates and then runs Playwright.
 */
// Optional: use a preinstalled Chromium instead of `npx playwright install` browsers.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000", trace: "off", launchOptions: { executablePath } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /landing\.spec\.ts/ },
  ],
  webServer: {
    command: "npx next start -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
