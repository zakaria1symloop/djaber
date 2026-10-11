// Runs in every test worker before the test framework: applies the environment prepared by global-setup.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const env = JSON.parse(readFileSync(resolve(__dirname, '../../../../.local/test-env.json'), 'utf8'));
for (const [k, v] of Object.entries(env)) process.env[k] = v;
// never let a developer's real keys leak into tests
for (const k of ['META_APP_SECRET', 'CHARGILY_API_KEY', 'CHARGILY_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'RESEND_API_KEY']) {
  process.env[k] = '';
}
// M3: tests never see real Meta values; signature tests use these dummies and only the fake adapter may run
Object.assign(process.env, {
  META_DRIVER: 'fake',
  META_ALLOW_LIVE: 'false',
  META_APP_ID: '100000000000001',
  META_APP_SECRET: 'test-meta-app-secret',
  META_VERIFY_TOKEN: 'test-meta-verify-token',
  INSTAGRAM_APP_ID: '200000000000002',
  INSTAGRAM_APP_SECRET: 'test-instagram-app-secret',
  META_GRAPH_VERSION: 'v21.0',
});
