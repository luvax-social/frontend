import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end project, covering the anonymous support paths only.
 *
 * Those four addresses sit outside `ProtectedRoute` because the population they
 * exist for - a banned or suspended account, or somebody with no account at all
 * - is refused a session by design. Nothing in this project signs in, and that
 * is the point rather than a limitation.
 *
 * The backend is stubbed at the network boundary rather than run. The two
 * behaviours these specs pin are client-side - a spent captcha token being
 * re-armed, and one answer being rendered identically for every dead link - and
 * both depend on what the server returns rather than on the server running. A
 * suite that needed a seeded database and a live appeal token could not run in
 * continuous integration, which is where the regression these cover would
 * otherwise reach. The repository already separates a no-backend Vitest project
 * from a live one for the same reason.
 *
 * Turnstile renders for real, against Cloudflare's always-pass test key.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The always-pass test key, so the challenge never blocks the run. The
    // widget still loads and still has to hand a token upward for the submit
    // control to enable, which is the part these specs depend on.
    env: { VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' },
  },
});
