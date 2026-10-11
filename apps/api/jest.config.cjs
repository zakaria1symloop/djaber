/** Unit tests: `*.spec.ts` next to the source (no database). */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  moduleNameMapper: { '^@api/(.*)$': '<rootDir>/src/$1' },
  passWithNoTests: true,
};
