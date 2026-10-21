import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end project that drives the real application against the real backend.
 *
 * Nothing is stubbed and no web server is started: the Vite dev server on 5173 and the
 * backend on 8080 must already be running with the seeded database (see
 * `backend/src/main/resources/seed/README.md`). The specs sign in as seeded accounts, so
 * the stubbed project in `playwright.config.ts` stays the one continuous integration runs.
 *
 * One worker, because every spec changes the state of shared seeded accounts and a
 * parallel run would let two specs mute, limit or filter the same account at once.
 */
export default defineConfig({
  testDir: './tests/e2e-live',
  outputDir: './test-results/e2e-live',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
