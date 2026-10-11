import { defineConfig } from '@playwright/test';

// E2E runs against the dev servers of this repo (`pnpm infra:up` must be running; fake adapters only).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // one worker: the specs share one dev server (routes compile on first hit) and the API rate limits per IP
  workers: 1,
  use: { baseURL: 'http://localhost:3010', trace: 'retain-on-failure', locale: 'fr-DZ', timezoneId: 'Africa/Algiers' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3010/fr/dev/states',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
