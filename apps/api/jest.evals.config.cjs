/**
 * AI evals (04-ai-pipeline §15): `pnpm test:evals` → `test/ai-evals/evals.eval.ts` replays the fixture conversations.
 * Same infrastructure as the integration tests (embedded Postgres + Redis, no Docker). EVAL_DRIVER=fake (default) | live.
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/ai-evals/**/*.eval.ts'],
  transform: { '^.+\.ts$': ['@swc/jest'] },
  moduleNameMapper: { '^@api/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/test/setup/global-setup.cjs',
  globalTeardown: '<rootDir>/test/setup/global-teardown.cjs',
  setupFiles: ['<rootDir>/test/ai-evals/env.cjs'],
  testTimeout: process.env.EVAL_DRIVER === 'live' ? 180000 : 60000,
};
