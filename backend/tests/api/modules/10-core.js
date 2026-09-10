/**
 * Group "core": health/root, 404, malformed JSON, auth guard, auth endpoints,
 * devices, pages (+ OAuth connect/callback validation branches), Meta webhook
 * verification + data-deletion validation, plans, credits, cms, payments.
 */
const ARABIC_RE = /[؀-ۿ]/;

/** Custom assertion for the OAuth callbacks: they answer 200 HTML carrying a JSON payload. */
async function htmlPayload(t, name, opts, expected) {
  const label = `${t.currentModule} › ${name}`;
  const issues = [];
  let r;
  try {
    r = await t.raw(opts);
  } catch (err) {
    t.results.push({ label, ok: false, issues: [`request failed: ${err.message}`], opts });
    return;
  }
  if (r.status !== 200) issues.push(`status ${r.status} ≠ 200`);
  const m = r.text.match(/var payload = (\{[\s\S]*?\});/);
  if (!m) {
    issues.push(`no OAuth payload found in HTML: ${r.text.slice(0, 160)}`);
  } else {
    let payload = null;
    try { payload = JSON.parse(m[1]); } catch (e) { issues.push(`payload is not JSON: ${m[1].slice(0, 120)}`); }
    if (payload) {
      if (expected.type && payload.type !== expected.type) issues.push(`payload.type ${payload.type} ≠ ${expected.type}`);
      if (expected.code && payload.code !== expected.code) issues.push(`payload.code ${payload.code} ≠ ${expected.code}`);
      if (!payload.error) issues.push('payload has no human `error` message');
      if (typeof payload.error === 'string' && /^[A-Z0-9_]+$/.test(payload.error)) issues.push(`payload.error is a raw code: ${payload.error}`);
      if (expected.ar && typeof payload.error === 'string' && !ARABIC_RE.test(payload.error)) issues.push(`payload.error not translated to ar: ${payload.error.slice(0, 100)}`);
    }
  }
  if (/<script>[^<]*<\/script>/.test('') === false && /"><script>/.test(r.text)) issues.push('unescaped injection in HTML');
  t.results.push({ label, ok: issues.length === 0, issues, status: r.status, opts });
}

module.exports = async (t) => {
  const stamp = Date.now();
  const MISSING = t.ctx.missingId;

  // =========================================================================
  // 1. Transport: health, /api, unknown routes, malformed JSON
  // =========================================================================
  await t.ok('health', { path: '/health' });
  await t.ok('api root', { path: '/api' });

  await t.check('unknown route → 404 ROUTE_NOT_FOUND', {
    path: '/api/definitely-not-a-route',
    expect: { status: 404, code: 'ROUTE_NOT_FOUND', noFields: true },
  });
  await t.check('unknown route (ar)', {
    path: '/api/definitely-not-a-route', lang: 'ar',
    expect: { status: 404, code: 'ROUTE_NOT_FOUND' },
  });
  await t.check('unknown route under an existing prefix', {
    method: 'POST', path: '/api/auth/nope', body: {},
    expect: { status: 404, code: 'ROUTE_NOT_FOUND' },
  });
  await t.check('unknown method on a known path', {
    method: 'PUT', path: '/api/auth/login', body: {},
    expect: { status: 404, code: 'ROUTE_NOT_FOUND' },
  });

  await t.check('malformed JSON body → INVALID_JSON', {
    method: 'POST', path: '/api/auth/login', body: '{"email": ',
    expect: { status: 400, code: 'INVALID_JSON' },
  });
  await t.check('malformed JSON body (ar)', {
    method: 'POST', path: '/api/auth/login', body: '{oops}', lang: 'ar',
    expect: { status: 400, code: 'INVALID_JSON' },
  });
  await t.check('JSON body that is a bare string', {
    method: 'POST', path: '/api/auth/login', body: '"hello"',
    expect: { status: 400 },
  });

  // =========================================================================
  // 2. Auth guard (on GET /api/auth/profile)
  // =========================================================================
  await t.check('profile — no Authorization header', {
    path: '/api/auth/profile',
    expect: { status: 401, code: 'UNAUTHORIZED', noFields: true },
  });
  await t.check('profile — no auth (ar)', {
    path: '/api/auth/profile', lang: 'ar',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('profile — wrong scheme (Basic)', {
    path: '/api/auth/profile', headers: { Authorization: 'Basic abcdef' },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('profile — token without a scheme', {
    path: '/api/auth/profile', headers: { Authorization: t.tokens.user },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('profile — empty Bearer', {
    path: '/api/auth/profile', headers: { Authorization: 'Bearer ' },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('profile — garbage token', {
    path: '/api/auth/profile', token: 'not-a-jwt',
    expect: { status: 401, code: 'INVALID_TOKEN', noFields: true },
  });
  await t.check('profile — well-formed but unsigned-by-us token', {
    path: '/api/auth/profile',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ4IiwiZW1haWwiOiJhQGIuYyIsImV4cCI6MTUxNjIzOTAyMn0.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.check('profile — invalid token (ar)', {
    path: '/api/auth/profile', token: 'not-a-jwt', lang: 'ar',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.ok('profile — happy path', { path: '/api/auth/profile', auth: true });

  // Language precedence: ?lang beats X-Lang beats Accept-Language.
  await t.check('lang precedence — ?lang=ar beats Accept-Language: fr', {
    path: '/api/auth/profile?lang=ar', lang: 'fr',
    expect: { status: 401, code: 'UNAUTHORIZED' },
    // harness only checks Arabic when opts.lang is ar → assert manually below
  }).then(async (r) => {
    const ok = r && ARABIC_RE.test(r.json?.message || '');
    t.results.push({
      label: `${t.currentModule} › ?lang=ar really wins over Accept-Language: fr`,
      ok: !!ok, issues: ok ? [] : [`message not Arabic: ${r?.json?.message}`], status: r?.status,
    });
  });
  await t.check('lang precedence — X-Lang: ar beats Accept-Language: fr', {
    path: '/api/auth/profile', lang: 'fr', headers: { 'X-Lang': 'ar' },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  }).then((r) => {
    const ok = r && ARABIC_RE.test(r.json?.message || '');
    t.results.push({
      label: `${t.currentModule} › X-Lang: ar really wins over Accept-Language: fr`,
      ok: !!ok, issues: ok ? [] : [`message not Arabic: ${r?.json?.message}`], status: r?.status,
    });
  });
  await t.check('lang — Accept-Language: fr is honoured', {
    path: '/api/auth/profile', lang: 'fr',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  }).then((r) => {
    const msg = r?.json?.message || '';
    const ok = /connecté/i.test(msg);
    t.results.push({
      label: `${t.currentModule} › Accept-Language: fr returns French`,
      ok, issues: ok ? [] : [`message not French: ${msg}`], status: r?.status,
    });
  });
  await t.check('lang — unknown language falls back to en', {
    path: '/api/auth/profile?lang=zz',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  }).then((r) => {
    const ok = /signed in/i.test(r?.json?.message || '');
    t.results.push({
      label: `${t.currentModule} › unknown ?lang falls back to English`,
      ok, issues: ok ? [] : [`message not English: ${r?.json?.message}`], status: r?.status,
    });
  });

  // =========================================================================
  // 3. POST /api/auth/register
  // =========================================================================
  const goodReg = (over = {}) => ({
    email: `core_${stamp}_${Math.random().toString(36).slice(2, 8)}@djaber.test`,
    password: 'Password123!', firstName: 'Core', lastName: 'Tester', ...over,
  });

  await t.check('register — empty body', {
    method: 'POST', path: '/api/auth/register', body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL', minFields: 4 },
  });
  await t.check('register — email missing', {
    method: 'POST', path: '/api/auth/register', body: { password: 'Password123!', firstName: 'A', lastName: 'B' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL' },
  });
  await t.check('register — email malformed', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ email: 'not-an-email' }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL' },
  });
  await t.check('register — email wrong type (number)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ email: 12345 }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email' },
  });
  await t.check('register — email wrong type (object)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ email: { a: 1 } }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email' },
  });
  await t.check('register — password missing', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ password: undefined }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'AUTH_PASSWORD_TOO_SHORT' },
  });
  await t.check('register — password too short', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ password: 'short' }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'AUTH_PASSWORD_TOO_SHORT' },
  });
  await t.check('register — password too short (ar)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ password: 'short' }), lang: 'ar',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'AUTH_PASSWORD_TOO_SHORT' },
  });
  await t.check('register — password too short (fr)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ password: 'short' }), lang: 'fr',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password' },
  });
  await t.check('register — password wrong type (object) must NOT create an account', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ password: { x: 'yyyyyyyyyy' } }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('register — firstName wrong type (object)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ firstName: { x: 1 } }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'firstName' },
  });
  await t.check('register — password too long (>128)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ password: 'P'.repeat(200) }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('register — firstName empty', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ firstName: '   ' }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'firstName', fieldCode: 'AUTH_FIRST_NAME_REQUIRED' },
  });
  await t.check('register — lastName missing', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ lastName: undefined }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'lastName', fieldCode: 'AUTH_LAST_NAME_REQUIRED' },
  });
  await t.check('register — firstName too long (>80)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ firstName: 'x'.repeat(200) }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'firstName', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('register — lastName too long (>80)', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ lastName: 'y'.repeat(200) }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'lastName', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('register — plan invalid enum', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ plan: 'enterprise' }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'plan', fieldCode: 'AUTH_INVALID_PLAN' },
  });
  await t.check('register — plan wrong type', {
    method: 'POST', path: '/api/auth/register', body: goodReg({ plan: 7 }),
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'plan' },
  });
  await t.check('register — duplicate e-mail → 409', {
    method: 'POST', path: '/api/auth/register',
    body: { email: t.ctx.email, password: 'Password123!', firstName: 'Dup', lastName: 'Licate' },
    expect: { status: 409, code: 'AUTH_EMAIL_TAKEN', noFields: true },
  });
  await t.check('register — duplicate e-mail (ar)', {
    method: 'POST', path: '/api/auth/register', lang: 'ar',
    body: { email: t.ctx.email, password: 'Password123!', firstName: 'Dup', lastName: 'Licate' },
    expect: { status: 409, code: 'AUTH_EMAIL_TAKEN' },
  });
  await t.check('register — duplicate e-mail with different case', {
    method: 'POST', path: '/api/auth/register',
    body: { email: String(t.ctx.email).toUpperCase(), password: 'Password123!', firstName: 'Dup', lastName: 'Licate' },
    expect: { status: 409, code: 'AUTH_EMAIL_TAKEN' },
  });
  const newUser = goodReg();
  await t.ok('register — happy path', {
    method: 'POST', path: '/api/auth/register', body: newUser, expect: { status: 201 },
  });

  // =========================================================================
  // 4. POST /api/auth/login
  // =========================================================================
  await t.check('login — empty body', {
    method: 'POST', path: '/api/auth/login', body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', minFields: 2 },
  });
  await t.check('login — email malformed', {
    method: 'POST', path: '/api/auth/login', body: { email: 'nope', password: 'Password123!' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL' },
  });
  await t.check('login — password missing', {
    method: 'POST', path: '/api/auth/login', body: { email: t.ctx.email },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'AUTH_PASSWORD_REQUIRED' },
  });
  await t.check('login — password wrong type (object)', {
    method: 'POST', path: '/api/auth/login', body: { email: t.ctx.email, password: { a: 1 } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('login — password wrong type (array)', {
    method: 'POST', path: '/api/auth/login', body: { email: t.ctx.email, password: ['a', 'b'] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password' },
  });
  await t.check('login — unknown e-mail → 401', {
    method: 'POST', path: '/api/auth/login', body: { email: `nobody_${stamp}@djaber.test`, password: 'Password123!' },
    expect: { status: 401, code: 'AUTH_INVALID_CREDENTIALS', noFields: true },
  });
  await t.check('login — wrong password → 401', {
    method: 'POST', path: '/api/auth/login', body: { email: t.ctx.email, password: 'WrongPassword1!' },
    expect: { status: 401, code: 'AUTH_INVALID_CREDENTIALS' },
  });
  await t.check('login — wrong password (ar)', {
    method: 'POST', path: '/api/auth/login', lang: 'ar', body: { email: t.ctx.email, password: 'WrongPassword1!' },
    expect: { status: 401, code: 'AUTH_INVALID_CREDENTIALS' },
  });
  await t.check('login — wrong password (fr)', {
    method: 'POST', path: '/api/auth/login', lang: 'fr', body: { email: t.ctx.email, password: 'WrongPassword1!' },
    expect: { status: 401, code: 'AUTH_INVALID_CREDENTIALS' },
  });
  await t.ok('login — happy path', {
    method: 'POST', path: '/api/auth/login', body: { email: t.ctx.email, password: t.ctx.password },
  });

  // =========================================================================
  // 5. Devices
  // =========================================================================
  const pushToken = `ExponentPushToken[core-${stamp}]`;

  await t.check('devices/register — no auth', {
    method: 'POST', path: '/api/devices/register', body: { token: pushToken },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('devices/register — invalid token header', {
    method: 'POST', path: '/api/devices/register', token: 'xxx', body: { token: pushToken },
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.check('devices/register — token missing', {
    method: 'POST', path: '/api/devices/register', auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'token', fieldCode: 'DEVICE_TOKEN_REQUIRED' },
  });
  await t.check('devices/register — token missing (ar)', {
    method: 'POST', path: '/api/devices/register', auth: true, body: {}, lang: 'ar',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'token', fieldCode: 'DEVICE_TOKEN_REQUIRED' },
  });
  await t.check('devices/register — token wrong type', {
    method: 'POST', path: '/api/devices/register', auth: true, body: { token: 42 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'token', fieldCode: 'DEVICE_TOKEN_REQUIRED' },
  });
  await t.check('devices/register — token not an Expo token', {
    method: 'POST', path: '/api/devices/register', auth: true, body: { token: 'junk-token' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'token', fieldCode: 'DEVICE_TOKEN_INVALID' },
  });
  await t.check('devices/register — token too long', {
    method: 'POST', path: '/api/devices/register', auth: true, body: { token: `ExponentPushToken[${'z'.repeat(300)}]` },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'token', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('devices/register — platform invalid enum', {
    method: 'POST', path: '/api/devices/register', auth: true, body: { token: pushToken, platform: 'windows' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'platform', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('devices/register — platform invalid enum (fr)', {
    method: 'POST', path: '/api/devices/register', auth: true, lang: 'fr', body: { token: pushToken, platform: 'windows' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'platform', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.ok('devices/register — happy path', {
    method: 'POST', path: '/api/devices/register', auth: true, body: { token: pushToken, platform: 'ios' },
  });
  await t.ok('devices/register — idempotent re-register', {
    method: 'POST', path: '/api/devices/register', auth: true, body: { token: pushToken, platform: 'android' },
  });

  await t.check('devices/unregister — no auth', {
    method: 'POST', path: '/api/devices/unregister', body: { token: pushToken },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('devices/unregister — token missing', {
    method: 'POST', path: '/api/devices/unregister', auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'token', fieldCode: 'DEVICE_TOKEN_REQUIRED' },
  });
  await t.ok('devices/unregister — happy path', {
    method: 'POST', path: '/api/devices/unregister', auth: true, body: { token: pushToken },
  });
  await t.ok('devices/unregister — unknown token is a no-op 200', {
    method: 'POST', path: '/api/devices/unregister', auth: true, body: { token: 'ExponentPushToken[never-existed]' },
  });

  // =========================================================================
  // 6. Pages
  // =========================================================================
  await t.check('pages list — no auth', {
    path: '/api/pages',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('pages list — bad token', {
    path: '/api/pages', token: 'nope.nope.nope',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.ok('pages list — happy path', { path: '/api/pages', auth: true });

  await t.check('pages connect/facebook — no auth', {
    path: '/api/pages/connect/facebook',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('pages connect/instagram — no auth', {
    path: '/api/pages/connect/instagram',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('pages connect/instagram — no auth (ar)', {
    path: '/api/pages/connect/instagram', lang: 'ar',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.ok('pages connect/facebook — returns an authUrl (no external call)', {
    path: '/api/pages/connect/facebook', auth: true,
  });
  await t.ok('pages connect/instagram — returns an authUrl (no external call)', {
    path: '/api/pages/connect/instagram', auth: true,
  });

  await t.check('pages delete — no auth', {
    method: 'DELETE', path: `/api/pages/${MISSING}`,
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('pages delete — unknown id → 404', {
    method: 'DELETE', path: `/api/pages/${MISSING}`, auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND', noFields: true },
  });
  await t.check('pages delete — unknown id (ar)', {
    method: 'DELETE', path: `/api/pages/${MISSING}`, auth: true, lang: 'ar',
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('pages delete — malformed id (judgement call: 404 not 400)', {
    method: 'DELETE', path: '/api/pages/not-a-valid-id-@@@', auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('pages delete — very long id', {
    method: 'DELETE', path: `/api/pages/${'a'.repeat(300)}`, auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });

  // OAuth callbacks — validation branches only (never a real code → no Meta traffic).
  await htmlPayload(t, 'callback/facebook — no code', {
    path: '/api/pages/callback/facebook',
  }, { type: 'facebook-oauth-error', code: 'PAGE_OAUTH_CODE_MISSING' });
  await htmlPayload(t, 'callback/facebook — no code (ar)', {
    path: '/api/pages/callback/facebook?lang=ar',
  }, { type: 'facebook-oauth-error', code: 'PAGE_OAUTH_CODE_MISSING', ar: true });
  await htmlPayload(t, 'callback/facebook — user cancelled', {
    path: '/api/pages/callback/facebook?error=access_denied',
  }, { type: 'facebook-oauth-error', code: 'PAGE_OAUTH_CANCELLED' });
  await htmlPayload(t, 'callback/facebook — bad state (unknown user)', {
    path: `/api/pages/callback/facebook?code=fake-code&state=${MISSING}`,
  }, { type: 'facebook-oauth-error', code: 'PAGE_OAUTH_STATE_INVALID' });
  await htmlPayload(t, 'callback/facebook — malformed state', {
    path: '/api/pages/callback/facebook?code=fake-code&state=%3Cscript%3E',
  }, { type: 'facebook-oauth-error', code: 'PAGE_OAUTH_STATE_INVALID' });
  await htmlPayload(t, 'callback/facebook — missing state entirely', {
    path: '/api/pages/callback/facebook?code=fake-code',
  }, { type: 'facebook-oauth-error', code: 'PAGE_OAUTH_STATE_INVALID' });
  await htmlPayload(t, 'callback/instagram — no code', {
    path: '/api/pages/callback/instagram',
  }, { type: 'instagram-oauth-error', code: 'PAGE_OAUTH_CODE_MISSING' });
  await htmlPayload(t, 'callback/instagram — no code (ar)', {
    path: '/api/pages/callback/instagram?lang=ar',
  }, { type: 'instagram-oauth-error', code: 'PAGE_OAUTH_CODE_MISSING', ar: true });
  await htmlPayload(t, 'callback/instagram — user cancelled', {
    path: '/api/pages/callback/instagram?error=access_denied',
  }, { type: 'instagram-oauth-error', code: 'PAGE_OAUTH_CANCELLED' });
  await htmlPayload(t, 'callback/instagram — bad state', {
    path: `/api/pages/callback/instagram?code=fake-code&state=${MISSING}`,
  }, { type: 'instagram-oauth-error', code: 'PAGE_OAUTH_STATE_INVALID' });

  // =========================================================================
  // 7. Meta webhooks — verification + data-deletion validation only
  // =========================================================================
  await t.check('webhook verify — no params', {
    path: '/api/webhooks/meta',
    expect: { status: 403, code: 'WEBHOOK_VERIFICATION_FAILED', noFields: true },
  });
  await t.check('webhook verify — wrong verify token', {
    path: '/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234',
    expect: { status: 403, code: 'WEBHOOK_VERIFICATION_FAILED' },
  });
  await t.check('webhook verify — wrong mode', {
    path: '/api/webhooks/meta?hub.mode=unsubscribe&hub.verify_token=wrong&hub.challenge=1234',
    expect: { status: 403, code: 'WEBHOOK_VERIFICATION_FAILED' },
  });
  await t.check('webhook verify — wrong token (ar)', {
    path: '/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234&lang=ar',
    expect: { status: 403, code: 'WEBHOOK_VERIFICATION_FAILED' },
  });
  await t.check('webhook verify — array params do not crash', {
    path: '/api/webhooks/meta?hub.mode=subscribe&hub.mode=subscribe&hub.verify_token=a&hub.verify_token=b',
    expect: { status: 403, code: 'WEBHOOK_VERIFICATION_FAILED' },
  });

  await t.ok('webhook events — empty body is acknowledged (200)', {
    method: 'POST', path: '/api/webhooks/meta', body: {},
  });
  await t.ok('webhook events — unknown object is acknowledged (200)', {
    method: 'POST', path: '/api/webhooks/meta', body: { object: 'whatever', entry: [] },
  });
  await t.ok('webhook events — object=page with no entry does not 500', {
    method: 'POST', path: '/api/webhooks/meta', body: { object: 'page' },
  });
  await t.ok('webhook events — entry of the wrong type does not 500', {
    method: 'POST', path: '/api/webhooks/meta', body: { object: 'page', entry: 'oops' },
  });

  await t.check('data-deletion — signed_request missing', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', body: {},
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_REQUIRED' },
  });
  await t.check('data-deletion — signed_request empty', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', body: { signed_request: '   ' },
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_REQUIRED' },
  });
  await t.check('data-deletion — signed_request wrong type', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', body: { signed_request: 42 },
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_REQUIRED' },
  });
  await t.check('data-deletion — signed_request missing (ar)', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', body: {}, lang: 'ar',
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_REQUIRED' },
  });
  await t.check('data-deletion — signed_request with a bad signature', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', body: { signed_request: 'YWJj.eyJ1c2VyX2lkIjoiMTIzIn0' },
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_INVALID' },
  });
  await t.check('data-deletion — signed_request without a dot', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', body: { signed_request: 'nodothere' },
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_INVALID' },
  });
  await t.check('data-deletion — signed_request bad signature (fr)', {
    method: 'POST', path: '/api/webhooks/meta/data-deletion', lang: 'fr', body: { signed_request: 'YWJj.eyJ1c2VyX2lkIjoiMTIzIn0' },
    expect: { status: 400, code: 'WEBHOOK_SIGNED_REQUEST_INVALID' },
  });
  await t.ok('data-deletion status page', { path: '/api/webhooks/meta/data-deletion/status?code=abc123' });

  // =========================================================================
  // 8. Plans / credits / cms
  // =========================================================================
  await t.ok('plans — public list', { path: '/api/plans' });
  await t.check('credits — no auth', {
    path: '/api/credits',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('credits — bad token', {
    path: '/api/credits', token: 'abc.def.ghi',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.ok('credits — happy path', { path: '/api/credits', auth: true });

  await t.check('cms — unknown slug → 404', {
    path: `/api/cms/does-not-exist-${stamp}`,
    expect: { status: 404, code: 'CMS_PAGE_NOT_FOUND', noFields: true },
  });
  await t.check('cms — unknown slug (ar)', {
    path: `/api/cms/does-not-exist-${stamp}?lang=ar`,
    expect: { status: 404, code: 'CMS_PAGE_NOT_FOUND' },
  });
  await t.check('cms — unknown slug (fr)', {
    path: `/api/cms/does-not-exist-${stamp}`, lang: 'fr',
    expect: { status: 404, code: 'CMS_PAGE_NOT_FOUND' },
  });

  // =========================================================================
  // 9. Payments — validation branches only (no valid plan → no Chargily call)
  // =========================================================================
  await t.check('payments/checkout — no auth', {
    method: 'POST', path: '/api/payments/checkout', body: { planSlug: 'pro' },
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('payments/checkout — bad token', {
    method: 'POST', path: '/api/payments/checkout', token: 'x.y.z', body: { planSlug: 'pro' },
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.check('payments/checkout — planSlug missing', {
    method: 'POST', path: '/api/payments/checkout', auth: true, body: {},
    expect: { status: 400, code: 'FIELD_REQUIRED' },
  });
  await t.check('payments/checkout — planSlug wrong type', {
    method: 'POST', path: '/api/payments/checkout', auth: true, body: { planSlug: 12 },
    expect: { status: 400, code: 'FIELD_REQUIRED' },
  });
  await t.check('payments/checkout — planSlug missing (ar)', {
    method: 'POST', path: '/api/payments/checkout', auth: true, body: {}, lang: 'ar',
    expect: { status: 400, code: 'FIELD_REQUIRED' },
  });
  await t.check('payments/checkout — billingCycle invalid', {
    method: 'POST', path: '/api/payments/checkout', auth: true, body: { planSlug: 'pro', billingCycle: 'weekly' },
    expect: { status: 400, code: 'FIELD_INVALID_ENUM' },
  });
  await t.check('payments/checkout — billingCycle invalid (ar)', {
    method: 'POST', path: '/api/payments/checkout', auth: true, lang: 'ar', body: { planSlug: 'pro', billingCycle: 'weekly' },
    expect: { status: 400, code: 'FIELD_INVALID_ENUM' },
  });
  await t.check('payments/checkout — unknown plan → 404', {
    method: 'POST', path: '/api/payments/checkout', auth: true, body: { planSlug: `nope-${stamp}` },
    expect: { status: 404, code: 'PLAN_NOT_FOUND' },
  });
  await t.check('payments/checkout — unknown plan (fr)', {
    method: 'POST', path: '/api/payments/checkout', auth: true, lang: 'fr', body: { planSlug: `nope-${stamp}` },
    expect: { status: 404, code: 'PLAN_NOT_FOUND' },
  });
  await t.check('payments/verify — no auth', {
    path: '/api/payments/verify/abc123',
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('payments/verify — bad token', {
    path: '/api/payments/verify/abc123', token: 'bad',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
};
