/**
 * Group "inbox" — /api/pages/* conversation, message, AI-settings, sync,
 * analysis and agent endpoints (controllers/page-config.controller.ts).
 *
 * The seeded account has NO connected Page, so every /:pageId/* route must
 * answer 404 PAGE_NOT_FOUND *before* any Meta Graph call. That is deliberate:
 * it proves the ownership gate runs first and no external traffic is emitted.
 */
module.exports = async (t) => {
  const P = t.ctx.missingId;                 // well-formed uuid, no such page
  const C = t.ctx.missingId;                 // well-formed uuid, no such conversation
  const FP = t.ctx.foreignProductId || P;    // a uuid that exists but belongs to the other user
  const FC = t.ctx.foreignClientId || P;

  const pagePaths = [
    ['GET', `/api/pages/${P}/conversations`],
    ['GET', `/api/pages/${P}/messages`],
    ['GET', `/api/pages/${P}/ai-settings`],
    ['PUT', `/api/pages/${P}/ai-settings`],
    ['POST', `/api/pages/${P}/sync`],
    ['POST', `/api/pages/${P}/analyze`],
    ['POST', `/api/pages/${P}/import-products`],
    ['GET', `/api/pages/${P}/summary`],
    ['GET', `/api/pages/${P}/insights`],
    ['POST', `/api/pages/${P}/generate-agent`],
    ['POST', `/api/pages/${P}/apply-agent`],
  ];
  const convPaths = [
    ['GET', `/api/pages/conversations/${C}/messages`],
    ['PATCH', `/api/pages/conversations/${C}`],
    ['POST', `/api/pages/conversations/${C}/reply`],
  ];
  const allPaths = [...pagePaths, ...convPaths];

  // -------------------------------------------------------------------------
  // 1. AUTH — no token / garbage token on every endpoint
  // -------------------------------------------------------------------------
  for (const [method, path] of allPaths) {
    await t.check(`401 no token — ${method} ${path.replace(P, ':id').replace(C, ':id')}`, {
      method, path, body: method === 'GET' ? undefined : {},
      expect: { status: 401, code: 'UNAUTHORIZED' },
    });
  }
  await t.check('401 garbage token — GET conversations', {
    method: 'GET', path: `/api/pages/${P}/conversations`, token: 'not.a.jwt',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.check('401 garbage token (ar) — POST reply', {
    method: 'POST', path: `/api/pages/conversations/${C}/reply`, token: 'not.a.jwt', lang: 'ar',
    body: { message: 'hi' },
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });
  await t.check('401 malformed Bearer scheme', {
    method: 'GET', path: `/api/pages/${P}/summary`, headers: { Authorization: 'Basic abc' },
    expect: { status: 401 },
  });

  // -------------------------------------------------------------------------
  // 2. UNKNOWN / FOREIGN ids → 404 (never 200, never 500)
  // -------------------------------------------------------------------------
  for (const [method, path] of pagePaths) {
    const body = method === 'POST' && path.endsWith('/import-products') ? { items: [{ name: 'x', priceDA: 10 }] } : {};
    await t.check(`404 unknown page — ${method} ${path.replace(P, ':pageId')}`, {
      method, path, auth: true, body: method === 'GET' ? undefined : body,
      expect: { status: 404, code: 'PAGE_NOT_FOUND', noFields: true },
    });
  }
  for (const [method, path] of convPaths) {
    const body = method === 'PATCH' ? { status: 'resolved' } : { message: 'hello' };
    await t.check(`404 unknown conversation — ${method} ${path.replace(C, ':conversationId')}`, {
      method, path, auth: true, body: method === 'GET' ? undefined : body,
      expect: { status: 404, code: 'CONVERSATION_NOT_FOUND', noFields: true },
    });
  }

  // A uuid that EXISTS but is a product / client of the other user — must not
  // be mistaken for a page or conversation.
  await t.check('404 foreign uuid used as pageId — GET summary', {
    method: 'GET', path: `/api/pages/${FP}/summary`, auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('404 foreign uuid used as pageId — GET ai-settings', {
    method: 'GET', path: `/api/pages/${FP}/ai-settings`, auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('404 foreign uuid used as conversationId — GET messages', {
    method: 'GET', path: `/api/pages/conversations/${FC}/messages`, auth: true,
    expect: { status: 404, code: 'CONVERSATION_NOT_FOUND' },
  });
  // Same ids seen by the OTHER merchant — still 404, no cross-tenant leak.
  await t.check('404 cross-tenant — other user on same pageId', {
    method: 'GET', path: `/api/pages/${FP}/conversations`, token: t.tokens.other,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('404 cross-tenant — other user on same conversationId', {
    method: 'PATCH', path: `/api/pages/conversations/${FC}`, token: t.tokens.other,
    body: { status: 'archived' },
    expect: { status: 404, code: 'CONVERSATION_NOT_FOUND' },
  });

  // Malformed (non-uuid) ids must still be a clean 404, never a Prisma 500.
  for (const bad of ['abc', '12345', 'null', '%20', "1'%20OR%20'1'='1"]) {
    await t.check(`404 malformed pageId "${bad}" — GET summary`, {
      method: 'GET', path: `/api/pages/${bad}/summary`, auth: true,
      expect: { status: 404, code: 'PAGE_NOT_FOUND' },
    });
    await t.check(`404 malformed conversationId "${bad}" — GET messages`, {
      method: 'GET', path: `/api/pages/conversations/${bad}/messages`, auth: true,
      expect: { status: 404, code: 'CONVERSATION_NOT_FOUND' },
    });
  }
  await t.check('404 very long pageId', {
    method: 'GET', path: `/api/pages/${'a'.repeat(500)}/summary`, auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });

  // -------------------------------------------------------------------------
  // 3. GET /:pageId/conversations — status enum + pagination
  //    (validation runs BEFORE the ownership lookup, so a 400 is expected here)
  // -------------------------------------------------------------------------
  for (const bad of ['open', 'ACTIVE', 'deleted', '123']) {
    await t.check(`conversations — status "${bad}" invalid`, {
      method: 'GET', path: `/api/pages/${P}/conversations?status=${bad}`, auth: true,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
    });
  }
  await t.check('conversations — status repeated (array) invalid', {
    method: 'GET', path: `/api/pages/${P}/conversations?status=active&status=all`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  for (const good of ['all', 'active', 'resolved', 'archived']) {
    await t.check(`conversations — status "${good}" accepted (then 404 page)`, {
      method: 'GET', path: `/api/pages/${P}/conversations?status=${good}`, auth: true,
      expect: { status: 404, code: 'PAGE_NOT_FOUND' },
    });
  }
  // pagination() clamps instead of rejecting — assert the CURRENT behaviour
  // (no INVALID_PAGINATION here): garbage paging must not become a 500.
  for (const q of ['limit=0', 'limit=-5', 'limit=abc', 'limit=99999', 'offset=-1', 'offset=abc', 'page=0', 'page=-3', 'limit=1e999', 'limit[]=3']) {
    await t.check(`conversations — paging "${q}" tolerated (404 page, not 500)`, {
      method: 'GET', path: `/api/pages/${P}/conversations?${q}`, auth: true,
      expect: { status: 404, code: 'PAGE_NOT_FOUND' },
    });
  }

  // -------------------------------------------------------------------------
  // 4. GET /:pageId/messages — date range + type enum
  // -------------------------------------------------------------------------
  for (const bad of ['incoming2', 'IN', 'sent', 'true']) {
    await t.check(`messages — type "${bad}" invalid`, {
      method: 'GET', path: `/api/pages/${P}/messages?type=${bad}`, auth: true,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
    });
  }
  for (const good of ['all', 'incoming', 'outgoing']) {
    await t.check(`messages — type "${good}" accepted (then 404 page)`, {
      method: 'GET', path: `/api/pages/${P}/messages?type=${good}`, auth: true,
      expect: { status: 404, code: 'PAGE_NOT_FOUND' },
    });
  }
  await t.check('messages — dateFrom not a date', {
    method: 'GET', path: `/api/pages/${P}/messages?dateFrom=yesterday`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'dateFrom', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('messages — dateTo not a date', {
    method: 'GET', path: `/api/pages/${P}/messages?dateTo=32-13-2020`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'dateTo', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('messages — both dates invalid → 2 field errors', {
    method: 'GET', path: `/api/pages/${P}/messages?dateFrom=x&dateTo=y`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', minFields: 2 },
  });
  await t.check('messages — dateFrom after dateTo', {
    method: 'GET', path: `/api/pages/${P}/messages?dateFrom=2024-06-01&dateTo=2024-01-01`, auth: true,
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.check('messages — valid range accepted (then 404 page)', {
    method: 'GET', path: `/api/pages/${P}/messages?dateFrom=2024-01-01&dateTo=2024-06-01&type=incoming&limit=10`, auth: true,
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });

  // -------------------------------------------------------------------------
  // 5. PUT /:pageId/ai-settings
  // -------------------------------------------------------------------------
  const settingsCases = [
    ['aiPersonality', 'robotic', 'FIELD_INVALID_ENUM'],
    ['aiPersonality', 'Professional', 'FIELD_INVALID_ENUM'],
    ['responseTone', 'angry', 'FIELD_INVALID_ENUM'],
    ['responseLength', 'verylong', 'FIELD_INVALID_ENUM'],
  ];
  for (const [field, value, code] of settingsCases) {
    await t.check(`ai-settings — ${field}="${value}" invalid`, {
      method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { [field]: value },
      expect: { status: 400, code: 'VALIDATION_FAILED', field, fieldCode: code },
    });
  }
  await t.check('ai-settings — enum given as a number', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { aiPersonality: 42 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'aiPersonality', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('ai-settings — enum given as an object', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { responseTone: { a: 1 } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'responseTone', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('ai-settings — aiEnabled not a boolean', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { aiEnabled: 'yes' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'aiEnabled', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai-settings — autoReply not a boolean', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { autoReply: ['x'] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'autoReply', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai-settings — customInstructions too long', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { customInstructions: 'a'.repeat(4001) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'customInstructions', fieldCode: 'FIELD_TOO_LONG' },
  });
  for (const [label, value] of [['an object', { a: 1 }], ['a number', 12345], ['an array', ['a']]])
    await t.check(`ai-settings — customInstructions ${label} rejected (no String() coercion)`, {
      method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { customInstructions: value },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'customInstructions', fieldCode: 'FIELD_INVALID' },
    });
  // null used to be silently coerced to `false` and written to the DB.
  await t.check('ai-settings — aiEnabled null rejected, not coerced to false', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { aiEnabled: null },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'aiEnabled', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai-settings — autoReply null rejected', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { autoReply: null },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'autoReply', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai-settings — customInstructions null means "clear" (then 404 page)', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { customInstructions: null },
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  for (const v of [true, false, 'true', 'false', 0, 1, '0', '1'])
    await t.check(`ai-settings — aiEnabled ${JSON.stringify(v)} accepted (then 404 page)`, {
      method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { aiEnabled: v },
      expect: { status: 404, code: 'PAGE_NOT_FOUND' },
    });
  await t.check('ai-settings — every field wrong at once', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true,
    body: { aiEnabled: 'maybe', autoReply: 'nope', aiPersonality: 'x', responseTone: 'y', responseLength: 'z', customInstructions: 'a'.repeat(5000) },
    expect: { status: 400, code: 'VALIDATION_FAILED', minFields: 6 },
  });
  await t.check('ai-settings — all valid values pass validation (then 404 page)', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true,
    body: { aiEnabled: true, autoReply: false, aiPersonality: 'technical', responseTone: 'formal', responseLength: 'detailed', customInstructions: 'Be brief.' },
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('ai-settings — empty body is a no-op (then 404 page)', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: {},
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('ai-settings — malformed JSON body', {
    method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true,
    headers: { 'Content-Type': 'application/json' }, body: '{"aiEnabled":',
    expect: { status: 400, code: 'INVALID_JSON' },
  });

  // -------------------------------------------------------------------------
  // 6. POST /:pageId/analyze — limit bounds
  // -------------------------------------------------------------------------
  for (const [q, code] of [['limit=0', 'FIELD_OUT_OF_RANGE'], ['limit=51', 'FIELD_OUT_OF_RANGE'], ['limit=-1', 'FIELD_OUT_OF_RANGE'], ['limit=1000', 'FIELD_OUT_OF_RANGE'], ['limit=abc', 'FIELD_MUST_BE_NUMBER'], ['limit=2.5', 'FIELD_MUST_BE_INTEGER']]) {
    await t.check(`analyze — ${q} rejected`, {
      method: 'POST', path: `/api/pages/${P}/analyze?${q}`, auth: true, body: {},
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'limit', fieldCode: code },
    });
  }
  for (const q of ['limit=1', 'limit=50', 'limit=30', '']) {
    await t.check(`analyze — "${q || 'default'}" accepted (then 404 page, no Meta call)`, {
      method: 'POST', path: `/api/pages/${P}/analyze${q ? '?' + q : ''}`, auth: true, body: {},
      expect: { status: 404, code: 'PAGE_NOT_FOUND' },
    });
  }

  // -------------------------------------------------------------------------
  // 7. POST /:pageId/import-products — items list
  // -------------------------------------------------------------------------
  for (const [label, body] of [
    ['missing items', {}],
    ['items empty array', { items: [] }],
    ['items null', { items: null }],
    ['items a string', { items: 'product' }],
    ['items an object', { items: { name: 'x' } }],
    ['items a number', { items: 3 }],
  ]) {
    await t.check(`import-products — ${label}`, {
      method: 'POST', path: `/api/pages/${P}/import-products`, auth: true, body,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items', fieldCode: 'LIST_REQUIRED' },
    });
  }
  // Per-item validation: the importer does `item.name.trim()`, so a malformed
  // entry used to reach it and crash with a 500.
  for (const [label, items, field, code] of [
    ['item without name', [{ priceDA: 10 }], 'items[0].name', 'FIELD_REQUIRED'],
    ['item name empty', [{ name: '  ', priceDA: 10 }], 'items[0].name', 'FIELD_REQUIRED'],
    ['item name not a string', [{ name: { a: 1 }, priceDA: 10 }], 'items[0].name', 'FIELD_INVALID'],
    ['item name too long', [{ name: 'n'.repeat(121), priceDA: 10 }], 'items[0].name', 'FIELD_TOO_LONG'],
    ['item without price', [{ name: 'Sac' }], 'items[0].priceDA', 'FIELD_REQUIRED'],
    ['item price zero', [{ name: 'Sac', priceDA: 0 }], 'items[0].priceDA', 'FIELD_MUST_BE_POSITIVE'],
    ['item price negative', [{ name: 'Sac', priceDA: -5 }], 'items[0].priceDA', 'FIELD_MUST_BE_POSITIVE'],
    ['item price not a number', [{ name: 'Sac', priceDA: 'gratuit' }], 'items[0].priceDA', 'FIELD_MUST_BE_NUMBER'],
    ['item is a string', ['Sac'], 'items[0]', 'FIELD_INVALID'],
    ['item is null', [null], 'items[0]', 'FIELD_INVALID'],
    ['item is an array', [[]], 'items[0]', 'FIELD_INVALID'],
    ['second item invalid', [{ name: 'Ok', priceDA: 10 }, {}], 'items[1].name', 'FIELD_REQUIRED'],
  ]) {
    await t.check(`import-products — ${label}`, {
      method: 'POST', path: `/api/pages/${P}/import-products`, auth: true, body: { items },
      expect: { status: 400, code: 'VALIDATION_FAILED', field, fieldCode: code },
    });
  }
  await t.check('import-products — malformed item in ar', {
    method: 'POST', path: `/api/pages/${P}/import-products`, auth: true, lang: 'ar', body: { items: [{}] },
    expect: { status: 400, code: 'VALIDATION_FAILED' },
  });
  await t.check('import-products — valid items reach the ownership gate (404)', {
    method: 'POST', path: `/api/pages/${P}/import-products`, auth: true,
    body: { items: [{ name: 'Sac', priceDA: 2500 }] },
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });

  // -------------------------------------------------------------------------
  // 8. POST /:pageId/apply-agent — enums + lengths
  // -------------------------------------------------------------------------
  for (const [field, value] of [['personality', 'grumpy'], ['responseTone', 'sarcastic'], ['responseLength', 'huge']]) {
    await t.check(`apply-agent — ${field}="${value}" invalid`, {
      method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true, body: { [field]: value },
      expect: { status: 400, code: 'VALIDATION_FAILED', field, fieldCode: 'FIELD_INVALID_ENUM' },
    });
  }
  await t.check('apply-agent — customInstructions too long', {
    method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true, body: { customInstructions: 'x'.repeat(4001) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'customInstructions', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('apply-agent — businessSummary too long', {
    method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true, body: { businessSummary: 'x'.repeat(601) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'businessSummary', fieldCode: 'FIELD_TOO_LONG' },
  });
  for (const field of ['customInstructions', 'businessSummary'])
    await t.check(`apply-agent — ${field} not a string rejected`, {
      method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true, body: { [field]: { a: 1 } },
      expect: { status: 400, code: 'VALIDATION_FAILED', field, fieldCode: 'FIELD_INVALID' },
    });
  await t.check('apply-agent — several fields wrong at once', {
    method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true,
    body: { personality: 'a', responseTone: 'b', responseLength: 'c', businessSummary: 'x'.repeat(700) },
    expect: { status: 400, code: 'VALIDATION_FAILED', minFields: 4 },
  });
  await t.check('apply-agent — empty body uses defaults (then 404 page)', {
    method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true, body: {},
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('apply-agent — full valid draft (then 404 page)', {
    method: 'POST', path: `/api/pages/${P}/apply-agent`, auth: true,
    body: { personality: 'friendly', responseTone: 'enthusiastic', responseLength: 'short', customInstructions: 'Toujours saluer.', businessSummary: 'Boutique de sacs.' },
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });

  // -------------------------------------------------------------------------
  // 9. PATCH /conversations/:id — status enum
  // -------------------------------------------------------------------------
  await t.check('conversation update — status missing', {
    method: 'PATCH', path: `/api/pages/conversations/${C}`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_REQUIRED' },
  });
  for (const bad of ['closed', 'all', 'ACTIVE', 'deleted']) {
    await t.check(`conversation update — status "${bad}" invalid`, {
      method: 'PATCH', path: `/api/pages/conversations/${C}`, auth: true, body: { status: bad },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
    });
  }
  await t.check('conversation update — status not a string', {
    method: 'PATCH', path: `/api/pages/conversations/${C}`, auth: true, body: { status: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  for (const good of ['active', 'resolved', 'archived']) {
    await t.check(`conversation update — status "${good}" accepted (then 404)`, {
      method: 'PATCH', path: `/api/pages/conversations/${C}`, auth: true, body: { status: good },
      expect: { status: 404, code: 'CONVERSATION_NOT_FOUND' },
    });
  }

  // -------------------------------------------------------------------------
  // 10. POST /conversations/:id/reply — message required / length
  // -------------------------------------------------------------------------
  for (const [label, body] of [
    ['message missing', {}],
    ['message empty string', { message: '' }],
    ['message only spaces', { message: '   ' }],
    ['message null', { message: null }],
  ]) {
    await t.check(`reply — ${label}`, {
      method: 'POST', path: `/api/pages/conversations/${C}/reply`, auth: true, body,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'message', fieldCode: 'FIELD_REQUIRED' },
    });
  }
  await t.check('reply — message too long (2001 chars)', {
    method: 'POST', path: `/api/pages/conversations/${C}/reply`, auth: true, body: { message: 'x'.repeat(2001) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'message', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('reply — message at the 2000 limit passes validation (then 404)', {
    method: 'POST', path: `/api/pages/conversations/${C}/reply`, auth: true, body: { message: 'x'.repeat(2000) },
    expect: { status: 404, code: 'CONVERSATION_NOT_FOUND' },
  });
  // Type coercion guard: a non-string message used to be stringified and the
  // literal "[object Object]" would be DELIVERED to the customer on Messenger.
  for (const [label, value] of [
    ['message an object', { a: 1 }],
    ['message an array', ['hi']],
    ['message a number', 42],
    ['message a boolean', true],
  ]) {
    await t.check(`reply — ${label} rejected`, {
      method: 'POST', path: `/api/pages/conversations/${C}/reply`, auth: true, body: { message: value },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'message', fieldCode: 'FIELD_INVALID' },
    });
  }
  await t.check('reply — malformed JSON', {
    method: 'POST', path: `/api/pages/conversations/${C}/reply`, auth: true,
    headers: { 'Content-Type': 'application/json' }, body: '{ oops',
    expect: { status: 400, code: 'INVALID_JSON' },
  });

  // -------------------------------------------------------------------------
  // 11. TRANSLATIONS — same codes in ar and fr (harness verifies Arabic script)
  // -------------------------------------------------------------------------
  const trans = [
    ['PAGE_NOT_FOUND', { method: 'GET', path: `/api/pages/${P}/summary`, auth: true }, 404, 'PAGE_NOT_FOUND'],
    ['CONVERSATION_NOT_FOUND', { method: 'GET', path: `/api/pages/conversations/${C}/messages`, auth: true }, 404, 'CONVERSATION_NOT_FOUND'],
    ['UNAUTHORIZED', { method: 'GET', path: `/api/pages/${P}/insights` }, 401, 'UNAUTHORIZED'],
    ['VALIDATION_FAILED enum', { method: 'PATCH', path: `/api/pages/conversations/${C}`, auth: true, body: { status: 'nope' } }, 400, 'VALIDATION_FAILED'],
    ['VALIDATION_FAILED required', { method: 'POST', path: `/api/pages/conversations/${C}/reply`, auth: true, body: {} }, 400, 'VALIDATION_FAILED'],
    ['VALIDATION_FAILED too long', { method: 'PUT', path: `/api/pages/${P}/ai-settings`, auth: true, body: { customInstructions: 'a'.repeat(4001) } }, 400, 'VALIDATION_FAILED'],
    ['VALIDATION_FAILED out of range', { method: 'POST', path: `/api/pages/${P}/analyze?limit=999`, auth: true, body: {} }, 400, 'VALIDATION_FAILED'],
    ['LIST_REQUIRED', { method: 'POST', path: `/api/pages/${P}/import-products`, auth: true, body: { items: [] } }, 400, 'VALIDATION_FAILED'],
    ['INVALID_DATE_RANGE', { method: 'GET', path: `/api/pages/${P}/messages?dateFrom=2025-01-01&dateTo=2024-01-01`, auth: true }, 400, 'INVALID_DATE_RANGE'],
  ];
  for (const [label, opts, status, code] of trans) {
    for (const lang of ['ar', 'fr']) {
      await t.check(`${label} in ${lang}`, { ...opts, lang, expect: { status, code } });
    }
  }
  // ?lang= query and X-Lang header must also drive the language.
  await t.check('PAGE_NOT_FOUND via ?lang=ar query', {
    method: 'GET', path: `/api/pages/${P}/summary?lang=ar`, auth: true, lang: 'en',
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('PAGE_NOT_FOUND via X-Lang: ar header', {
    method: 'GET', path: `/api/pages/${P}/summary`, auth: true, headers: { 'X-Lang': 'ar' },
    expect: { status: 404, code: 'PAGE_NOT_FOUND', skipTranslationCheck: false },
  }).then(async (r) => {
    if (r && r.json && !/[؀-ۿ]/.test(r.json.message || '')) {
      t.results.push({ label: `${t.currentModule} › X-Lang header honoured`, ok: false, issues: [`X-Lang: ar returned "${r.json.message}"`] });
    } else {
      t.results.push({ label: `${t.currentModule} › X-Lang header honoured`, ok: true, issues: [] });
    }
  });

  // -------------------------------------------------------------------------
  // 12. HAPPY PATHS that do not need a Page (regression guard)
  // -------------------------------------------------------------------------
  await t.ok('regression — GET /api/pages still lists (empty) pages', {
    method: 'GET', path: '/api/pages', auth: true,
  });
};
