// Runs in every test worker before the test framework: applies the environment prepared by global-setup.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const env = JSON.parse(readFileSync(resolve(__dirname, '../../../../.local/test-env.json'), 'utf8'));
for (const [k, v] of Object.entries(env)) process.env[k] = v;
// never let a developer's real keys leak into tests
for (const k of ['META_APP_SECRET', 'CHARGILY_API_KEY', 'CHARGILY_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'RESEND_API_KEY']) {
  process.env[k] = '';
}
