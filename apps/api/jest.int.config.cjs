/** Integration tests: `test/**\/*.int.spec.ts` against embedded Postgres + redis-memory-server (no Docker). */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.int.spec.ts'],
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  moduleNameMapper: { '^@api/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/test/setup/global-setup.cjs',
  globalTeardown: '<rootDir>/test/setup/global-teardown.cjs',
  setupFiles: ['<rootDir>/test/setup/env.cjs'],
  testTimeout: 60000,
  passWithNoTests: true,
};
