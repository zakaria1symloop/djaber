/**
 * Group "ops": agents, notifications, ai-providers/active, cross-sell, delivery, delivery fees.
 * NEVER triggers a real courier / AI call: only validation, not-configured and not-found branches.
 */
const B = '/api/user-stock';

module.exports = async (t) => {
  const { agentId, missingId, foreignProductId, orderId } = t.ctx;
  const other = t.tokens.other;

  // =========================================================================
  // AUTH (401)
  // =========================================================================
  for (const [name, method, path] of [
    ['agents list', 'GET', `${B}/agents`],
    ['notifications list', 'GET', `${B}/notifications`],
    ['ai providers active', 'GET', `${B}/ai-providers/active`],
    ['cross-sell list', 'GET', `${B}/cross-sell`],
    ['delivery wilayas', 'GET', `${B}/delivery/wilayas`],
    ['delivery fees', 'GET', `${B}/delivery/fees`],
  ]) {
    await t.check(`401 — ${name} without token`, {
      method, path, expect: { status: 401, code: 'UNAUTHORIZED' },
    });
  }
  await t.check('401 — agents list with a garbage token', {
    method: 'GET', path: `${B}/agents`, token: 'not.a.jwt',
    expect: { status: 401, code: 'INVALID_TOKEN' },
  });

  // =========================================================================
  // AGENTS
  // =========================================================================
  await t.ok('agents — list', { method: 'GET', path: `${B}/agents`, auth: true });
  await t.ok('agents — get one', { method: 'GET', path: `${B}/agents/${agentId}`, auth: true });
  await t.ok('agents — metrics', { method: 'GET', path: `${B}/agents/${agentId}/metrics`, auth: true });
  await t.ok('agents — insights', { method: 'GET', path: `${B}/agents/${agentId}/insights`, auth: true });
  await t.ok('agents — insights status=pending', { method: 'GET', path: `${B}/agents/${agentId}/insights?status=pending`, auth: true });
  await t.ok('agents — update description', {
    method: 'PUT', path: `${B}/agents/${agentId}`, auth: true, body: { description: 'updated by api test' },
  });

  await t.check('agents — get unknown id', {
    method: 'GET', path: `${B}/agents/${missingId}`, auth: true,
    expect: { status: 404, code: 'AGENT_NOT_FOUND', noFields: true },
  });
  await t.check('agents — get id of ANOTHER merchant (must not leak)', {
    method: 'GET', path: `${B}/agents/${agentId}`, token: other,
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });
  await t.check('agents — update id of ANOTHER merchant', {
    method: 'PUT', path: `${B}/agents/${agentId}`, token: other, body: { name: 'hijack' },
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });
  await t.check('agents — delete id of ANOTHER merchant', {
    method: 'DELETE', path: `${B}/agents/${agentId}`, token: other,
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });
  await t.check('agents — metrics unknown id', {
    method: 'GET', path: `${B}/agents/${missingId}/metrics`, auth: true,
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });
  await t.check('agents — insights unknown id', {
    method: 'GET', path: `${B}/agents/${missingId}/insights`, auth: true,
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });
  await t.check('agents — insights invalid status filter', {
    method: 'GET', path: `${B}/agents/${agentId}/insights?status=whatever`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });

  // --- create: validation ---
  await t.check('agents — create without name', {
    method: 'POST', path: `${B}/agents`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('agents — create with invalid personality', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', personality: 'grumpy' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'personality', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('agents — create with name too long', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'x'.repeat(101) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('agents — create with temperature above 2', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', temperature: 5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'temperature', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('agents — create with negative temperature', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', temperature: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'temperature' },
  });
  await t.check('agents — create with non-numeric temperature', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', temperature: 'hot' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'temperature', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('agents — create with maxTokens 0', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', maxTokens: 0 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'maxTokens', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('agents — create with maxTokens above 8000', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', maxTokens: 99999 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'maxTokens', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('agents — create with fractional maxTokens', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', maxTokens: 12.5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'maxTokens', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('agents — create with responseDelay above 60', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', responseDelay: 61 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'responseDelay', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('agents — create with pageIds not an array', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', pageIds: 'page-1' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'pageIds', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('agents — create with several bad fields at once', {
    method: 'POST', path: `${B}/agents`, auth: true,
    body: { personality: 'nope', temperature: 9, maxTokens: -3 },
    expect: { status: 400, code: 'VALIDATION_FAILED', minFields: 4 },
  });
  // Plan limit — the seed already created one agent.
  await t.check('agents — second agent hits the plan limit', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'Second agent' },
    expect: { status: 403, code: 'PLAN_LIMIT_REACHED', noFields: true },
  });

  // --- update: validation + ownership of linked ids ---
  await t.check('agents — update with empty name', {
    method: 'PUT', path: `${B}/agents/${agentId}`, auth: true, body: { name: '' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('agents — update with invalid personality', {
    method: 'PUT', path: `${B}/agents/${agentId}`, auth: true, body: { personality: 'sarcastic' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'personality', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('agents — update with invalid boolean isActive', {
    method: 'PUT', path: `${B}/agents/${agentId}`, auth: true, body: { isActive: 'maybe' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('agents — update with a pageId that is not mine', {
    method: 'PUT', path: `${B}/agents/${agentId}`, auth: true, body: { pageIds: [missingId] },
    expect: { status: 404, code: 'PAGE_NOT_FOUND' },
  });
  await t.check('agents — update with a productId owned by another merchant', {
    method: 'PUT', path: `${B}/agents/${agentId}`, auth: true, body: { productIds: [foreignProductId] },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('agents — update unknown agent', {
    method: 'PUT', path: `${B}/agents/${missingId}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });

  // --- test endpoint (validation / not-found only — never reaches the AI) ---
  await t.check('agents — test without message', {
    method: 'POST', path: `${B}/agents/${agentId}/test`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'message', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('agents — test with history not an array', {
    method: 'POST', path: `${B}/agents/${agentId}/test`, auth: true, body: { message: 'hi', history: 'nope' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'history', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('agents — test on an unknown agent', {
    method: 'POST', path: `${B}/agents/${missingId}/test`, auth: true, body: { message: 'hi' },
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });
  await t.check('agents — test on another merchant\'s agent', {
    method: 'POST', path: `${B}/agents/${agentId}/test`, token: other, body: { message: 'hi' },
    expect: { status: 404, code: 'AGENT_NOT_FOUND' },
  });

  // --- insights resolution ---
  await t.check('insights — resolve without an action', {
    method: 'PUT', path: `${B}/agents/insights/${missingId}`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'action', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('insights — resolve with an invalid action', {
    method: 'PUT', path: `${B}/agents/insights/${missingId}`, auth: true, body: { action: 'burn' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'action', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('insights — resolve an unknown insight', {
    method: 'PUT', path: `${B}/agents/insights/${missingId}`, auth: true, body: { action: 'dismiss' },
    expect: { status: 404, code: 'INSIGHT_NOT_FOUND' },
  });

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================
  await t.ok('notifications — list', { method: 'GET', path: `${B}/notifications`, auth: true });
  await t.ok('notifications — list paginated', { method: 'GET', path: `${B}/notifications?page=2&limit=5`, auth: true });
  await t.ok('notifications — list isRead=false', { method: 'GET', path: `${B}/notifications?isRead=false`, auth: true });
  await t.ok('notifications — list with absurd limit is clamped, not 500', { method: 'GET', path: `${B}/notifications?limit=99999`, auth: true });
  await t.ok('notifications — list with non-numeric page falls back', { method: 'GET', path: `${B}/notifications?page=abc`, auth: true });
  await t.ok('notifications — unread count', { method: 'GET', path: `${B}/notifications/unread-count`, auth: true });
  await t.ok('notifications — mark all as read', { method: 'PUT', path: `${B}/notifications/read-all`, auth: true });

  await t.check('notifications — invalid isRead filter', {
    method: 'GET', path: `${B}/notifications?isRead=perhaps`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isRead', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('notifications — type filter too long', {
    method: 'GET', path: `${B}/notifications?type=${'x'.repeat(60)}`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('notifications — mark unknown id as read', {
    method: 'PUT', path: `${B}/notifications/${missingId}/read`, auth: true,
    expect: { status: 404, code: 'NOTIFICATION_NOT_FOUND' },
  });
  await t.check('notifications — mark a malformed id as read', {
    method: 'PUT', path: `${B}/notifications/not-a-real-id/read`, auth: true,
    expect: { status: 404, code: 'NOTIFICATION_NOT_FOUND' },
  });

  // =========================================================================
  // AI PROVIDERS (active)
  // =========================================================================
  await t.ok('ai-providers — active list', { method: 'GET', path: `${B}/ai-providers/active`, auth: true });

  // =========================================================================
  // CROSS-SELL
  // =========================================================================
  await t.ok('cross-sell — list', { method: 'GET', path: `${B}/cross-sell`, auth: true });
  await t.ok('cross-sell — list type=cross_sell', { method: 'GET', path: `${B}/cross-sell?type=cross_sell`, auth: true });
  await t.ok('cross-sell — list isActive=true', { method: 'GET', path: `${B}/cross-sell?isActive=true`, auth: true });
  await t.ok('cross-sell — stats', { method: 'GET', path: `${B}/cross-sell/stats`, auth: true });
  await t.ok('cross-sell — for a product', { method: 'GET', path: `${B}/cross-sell/product/${t.ctx.productId}`, auth: true });
  await t.ok('cross-sell — for an unknown product returns an empty list', { method: 'GET', path: `${B}/cross-sell/product/${missingId}`, auth: true });
  await t.ok('cross-sell — generate', { method: 'POST', path: `${B}/cross-sell/generate`, auth: true });

  await t.check('cross-sell — invalid type filter', {
    method: 'GET', path: `${B}/cross-sell?type=upsell`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('cross-sell — invalid isActive filter', {
    method: 'GET', path: `${B}/cross-sell?isActive=sometimes`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('cross-sell — search filter too long', {
    method: 'GET', path: `${B}/cross-sell?search=${'x'.repeat(250)}`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'search', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('cross-sell — update with invalid isActive', {
    method: 'PUT', path: `${B}/cross-sell/${missingId}`, auth: true, body: { isActive: 'yes please' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('cross-sell — update unknown recommendation', {
    method: 'PUT', path: `${B}/cross-sell/${missingId}`, auth: true, body: { isActive: true },
    expect: { status: 404, code: 'RECOMMENDATION_NOT_FOUND' },
  });
  await t.check('cross-sell — delete unknown recommendation', {
    method: 'DELETE', path: `${B}/cross-sell/${missingId}`, auth: true,
    expect: { status: 404, code: 'RECOMMENDATION_NOT_FOUND' },
  });

  // =========================================================================
  // DELIVERY — read-only + branches that never reach a courier
  // =========================================================================
  await t.ok('delivery — wilayas', { method: 'GET', path: `${B}/delivery/wilayas`, auth: true });
  await t.ok('delivery — available providers', { method: 'GET', path: `${B}/delivery/providers/available`, auth: true });
  await t.ok('delivery — configured providers', { method: 'GET', path: `${B}/delivery/providers`, auth: true });

  // --- send: no provider configured yet (MUST run before we add one) ---
  await t.check('delivery — send an order while no provider is configured', {
    method: 'POST', path: `${B}/delivery/send/${orderId}`, auth: true, body: {},
    expect: { status: 422, code: 'DELIVERY_NO_ACTIVE_PROVIDER', noFields: true },
  });
  await t.check('delivery — send an unknown order', {
    method: 'POST', path: `${B}/delivery/send/${missingId}`, auth: true, body: {},
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('delivery — send an order belonging to another merchant', {
    method: 'POST', path: `${B}/delivery/send/${orderId}`, token: other, body: {},
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('delivery — send with an out-of-range wilaya', {
    method: 'POST', path: `${B}/delivery/send/${orderId}`, auth: true, body: { toWilayaId: 99 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'toWilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('delivery — send with a non-numeric wilaya', {
    method: 'POST', path: `${B}/delivery/send/${orderId}`, auth: true, body: { toWilayaId: 'Alger' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'toWilayaId', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('delivery — send with a note that is too long', {
    method: 'POST', path: `${B}/delivery/send/${orderId}`, auth: true, body: { note: 'x'.repeat(1200) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'note', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('delivery — send with an unknown providerId', {
    method: 'POST', path: `${B}/delivery/send/${orderId}`, auth: true, body: { providerId: missingId },
    expect: { status: 404, code: 'DELIVERY_PROVIDER_NOT_FOUND' },
  });

  // --- tracking / label ---
  await t.check('delivery — track an order with no shipment', {
    method: 'GET', path: `${B}/delivery/track/${orderId}`, auth: true,
    expect: { status: 422, code: 'DELIVERY_ORDER_NOT_TRACKED' },
  });
  await t.check('delivery — track an unknown order', {
    method: 'GET', path: `${B}/delivery/track/${missingId}`, auth: true,
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('delivery — track an order of another merchant', {
    method: 'GET', path: `${B}/delivery/track/${orderId}`, token: other,
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('delivery — label for an order with no shipment', {
    method: 'GET', path: `${B}/delivery/label/${orderId}`, auth: true,
    expect: { status: 422, code: 'DELIVERY_ORDER_NOT_TRACKED' },
  });
  await t.check('delivery — label for an unknown order', {
    method: 'GET', path: `${B}/delivery/label/${missingId}`, auth: true,
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });

  // --- rates (zrexpress is never configured on the test account) ---
  await t.check('delivery — rates without a provider', {
    method: 'GET', path: `${B}/delivery/rates?toWilaya=16`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('delivery — rates with an unknown provider name', {
    method: 'GET', path: `${B}/delivery/rates?provider=dhl&toWilaya=16`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('delivery — rates without toWilaya', {
    method: 'GET', path: `${B}/delivery/rates?provider=zrexpress`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'toWilaya', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('delivery — rates with toWilaya out of range', {
    method: 'GET', path: `${B}/delivery/rates?provider=zrexpress&toWilaya=0`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'toWilaya', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('delivery — rates with fromWilaya out of range', {
    method: 'GET', path: `${B}/delivery/rates?provider=zrexpress&toWilaya=16&fromWilaya=200`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'fromWilaya', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('delivery — rates for a provider that is not configured', {
    method: 'GET', path: `${B}/delivery/rates?provider=zrexpress&toWilaya=16`, auth: true,
    expect: { status: 404, code: 'DELIVERY_PROVIDER_NOT_FOUND' },
  });

  // --- credentials test endpoint: validation only, never a real courier call ---
  await t.check('delivery — test credentials without provider', {
    method: 'POST', path: `${B}/delivery/providers/test`, auth: true, body: { credentials: { token: 'x' } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('delivery — test credentials with an unsupported provider', {
    method: 'POST', path: `${B}/delivery/providers/test`, auth: true, body: { provider: 'fedex', credentials: { token: 'x' } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('delivery — test credentials with no credentials', {
    method: 'POST', path: `${B}/delivery/providers/test`, auth: true, body: { provider: 'yalidine' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'credentials', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('delivery — test credentials with an empty credentials object', {
    method: 'POST', path: `${B}/delivery/providers/test`, auth: true, body: { provider: 'yalidine', credentials: {} },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'credentials', fieldCode: 'FIELD_INVALID' },
  });

  // --- provider CRUD ---
  await t.check('delivery — add provider without a provider name', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true, body: { credentials: { apiId: 'a', apiToken: 'b' } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('delivery — add provider with an invalid provider name', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true, body: { provider: 'ups', credentials: { a: 'b' } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('delivery — add provider without credentials', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true, body: { provider: 'yalidine' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'credentials', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('delivery — add provider with credentials as an array', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true, body: { provider: 'yalidine', credentials: ['a', 'b'] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'credentials', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('delivery — add provider with a nested credentials value', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true, body: { provider: 'yalidine', credentials: { apiId: { deep: true } } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'credentials', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('delivery — add provider with senderWilayaId out of range', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true,
    body: { provider: 'yalidine', credentials: { a: 'b' }, senderWilayaId: 99 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'senderWilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('delivery — add provider with a non-numeric senderWilayaId', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true,
    body: { provider: 'yalidine', credentials: { a: 'b' }, senderWilayaId: 'Oran' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'senderWilayaId', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('delivery — add provider with a displayName that is too long', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true,
    body: { provider: 'yalidine', credentials: { a: 'b' }, displayName: 'x'.repeat(120) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'displayName', fieldCode: 'FIELD_TOO_LONG' },
  });

  // Create one (isDefault stays false so no quote/rate path ever calls the courier).
  const created = await t.ok('delivery — add a provider', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true,
    body: { provider: 'yalidine', credentials: { apiId: 'test-id', apiToken: 'test-token' }, senderWilayaId: 16, isDefault: false },
    expect: { status: 201 },
  });
  const providerRowId = created?.json?.provider?.id;

  await t.check('delivery — adding the same provider twice', {
    method: 'POST', path: `${B}/delivery/providers`, auth: true,
    body: { provider: 'yalidine', credentials: { apiId: 'test-id', apiToken: 'test-token' } },
    expect: { status: 409, code: 'DELIVERY_PROVIDER_ALREADY_ADDED' },
  });

  if (providerRowId) {
    await t.ok('delivery — update a provider', {
      method: 'PUT', path: `${B}/delivery/providers/${providerRowId}`, auth: true,
      body: { displayName: 'Yalidine test', senderName: 'Shop' },
    });
    await t.check('delivery — update a provider with an empty displayName', {
      method: 'PUT', path: `${B}/delivery/providers/${providerRowId}`, auth: true, body: { displayName: '' },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'displayName', fieldCode: 'FIELD_REQUIRED' },
    });
    await t.check('delivery — update a provider with senderWilayaId out of range', {
      method: 'PUT', path: `${B}/delivery/providers/${providerRowId}`, auth: true, body: { senderWilayaId: 0 },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'senderWilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
    });
    await t.check('delivery — update a provider owned by another merchant', {
      method: 'PUT', path: `${B}/delivery/providers/${providerRowId}`, token: other, body: { displayName: 'hijack' },
      expect: { status: 404, code: 'DELIVERY_PROVIDER_NOT_FOUND' },
    });
    await t.check('delivery — delete a provider owned by another merchant', {
      method: 'DELETE', path: `${B}/delivery/providers/${providerRowId}`, token: other,
      expect: { status: 404, code: 'DELIVERY_PROVIDER_NOT_FOUND' },
    });
  }
  await t.check('delivery — update an unknown provider', {
    method: 'PUT', path: `${B}/delivery/providers/${missingId}`, auth: true, body: { displayName: 'X' },
    expect: { status: 404, code: 'DELIVERY_PROVIDER_NOT_FOUND' },
  });
  await t.check('delivery — delete an unknown provider', {
    method: 'DELETE', path: `${B}/delivery/providers/${missingId}`, auth: true,
    expect: { status: 404, code: 'DELIVERY_PROVIDER_NOT_FOUND' },
  });

  // =========================================================================
  // DELIVERY FEES
  // =========================================================================
  await t.ok('fees — list the 58-wilaya table', { method: 'GET', path: `${B}/delivery/fees`, auth: true });
  await t.ok('fees — quote for wilaya 16', { method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=16`, auth: true });
  await t.ok('fees — quote stopdesk', { method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=31&isStopdesk=true`, auth: true });

  await t.check('fees — quote without a wilayaId', {
    method: 'GET', path: `${B}/delivery/fees/quote`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('fees — quote with wilayaId 59', {
    method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=59`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('fees — quote with a non-numeric wilayaId', {
    method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=alger`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('fees — quote with an invalid isStopdesk', {
    method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=16&isStopdesk=peut-etre`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isStopdesk', fieldCode: 'FIELD_INVALID' },
  });

  await t.check('fees — save without a wilayaId', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { homePrice: 500 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('fees — save with wilayaId 0', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { wilayaId: 0, homePrice: 500 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('fees — save with wilayaId 59', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { wilayaId: 59, homePrice: 500 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  await t.check('fees — save with a negative homePrice', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { wilayaId: 16, homePrice: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'homePrice', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('fees — save with a non-numeric stopdeskPrice', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { wilayaId: 16, stopdeskPrice: 'gratuit' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'stopdeskPrice', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('fees — save with an invalid isActive', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { wilayaId: 16, isActive: 'oui' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('fees — seed with an invalid overwrite flag', {
    method: 'POST', path: `${B}/delivery/fees/seed`, auth: true, body: { overwrite: 'peut-etre' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'overwrite', fieldCode: 'FIELD_INVALID' },
  });

  await t.check('fees — delete a non-numeric wilayaId', {
    method: 'DELETE', path: `${B}/delivery/fees/abc`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('fees — delete wilayaId 99', {
    method: 'DELETE', path: `${B}/delivery/fees/99`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });
  // No rule saved for wilaya 7 yet (this must run before the seed).
  await t.check('fees — delete a wilaya that has no custom rule', {
    method: 'DELETE', path: `${B}/delivery/fees/7`, auth: true,
    expect: { status: 404, code: 'FEE_RULE_NOT_FOUND', noFields: true },
  });

  await t.ok('fees — save a rule (upsert create)', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true,
    body: { wilayaId: 16, homePrice: 450, stopdeskPrice: 250, returnPrice: 200 },
  });
  await t.ok('fees — save the same rule again (upsert update)', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true,
    body: { wilayaId: 16, homePrice: 500, stopdeskPrice: 300, returnPrice: 250, isActive: true },
  });
  await t.ok('fees — quote now uses the custom rule', { method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=16`, auth: true });
  await t.ok('fees — delete the custom rule', { method: 'DELETE', path: `${B}/delivery/fees/16`, auth: true });
  await t.ok('fees — seed defaults', { method: 'POST', path: `${B}/delivery/fees/seed`, auth: true, body: {} });
  await t.ok('fees — delete a seeded rule', { method: 'DELETE', path: `${B}/delivery/fees/7`, auth: true });

  // Cross-tenant: the other merchant must not see my rules through the quote.
  await t.ok('fees — another merchant gets the system default, not my rule', {
    method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=16`, token: other,
  });

  // =========================================================================
  // MISC HARDENING — repeated query params, malformed bodies, odd ids
  // =========================================================================
  await t.ok('hardening — negative limit/offset do not reach the DB', {
    method: 'GET', path: `${B}/notifications?limit=-5&offset=-3`, auth: true,
  });
  await t.check('hardening — repeated isRead query param', {
    method: 'GET', path: `${B}/notifications?isRead=true&isRead=false`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isRead', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('hardening — repeated insight status query param', {
    method: 'GET', path: `${B}/agents/${agentId}/insights?status=pending&status=resolved`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('hardening — malformed JSON body', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: 'not-json',
    expect: { status: 400, code: 'INVALID_JSON' },
  });
  await t.check('hardening — fractional wilayaId in the delete path', {
    method: 'DELETE', path: `${B}/delivery/fees/16.5`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('hardening — fractional wilayaId in the quote', {
    method: 'GET', path: `${B}/delivery/fees/quote?wilayaId=16.7`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'wilayaId', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('hardening — pageIds holding numbers', {
    method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', pageIds: [1, 2] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'pageIds', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('hardening — update provider with an empty credentials object', {
    method: 'PUT', path: `${B}/delivery/providers/${missingId}`, auth: true, body: { credentials: {} },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'credentials', fieldCode: 'FIELD_INVALID' },
  });
  await t.ok('hardening — cross-sell for a blank product id returns an empty list', {
    method: 'GET', path: `${B}/cross-sell/product/%20`, auth: true,
  });
  await t.ok('hardening — empty type filter is ignored', {
    method: 'GET', path: `${B}/notifications?type=`, auth: true,
  });
  await t.ok('hardening — numeric strings are accepted by the fee upsert', {
    method: 'POST', path: `${B}/delivery/fees`, auth: true, body: { wilayaId: '58', homePrice: '500' },
  });
  await t.ok('hardening — clean up that rule', { method: 'DELETE', path: `${B}/delivery/fees/58`, auth: true });

  // =========================================================================
  // TRANSLATIONS — the same errors in ar and fr (7 distinct codes)
  // =========================================================================
  const i18n = [
    ['VALIDATION_FAILED (agent personality)', { method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'A', personality: 'grumpy' } }, 400, 'VALIDATION_FAILED', 'personality'],
    ['AGENT_NOT_FOUND', { method: 'GET', path: `${B}/agents/${missingId}`, auth: true }, 404, 'AGENT_NOT_FOUND', null],
    ['PLAN_LIMIT_REACHED', { method: 'POST', path: `${B}/agents`, auth: true, body: { name: 'Second agent' } }, 403, 'PLAN_LIMIT_REACHED', null],
    ['NOTIFICATION_NOT_FOUND', { method: 'PUT', path: `${B}/notifications/${missingId}/read`, auth: true }, 404, 'NOTIFICATION_NOT_FOUND', null],
    ['RECOMMENDATION_NOT_FOUND', { method: 'DELETE', path: `${B}/cross-sell/${missingId}`, auth: true }, 404, 'RECOMMENDATION_NOT_FOUND', null],
    ['DELIVERY_PROVIDER_ALREADY_ADDED', { method: 'POST', path: `${B}/delivery/providers`, auth: true, body: { provider: 'yalidine', credentials: { a: 'b' } } }, 409, 'DELIVERY_PROVIDER_ALREADY_ADDED', null],
    ['DELIVERY_ORDER_NOT_TRACKED', { method: 'GET', path: `${B}/delivery/track/${orderId}`, auth: true }, 422, 'DELIVERY_ORDER_NOT_TRACKED', null],
    ['FEE_RULE_NOT_FOUND', { method: 'DELETE', path: `${B}/delivery/fees/7`, auth: true }, 404, 'FEE_RULE_NOT_FOUND', null],
    ['UNAUTHORIZED', { method: 'GET', path: `${B}/agents` }, 401, 'UNAUTHORIZED', null],
  ];
  for (const [label, opts, status, code, field] of i18n) {
    for (const lang of ['ar', 'fr']) {
      await t.check(`i18n ${lang} — ${label}`, {
        ...opts, lang,
        expect: { status, code, ...(field ? { field } : {}) },
      });
    }
  }

  // Clean up the provider we created so no later run sends real courier traffic.
  if (providerRowId) {
    await t.ok('delivery — delete the test provider', {
      method: 'DELETE', path: `${B}/delivery/providers/${providerRowId}`, auth: true,
    });
  }
};
