import { defineConfig } from '@playwright/test'

// End-to-end smoke tests against the real UI with an in-memory Firebase fake (see e2e/fakes).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173/financeflow/',
    // Uses a locally installed Chrome; set PW_CHROME_PATH to override, or run `npx playwright install chromium`.
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
    timezoneId: 'Asia/Colombo',
    acceptDownloads: true,
  },
  webServer: {
    command: 'npx vite --config vite.e2e.config.ts',
    url: 'http://localhost:4173/financeflow/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
