// Flat ESLint config shared by every package (run per package: `eslint src`).
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/storybook-static/**', '**/*.cjs', '**/next-env.d.ts', '**/generated.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off', // Express req/res and provider payloads are typed at the boundary with zod
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // CLAUDE.md rule 9: configuration is read through ConfigService only
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/core/config/**', 'apps/api/src/core/logging/**', 'apps/api/src/worker/bootstrap.ts'],
    rules: {
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Read configuration through ConfigService.' }],
    },
  },
  {
    // RTL: only logical properties (02-next-route-map §RTL rules)
    files: ['apps/web/src/**/*.tsx', 'packages/ui/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(^|\\s)(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-[^\\s]+/]',
          message: 'Use logical utilities (ms-, me-, ps-, pe-, start-, end-, text-start, text-end, border-s, border-e).',
        },
      ],
    },
  },
  {
    files: ['tools/**', '**/seeds/**', '**/test/**', '**/*.spec.ts', '**/*.config.*', 'apps/worker/**'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off', 'no-restricted-properties': 'off' },
  },
);
