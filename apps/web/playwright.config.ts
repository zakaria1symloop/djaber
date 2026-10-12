import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const root = resolve(__dirname, '../..');
// The env files may point at a LAN address (the team serving); e2e always runs on localhost. Real env vars win over
// `.env` / `.env.local` in the API loader and in Next.js, so these overrides stay here and never touch the env files.
const LOCAL_API = 'http://localhost:4010';
const LOCAL_WEB = 'http://localhost:3010';
const serverEnv = { PUBLIC_API_URL: LOCAL_API, PUBLIC_WEB_URL: LOCAL_WEB };

// E2E runs against this repo's own servers (`pnpm infra:up` must be running; fake adapters only).
// Servers already listening are reused; otherwise they are started here (the web app as a production build).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // one worker: the specs share one dev server (routes compile on first hit) and the API rate limits per IP
  workers: 1,
  globalSetup: './e2e/support/global-setup.ts',
  use: { baseURL: 'http://localhost:3010', trace: 'retain-on-failure', locale: 'fr-DZ', timezoneId: 'Africa/Algiers' },
  webServer: [
    {
      command: 'pnpm --filter @djaber/api build && node apps/api/dist/main.js',
      cwd: root,
      url: 'http://localhost:4010/health',
      reuseExistingServer: true,
      timeout: 180_000,
      env: serverEnv,
    },
    { command: 'node apps/worker/main.js', cwd: root, url: 'http://localhost:4011', reuseExistingServer: true, timeout: 180_000, env: serverEnv },
    // the production build: `next dev` compiles each route on its first hit, which made first navigations take seconds
    // (empty <main>, missing <title>) and tests fail only in a cold full run. A server already on :3010 is reused.
    { command: 'pnpm build && pnpm start', url: 'http://localhost:3010/fr/login', reuseExistingServer: true, timeout: 420_000, env: { NEXT_PUBLIC_DEV_GALLERY: '1', NEXT_PUBLIC_API_URL: LOCAL_API } },
  ],
});
