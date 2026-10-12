// Environment of the eval runner. Default: exactly the integration-test environment (fake AI adapter, no provider key).
// EVAL_DRIVER=live is an explicit, manual choice: the real providers are called with the keys of the caller's shell
// (never a committed value) and AI_ALLOW_LIVE is switched on for this process only.
const KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY', 'GROQ_API_KEY'];
const given = Object.fromEntries(KEYS.map((k) => [k, process.env[k] ?? '']));
require('../setup/env.cjs');
if (process.env.EVAL_DRIVER === 'live') {
  Object.assign(process.env, given, { AI_DRIVER: 'live', AI_ALLOW_LIVE: 'true' });
  // eslint-disable-next-line no-console
  console.warn('[evals] EVAL_DRIVER=live: real AI providers will be called and billed.');
}
