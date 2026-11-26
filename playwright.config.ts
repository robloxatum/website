import { defineConfig, devices } from "@playwright/test";
import { e2eEnabled } from "./src/lib/e2e";

// Run with `npm run test:e2e` (scripts/e2e.mjs), which starts and resets the
// LOCAL Supabase and sets these. Refuse anything else.
if (!e2eEnabled() || !process.env.E2E_SERVICE_ROLE_KEY) {
  throw new Error("Run the end-to-end tests with `npm run test:e2e` (local Supabase only).");
}

const BASE_URL = "http://localhost:3200";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  // One worker: the tests share one database (announcements, site content and
  // roles are site-wide), so they run in order.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "America/Detroit",
    locale: "en-US",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "phone",
      // Chromium with an iPhone-sized screen (390px), touch and a mobile user agent.
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
    },
  ],
  webServer: [
    { command: "node e2e/mock-roblox.mjs", url: "http://127.0.0.1:3299/health", reuseExistingServer: false },
    { command: "node e2e/mock-push.mjs", url: "http://127.0.0.1:3298/health", reuseExistingServer: false },
    { command: "npx next start -p 3200", url: BASE_URL, reuseExistingServer: false, timeout: 120_000, stdout: "pipe" },
  ],
});
