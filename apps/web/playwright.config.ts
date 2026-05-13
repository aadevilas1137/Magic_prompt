import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const isCI = Boolean(process.env.CI);

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Local: 1 retry to absorb Next dev's cold-compile-per-route race
  // (the first chromium hit on a route occasionally exceeds expect timeouts).
  // CI: 2 retries for general flake tolerance.
  retries: isCI ? 2 : 1,
  // Per-test timeout — bumped from the 30s default because Next.js dev's
  // first-hit-per-route compile can take 30–60s in cold cache. Subsequent
  // hits are sub-second.
  timeout: 90 * 1000,
  // Phase 3 bump 10s → 60s. With more modules in the dev tree (Phase 3 added
  // the chat surface + AI SDK + react-markdown + syntax-highlighter + ~30
  // components), chromium's first-hit-per-route compile occasionally exceeds
  // 30s before the form is rendered — particularly /signup which loads zxcvbn-ts
  // language bundles. Mobile-safari runs second on already-warm routes so
  // doesn't need this headroom.
  expect: { timeout: 60 * 1000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 60 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
};

if (isCI) {
  config.workers = 1;
} else {
  config.webServer = {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: true,
    // Cold compile of the [locale] route tree on this machine can exceed
    // the 120s Playwright default. Bumped to 180s after Phase 2.5 added
    // the analytics module + tracked-event paths through the actions.
    timeout: 180 * 1000,
  };
}

export default defineConfig(config);
