/**
 * Group "admin": /api/admin/* + the legacy /api/stock/{pageId}/* surface.
 */
module.exports = async (t) => {
  const stamp = Date.now();
  const MISSING = t.ctx.missingId;

  // -------------------------------------------------------------------------
  // 1. EVERY admin route: no token -> 401 UNAUTHORIZED, normal token -> 403 ADMIN_REQUIRED
  // -------------------------------------------------------------------------
  const ADMIN_ROUTES = [
    ['GET', '/api/admin/analytics'],
    ['GET', '/api/admin/users'],
    ['GET', `/api/admin/users/${MISSING}`],
    ['PATCH', `/api/admin/users/${MISSING}`, { plan: 'teams' }],
    ['DELETE', `/api/admin/users/${MISSING}`],
    ['GET', '/api/admin/plans'],
    ['POST', '/api/admin/plans', { slug: 'nope', name: 'Nope' }],
    ['PATCH', `/api/admin/plans/${MISSING}`, { name: 'Nope' }],
    ['DELETE', `/api/admin/plans/${MISSING}`],
    ['GET', '/api/admin/subscriptions'],
    ['POST', '/api/admin/subscriptions', { userId: MISSING, planSlug: 'nope' }],
    ['PATCH', `/api/admin/subscriptions/${MISSING}`, { status: 'cancelled' }],
    ['DELETE', `/api/admin/subscriptions/${MISSING}`],
    ['GET', '/api/admin/conversations'],
    ['GET', `/api/admin/conversations/${MISSING}`],
    ['GET', '/api/admin/products'],
    ['GET', '/api/admin/lookups/categories'],
    ['GET', '/api/admin/lookups/pages'],
    ['GET', '/api/admin/lookups/agents'],
    ['GET', '/api/admin/cms'],
    ['GET', '/api/admin/cms/nope-slug'],
    ['POST', '/api/admin/cms', { slug: 'nope-slug', title: 'x', category: 'legal', content: 'x' }],
    ['DELETE', '/api/admin/cms/nope-slug'],
    ['PATCH', '/api/admin/profile', { firstName: 'X' }],
    ['GET', '/api/admin/ai-providers'],
    ['PUT', '/api/admin/ai-providers/openai', { isActive: true }],
    ['POST', '/api/admin/ai-providers/openai/test'],
  ];

  for (const [method, path, body] of ADMIN_ROUTES) {
    await t.check(`GUARD no token ${method} ${path}`, {
      method, path, body, token: null,
      expect: { status: 401, code: 'UNAUTHORIZED', noFields: true },
    });
    await t.check(`GUARD non-admin ${method} ${path}`, {
      method, path, body, auth: true,
      expect: { status: 403, code: 'ADMIN_REQUIRED', noFields: true },
    });
    await t.check(`GUARD garbage token ${method} ${path}`, {
      method, path, body, token: 'not-a-jwt',
      expect: { status: 401, code: 'INVALID_TOKEN', noFields: true },
    });
  }

  // -------------------------------------------------------------------------
  // 2. Happy paths (admin token)
  // -------------------------------------------------------------------------
  await t.ok('analytics', { path: '/api/admin/analytics', auth: 'admin' });
  await t.ok('analytics ?period=today', { path: '/api/admin/analytics?period=today', auth: 'admin' });
  await t.ok('analytics bogus period (falls back)', { path: '/api/admin/analytics?period=zzz', auth: 'admin' });
  await t.ok('list users', { path: '/api/admin/users', auth: 'admin' });
  await t.ok('list users filtered', { path: '/api/admin/users?role=admin&sortBy=email&sortOrder=asc&limit=5', auth: 'admin' });
  await t.ok('list users bogus sortBy (ignored)', { path: '/api/admin/users?sortBy=password&limit=1', auth: 'admin' });
  await t.ok('list users insane limit (clamped)', { path: '/api/admin/users?limit=999999&offset=-5', auth: 'admin' });
  await t.ok('get user details', { path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin' });
  await t.ok('list plans', { path: '/api/admin/plans', auth: 'admin' });
  await t.ok('list subscriptions', { path: '/api/admin/subscriptions', auth: 'admin' });
  await t.ok('list conversations', { path: '/api/admin/conversations', auth: 'admin' });
  await t.ok('list admin products', { path: '/api/admin/products', auth: 'admin' });
  await t.ok('list admin products filtered', { path: `/api/admin/products?userId=${t.ctx.userId}&lowStock=true&minPrice=1&maxPrice=100000`, auth: 'admin' });
  await t.ok('lookup categories', { path: '/api/admin/lookups/categories', auth: 'admin' });
  await t.ok('lookup pages', { path: '/api/admin/lookups/pages', auth: 'admin' });
  await t.ok('lookup agents', { path: '/api/admin/lookups/agents', auth: 'admin' });
  await t.ok('list cms pages', { path: '/api/admin/cms', auth: 'admin' });
  await t.ok('list ai providers', { path: '/api/admin/ai-providers', auth: 'admin' });
  await t.ok('patch admin profile (names only)', {
    method: 'PATCH', path: '/api/admin/profile', auth: 'admin', body: { firstName: 'Adm2', lastName: 'In2' },
  });

  // -------------------------------------------------------------------------
  // 3. Unknown ids -> 404
  // -------------------------------------------------------------------------
  await t.check('user details unknown id', {
    path: `/api/admin/users/${MISSING}`, auth: 'admin',
    expect: { status: 404, code: 'USER_NOT_FOUND', noFields: true },
  });
  await t.check('user details garbage id', {
    path: '/api/admin/users/not-an-id', auth: 'admin',
    expect: { status: 404, code: 'USER_NOT_FOUND', noFields: true },
  });
  await t.check('patch user unknown id', {
    method: 'PATCH', path: `/api/admin/users/${MISSING}`, auth: 'admin', body: { plan: 'teams' },
    expect: { status: 404, code: 'USER_NOT_FOUND', noFields: true },
  });
  await t.check('delete user unknown id', {
    method: 'DELETE', path: `/api/admin/users/${MISSING}`, auth: 'admin',
    expect: { status: 404, code: 'USER_NOT_FOUND', noFields: true },
  });
  await t.check('conversation unknown id', {
    path: `/api/admin/conversations/${MISSING}`, auth: 'admin',
    expect: { status: 404, code: 'CONVERSATION_NOT_FOUND', noFields: true },
  });
  await t.check('cms page unknown slug', {
    path: '/api/admin/cms/does-not-exist-xyz', auth: 'admin',
    expect: { status: 404, code: 'CMS_PAGE_NOT_FOUND', noFields: true },
  });
  await t.check('cms delete unknown slug', {
    method: 'DELETE', path: '/api/admin/cms/does-not-exist-xyz', auth: 'admin',
    expect: { status: 404, code: 'CMS_PAGE_NOT_FOUND', noFields: true },
  });
  await t.check('patch plan unknown id', {
    method: 'PATCH', path: `/api/admin/plans/${MISSING}`, auth: 'admin', body: { name: 'X' },
    expect: { status: 404, code: 'PLAN_NOT_FOUND', noFields: true },
  });
  await t.check('delete plan unknown id', {
    method: 'DELETE', path: `/api/admin/plans/${MISSING}`, auth: 'admin',
    expect: { status: 404, code: 'PLAN_NOT_FOUND', noFields: true },
  });
  await t.check('patch subscription unknown id', {
    method: 'PATCH', path: `/api/admin/subscriptions/${MISSING}`, auth: 'admin', body: { status: 'cancelled' },
    expect: { status: 404, code: 'SUBSCRIPTION_NOT_FOUND', noFields: true },
  });
  await t.check('delete subscription unknown id', {
    method: 'DELETE', path: `/api/admin/subscriptions/${MISSING}`, auth: 'admin',
    expect: { status: 404, code: 'SUBSCRIPTION_NOT_FOUND', noFields: true },
  });

  // -------------------------------------------------------------------------
  // 4. Users — validation + self-protection
  // -------------------------------------------------------------------------
  await t.check('patch user — invalid plan enum', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin', body: { plan: 'platinum' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'plan', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('patch user — isAdmin not a boolean', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin', body: { isAdmin: 'yes' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isAdmin' },
  });
  await t.check('patch user — password too short', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin', body: { password: 'abc' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'FIELD_TOO_SHORT' },
  });
  await t.check('patch user — firstName too long', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin', body: { firstName: 'a'.repeat(200) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'firstName', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('patch user — several errors at once', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin',
    body: { plan: 'nope', isAdmin: 3, password: 'x' },
    expect: { status: 400, code: 'VALIDATION_FAILED', minFields: 3 },
  });
  await t.check('admin cannot demote self', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.adminUserId}`, auth: 'admin', body: { isAdmin: false },
    expect: { status: 422, code: 'ADMIN_CANNOT_DEMOTE_SELF', noFields: true },
  });
  await t.check('admin cannot delete self', {
    method: 'DELETE', path: `/api/admin/users/${t.ctx.adminUserId}`, auth: 'admin',
    expect: { status: 422, code: 'ADMIN_CANNOT_DELETE_SELF', noFields: true },
  });
  await t.ok('patch user — valid plan', {
    method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin', body: { plan: 'teams' },
  });

  // Delete a user we register ourselves (never a seeded one).
  const throwaway = await t.ok('register throwaway user', {
    method: 'POST', path: '/api/auth/register', token: null,
    body: { email: `apitest_admin_del_${stamp}@djaber.test`, password: 'Password123!', firstName: 'Del', lastName: 'Me' },
    expect: { status: 201 },
  });
  const throwawayId = throwaway?.json?.user?.id;
  if (throwawayId) {
    await t.ok('delete throwaway user', {
      method: 'DELETE', path: `/api/admin/users/${throwawayId}`, auth: 'admin',
    });
    await t.check('delete throwaway user twice -> 404', {
      method: 'DELETE', path: `/api/admin/users/${throwawayId}`, auth: 'admin',
      expect: { status: 404, code: 'USER_NOT_FOUND' },
    });
  }

  // -------------------------------------------------------------------------
  // 5. Admin profile validation
  // -------------------------------------------------------------------------
  await t.check('profile — password without currentPassword', {
    method: 'PATCH', path: '/api/admin/profile', auth: 'admin', body: { password: 'NewPassword123!' },
    expect: { status: 400, code: 'ADMIN_CURRENT_PASSWORD_REQUIRED', noFields: true },
  });
  await t.check('profile — wrong currentPassword', {
    method: 'PATCH', path: '/api/admin/profile', auth: 'admin',
    body: { password: 'NewPassword123!', currentPassword: 'totally-wrong' },
    expect: { status: 400, code: 'ADMIN_CURRENT_PASSWORD_INCORRECT', noFields: true },
  });
  await t.check('profile — new password too short', {
    method: 'PATCH', path: '/api/admin/profile', auth: 'admin', body: { password: 'abc', currentPassword: 'x' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'password', fieldCode: 'FIELD_TOO_SHORT' },
  });
  await t.check('profile — lastName too long', {
    method: 'PATCH', path: '/api/admin/profile', auth: 'admin', body: { lastName: 'b'.repeat(300) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'lastName', fieldCode: 'FIELD_TOO_LONG' },
  });

  // -------------------------------------------------------------------------
  // 6. Plans — CRUD + validation + mass assignment
  // -------------------------------------------------------------------------
  await t.check('create plan — everything missing', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin', body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'slug', fieldCode: 'FIELD_REQUIRED', minFields: 2 },
  });
  await t.check('create plan — name missing', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin', body: { slug: `x-${stamp}` },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('create plan — negative price', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: `x-${stamp}`, name: 'X', priceMonthly: -5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'priceMonthly' },
  });
  await t.check('create plan — price not a number', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: `x-${stamp}`, name: 'X', priceYearly: 'free' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'priceYearly', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('create plan — currency invalid', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: `x-${stamp}`, name: 'X', currency: '###' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'currency', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('create plan — features not a string list', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: `x-${stamp}`, name: 'X', features: [1, 2] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'features', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('create plan — maxPages below -1', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: `x-${stamp}`, name: 'X', maxPages: -9 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'maxPages' },
  });
  await t.check('create plan — sortOrder not an integer', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: `x-${stamp}`, name: 'X', sortOrder: 1.5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sortOrder', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('create plan — slug way too long', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: 'a'.repeat(300), name: 'X' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'slug', fieldCode: 'FIELD_TOO_LONG' },
  });

  const planSlug = `apitest-plan-${stamp}`;
  const created = await t.ok('create plan', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: {
      slug: planSlug, name: 'Api Test Plan', description: 'temp', priceMonthly: 100, priceYearly: 1000,
      currency: 'DA', maxPages: -1, features: ['a', 'b'], isActive: true, sortOrder: 3,
    },
    expect: { status: 201 },
  });
  const planId = created?.json?.plan?.id;

  await t.check('create plan — duplicate slug', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin',
    body: { slug: planSlug, name: 'Dup' },
    expect: { status: 409, code: 'PLAN_SLUG_TAKEN', noFields: true },
  });

  if (planId) {
    await t.ok('patch plan — name', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin', body: { name: 'Api Test Plan v2' },
    });
    await t.check('patch plan — no changes', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin', body: {},
      expect: { status: 400, code: 'PLAN_NO_CHANGES', noFields: true },
    });
    // MASS ASSIGNMENT: unknown / protected keys must be ignored (=> NO_CHANGES), never 500.
    await t.check('patch plan — mass assignment (unknown keys only)', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin',
      body: { id: 'hacked', userId: 'hacked', createdAt: '2000-01-01T00:00:00Z', bogus: 1, subscriberCount: 99 },
      expect: { status: 400, code: 'PLAN_NO_CHANGES', noFields: true },
    });
    const massOk = await t.ok('patch plan — unknown keys alongside a real one', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin',
      body: { name: 'Api Test Plan v3', id: 'hacked', createdAt: '2000-01-01T00:00:00Z', bogus: { deep: true } },
    });
    if (massOk?.json?.plan) {
      const p = massOk.json.plan;
      const bad = [];
      if (p.id !== planId) bad.push(`id was overwritten: ${p.id}`);
      if (p.bogus !== undefined) bad.push('unknown key `bogus` was persisted');
      if (new Date(p.createdAt).getFullYear() === 2000) bad.push('createdAt was overwritten');
      t.results.push({
        label: `${t.currentModule} › patch plan — protected columns untouched`,
        ok: bad.length === 0, issues: bad, status: massOk.status,
      });
    }
    await t.check('patch plan — invalid slug characters', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin', body: { slug: '!!!' },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'slug', fieldCode: 'FIELD_INVALID' },
    });
    await t.check('patch plan — isActive wrong type', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin', body: { isActive: 'yes' },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive', fieldCode: 'FIELD_INVALID' },
    });
    await t.check('patch plan — negative sortOrder', {
      method: 'PATCH', path: `/api/admin/plans/${planId}`, auth: 'admin', body: { sortOrder: -3 },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sortOrder' },
    });
  }

  // -------------------------------------------------------------------------
  // 7. Subscriptions
  // -------------------------------------------------------------------------
  await t.check('create subscription — required fields missing', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin', body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'userId', fieldCode: 'FIELD_REQUIRED', minFields: 2 },
  });
  await t.check('create subscription — invalid billingCycle', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug, billingCycle: 'weekly' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'billingCycle', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('create subscription — invalid status', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug, status: 'paused' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('create subscription — invalid startDate', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug, startDate: 'yesterday' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('create subscription — unknown user', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: MISSING, planSlug },
    expect: { status: 404, code: 'USER_NOT_FOUND', noFields: true },
  });
  await t.check('create subscription — unknown plan', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug: 'no-such-plan-xyz' },
    expect: { status: 404, code: 'PLAN_NOT_FOUND', noFields: true },
  });
  await t.check('create subscription — end before start', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug, startDate: '2025-06-01', endDate: '2025-01-01' },
    expect: { status: 400, code: 'INVALID_DATE_RANGE', noFields: true },
  });

  const sub = await t.ok('create subscription', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug, billingCycle: 'monthly', status: 'active', notes: 'apitest' },
    expect: { status: 201 },
  });
  const subId = sub?.json?.subscription?.id;

  await t.check('create subscription — second active for same user', {
    method: 'POST', path: '/api/admin/subscriptions', auth: 'admin',
    body: { userId: t.ctx.userId, planSlug, status: 'active' },
    expect: { status: 422, code: 'SUBSCRIPTION_ALREADY_ACTIVE', noFields: true },
  });

  if (planId) {
    await t.check('delete plan still in use', {
      method: 'DELETE', path: `/api/admin/plans/${planId}`, auth: 'admin',
      expect: { status: 422, code: 'PLAN_IN_USE', noFields: true },
    });
  }

  if (subId) {
    await t.ok('list subscriptions filtered', { path: `/api/admin/subscriptions?planSlug=${planSlug}&status=active`, auth: 'admin' });
    await t.check('list subscriptions — invalid expiringBefore', {
      path: '/api/admin/subscriptions?expiringBefore=not-a-date', auth: 'admin',
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'expiringBefore', fieldCode: 'FIELD_INVALID_DATE' },
    });
    await t.check('patch subscription — no changes', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin', body: {},
      expect: { status: 400, code: 'SUBSCRIPTION_NO_CHANGES', noFields: true },
    });
    // MASS ASSIGNMENT
    await t.check('patch subscription — mass assignment (unknown keys only)', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin',
      body: { id: 'hacked', userId: 'hacked', createdAt: '2000-01-01T00:00:00Z', bogus: 1 },
      expect: { status: 400, code: 'SUBSCRIPTION_NO_CHANGES', noFields: true },
    });
    const subMass = await t.ok('patch subscription — unknown keys alongside a real one', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin',
      body: { notes: 'updated', id: 'hacked', userId: 'hacked', createdAt: '2000-01-01T00:00:00Z' },
    });
    if (subMass?.json?.subscription) {
      const s = subMass.json.subscription;
      const bad = [];
      if (s.id !== subId) bad.push(`id was overwritten: ${s.id}`);
      if (s.userId !== t.ctx.userId) bad.push(`userId was overwritten: ${s.userId}`);
      if (new Date(s.createdAt).getFullYear() === 2000) bad.push('createdAt was overwritten');
      t.results.push({
        label: `${t.currentModule} › patch subscription — protected columns untouched`,
        ok: bad.length === 0, issues: bad, status: subMass.status,
      });
    }
    await t.check('patch subscription — invalid status enum', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin', body: { status: 'zombie' },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
    });
    await t.check('patch subscription — invalid endDate', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin', body: { endDate: 'soon' },
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'endDate', fieldCode: 'FIELD_INVALID_DATE' },
    });
    await t.check('patch subscription — unknown planSlug', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin', body: { planSlug: 'no-such-plan-xyz' },
      expect: { status: 404, code: 'PLAN_NOT_FOUND', noFields: true },
    });
    await t.check('patch subscription — end before start', {
      method: 'PATCH', path: `/api/admin/subscriptions/${subId}`, auth: 'admin',
      body: { startDate: '2025-06-01', endDate: '2025-01-01' },
      expect: { status: 400, code: 'INVALID_DATE_RANGE', noFields: true },
    });
    await t.ok('delete subscription', { method: 'DELETE', path: `/api/admin/subscriptions/${subId}`, auth: 'admin' });
    await t.check('delete subscription twice', {
      method: 'DELETE', path: `/api/admin/subscriptions/${subId}`, auth: 'admin',
      expect: { status: 404, code: 'SUBSCRIPTION_NOT_FOUND' },
    });
  }

  // Now the plan is free of active subs but users may still carry plan=slug.
  if (planId) {
    // put the seeded user back on a normal plan so the plan can be deleted
    await t.ok('reset user plan', {
      method: 'PATCH', path: `/api/admin/users/${t.ctx.userId}`, auth: 'admin', body: { plan: 'individual' },
    });
    await t.ok('delete plan', { method: 'DELETE', path: `/api/admin/plans/${planId}`, auth: 'admin' });
    await t.check('delete plan twice', {
      method: 'DELETE', path: `/api/admin/plans/${planId}`, auth: 'admin',
      expect: { status: 404, code: 'PLAN_NOT_FOUND' },
    });
  }

  // -------------------------------------------------------------------------
  // 8. CMS
  // -------------------------------------------------------------------------
  await t.check('cms create — all fields missing', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin', body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'slug', fieldCode: 'FIELD_REQUIRED', minFields: 3 },
  });
  await t.check('cms create — invalid category enum', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin',
    body: { slug: `apitest-cms-${stamp}`, title: 'T', category: 'blog', content: 'body' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('cms create — bad slug format', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin',
    body: { slug: 'Not A Slug!', title: 'T', category: 'legal', content: 'body' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'slug', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('cms create — empty content', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin',
    body: { slug: `apitest-cms-${stamp}`, title: 'T', category: 'legal', content: '   ' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'content', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('cms create — negative sortOrder', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin',
    body: { slug: `apitest-cms-${stamp}`, title: 'T', category: 'legal', content: 'x', sortOrder: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sortOrder' },
  });

  const cmsSlug = `apitest-cms-${stamp}`;
  await t.ok('cms create', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin',
    body: { slug: cmsSlug, title: 'Api Test Page', category: 'legal', content: 'hello', isPublished: true, sortOrder: 2 },
  });
  await t.ok('cms upsert same slug (update)', {
    method: 'POST', path: '/api/admin/cms', auth: 'admin',
    body: { slug: cmsSlug, title: 'Api Test Page v2', category: 'company', content: 'hello again' },
  });
  await t.ok('cms get by slug', { path: `/api/admin/cms/${cmsSlug}`, auth: 'admin' });
  await t.ok('cms list by category', { path: '/api/admin/cms?category=company', auth: 'admin' });
  await t.ok('cms delete', { method: 'DELETE', path: `/api/admin/cms/${cmsSlug}`, auth: 'admin' });
  await t.check('cms delete twice', {
    method: 'DELETE', path: `/api/admin/cms/${cmsSlug}`, auth: 'admin',
    expect: { status: 404, code: 'CMS_PAGE_NOT_FOUND' },
  });

  // -------------------------------------------------------------------------
  // 9. AI providers (never with a real key)
  // -------------------------------------------------------------------------
  await t.check('ai provider update — unknown provider', {
    method: 'PUT', path: '/api/admin/ai-providers/skynet', auth: 'admin', body: { isActive: true },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('ai provider update — apiKey wrong type', {
    method: 'PUT', path: '/api/admin/ai-providers/openai', auth: 'admin', body: { apiKey: 12345 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'apiKey', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai provider update — isActive wrong type', {
    method: 'PUT', path: '/api/admin/ai-providers/openai', auth: 'admin', body: { isActive: 'yes' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai provider update — models not a string list', {
    method: 'PUT', path: '/api/admin/ai-providers/openai', auth: 'admin', body: { models: [1, ''] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'models', fieldCode: 'FIELD_INVALID' },
  });
  await t.check('ai provider test — unknown provider', {
    method: 'POST', path: '/api/admin/ai-providers/skynet/test', auth: 'admin',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'provider', fieldCode: 'FIELD_INVALID_ENUM' },
  });

  // The no-key / not-found branch: whichever applies for this DB, it must be a
  // clean 4xx (never a 500 and never an outbound call with a real key).
  const provList = await t.raw({ path: '/api/admin/ai-providers', auth: 'admin' });
  const rows = provList?.json?.providers || [];
  const keyless = rows.find((p) => !p.apiKey);
  const target = keyless ? keyless.provider : null;
  if (target) {
    await t.check(`ai provider test — ${target} has no key`, {
      method: 'POST', path: `/api/admin/ai-providers/${target}/test`, auth: 'admin',
      expect: { status: 400, code: 'AI_PROVIDER_NO_KEY', noFields: true },
    });
  } else if (rows.length === 0) {
    await t.check('ai provider test — provider row absent', {
      method: 'POST', path: '/api/admin/ai-providers/openai/test', auth: 'admin',
      expect: { status: 404, code: 'AI_PROVIDER_NOT_FOUND', noFields: true },
    });
  } else {
    t.results.push({
      label: `${t.currentModule} › ai provider test — no-key branch skipped (every provider row has a key; will not call a real API)`,
      ok: true, issues: [],
    });
  }

  // -------------------------------------------------------------------------
  // 10. LEGACY /api/stock/{pageId}/... — the seeded account owns no page,
  //     so every route must answer 404 PAGE_NOT_FOUND (never 500, never 200).
  // -------------------------------------------------------------------------
  const P = MISSING;          // page id that exists nowhere
  const ID = MISSING;
  const LEGACY = [
    ['GET', `/api/stock/${P}/dashboard`],
    ['GET', `/api/stock/${P}/categories`],
    ['POST', `/api/stock/${P}/categories`, { name: 'Cat' }],
    ['PUT', `/api/stock/${P}/categories/${ID}`, { name: 'Cat2' }],
    ['DELETE', `/api/stock/${P}/categories/${ID}`],
    ['GET', `/api/stock/${P}/products`],
    ['GET', `/api/stock/${P}/products/${ID}`],
    ['POST', `/api/stock/${P}/products`, { name: 'P', sku: `S-${stamp}`, costPrice: 10, sellingPrice: 20, quantity: 1 }],
    ['PUT', `/api/stock/${P}/products/${ID}`, { name: 'P2' }],
    ['DELETE', `/api/stock/${P}/products/${ID}`],
    ['POST', `/api/stock/${P}/products/${ID}/adjust`, { quantity: 5, type: 'in', reason: 'test' }],
    ['GET', `/api/stock/${P}/movements`],
    ['GET', `/api/stock/${P}/suppliers`],
    ['POST', `/api/stock/${P}/suppliers`, { name: 'Sup' }],
    ['PUT', `/api/stock/${P}/suppliers/${ID}`, { name: 'Sup2' }],
    ['DELETE', `/api/stock/${P}/suppliers/${ID}`],
    ['GET', `/api/stock/${P}/sales`],
    ['GET', `/api/stock/${P}/sales/stats`],
    ['GET', `/api/stock/${P}/sales/${ID}`],
    ['POST', `/api/stock/${P}/sales`, { items: [{ productId: ID, quantity: 1, unitPrice: 10 }] }],
    ['PUT', `/api/stock/${P}/sales/${ID}`, { paidAmount: 10 }],
    ['GET', `/api/stock/${P}/purchases`],
    ['GET', `/api/stock/${P}/purchases/stats`],
    ['GET', `/api/stock/${P}/purchases/${ID}`],
    ['POST', `/api/stock/${P}/purchases`, { supplierId: ID, items: [{ productId: ID, quantity: 1, unitCost: 5 }] }],
    ['PUT', `/api/stock/${P}/purchases/${ID}`, { status: 'received' }],
    ['POST', `/api/stock/${P}/purchases/${ID}/receive`, { items: [{ itemId: ID, receivedQty: 1 }] }],
  ];

  for (const [method, path, body] of LEGACY) {
    await t.check(`LEGACY ${method} ${path.replace(P, '{pageId}').replace(ID, '{id}')}`, {
      method, path, body, auth: true,
      expect: { status: 404, code: 'PAGE_NOT_FOUND', noFields: true },
    });
    await t.check(`LEGACY no token ${method} ${path.replace(P, '{pageId}').replace(ID, '{id}')}`, {
      method, path, body, token: null,
      expect: { status: 401, code: 'UNAUTHORIZED', noFields: true },
    });
  }

  // IDOR: if the OTHER user somehow owns a page, our token must never reach it.
  // We prove it the other way round: build a real page for user A (if the API
  // allows it) is out of scope here, so we assert that a page id belonging to
  // ANY other tenant is refused. `/api/admin/lookups/pages` (admin) gives us
  // real page ids across the platform — the perfect IDOR probe.
  // Make sure a foreign page really exists (the API has no "create page"
  // endpoint outside the Meta OAuth flow, so we insert one for the SECOND
  // seeded merchant directly and then attack it with the FIRST one's token).
  let prisma = null;
  let seededPageId = null;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    const foreignProduct = t.ctx.foreignProductId
      ? await prisma.product.findUnique({ where: { id: t.ctx.foreignProductId }, select: { userId: true } })
      : null;
    const otherUserId = foreignProduct?.userId;
    if (!otherUserId) throw new Error('cannot resolve the second merchant id');
    if (otherUserId) {
      const row = await prisma.page.create({
        data: {
          platform: 'facebook', pageId: `apitest-${stamp}`, pageName: 'IDOR victim page',
          pageAccessToken: 'x', userId: otherUserId, isActive: true,
        },
      });
      seededPageId = row.id;
    }
  } catch (err) {
    t.results.push({ label: `${t.currentModule} › seed foreign page for IDOR probe`, ok: false, issues: [String(err.message).slice(0, 200)] });
  }

  const pagesRes = await t.raw({ path: '/api/admin/lookups/pages', auth: 'admin' });
  const foreignPages = (pagesRes?.json?.pages || []).filter((p) => p.userId !== t.ctx.userId);
  if (foreignPages.length > 0) {
    const fp = foreignPages[0].id;
    for (const [method, path, body] of [
      ['GET', `/api/stock/${fp}/dashboard`],
      ['GET', `/api/stock/${fp}/products`],
      ['GET', `/api/stock/${fp}/sales`],
      ['GET', `/api/stock/${fp}/purchases`],
      ['GET', `/api/stock/${fp}/movements`],
      ['POST', `/api/stock/${fp}/categories`, { name: 'IDOR' }],
    ]) {
      await t.check(`IDOR ${method} foreign page ${path.split('/').pop()}`, {
        method, path, body, auth: true,
        expect: { status: 404, code: 'PAGE_NOT_FOUND', noFields: true },
      });
    }
    if (fp === seededPageId) {
      // Same page, its real owner: proves the 404 above is an ownership check
      // and not simply a broken route.
      await t.ok('IDOR control — the page OWNER can read the same page', {
        path: `/api/stock/${fp}/dashboard`, token: t.tokens.other,
      });
    }
  } else {
    t.results.push({
      label: `${t.currentModule} › IDOR probe skipped (no page rows exist in this DB)`,
      ok: true, issues: [],
    });
  }

  if (prisma) {
    try {
      if (seededPageId) await prisma.page.delete({ where: { id: seededPageId } });
    } catch { /* best effort */ }
    await prisma.$disconnect();
  }

  // -------------------------------------------------------------------------
  // 11. Three languages on 6+ codes
  // -------------------------------------------------------------------------
  const I18N = [
    ['ADMIN_REQUIRED', { path: '/api/admin/users', auth: true }, 403, 'ADMIN_REQUIRED'],
    ['UNAUTHORIZED', { path: '/api/admin/users', token: null }, 401, 'UNAUTHORIZED'],
    ['USER_NOT_FOUND', { path: `/api/admin/users/${MISSING}`, auth: 'admin' }, 404, 'USER_NOT_FOUND'],
    ['PLAN_NOT_FOUND', { method: 'DELETE', path: `/api/admin/plans/${MISSING}`, auth: 'admin' }, 404, 'PLAN_NOT_FOUND'],
    ['SUBSCRIPTION_NOT_FOUND', { method: 'DELETE', path: `/api/admin/subscriptions/${MISSING}`, auth: 'admin' }, 404, 'SUBSCRIPTION_NOT_FOUND'],
    ['CMS_PAGE_NOT_FOUND', { path: '/api/admin/cms/nope-xyz', auth: 'admin' }, 404, 'CMS_PAGE_NOT_FOUND'],
    ['CONVERSATION_NOT_FOUND', { path: `/api/admin/conversations/${MISSING}`, auth: 'admin' }, 404, 'CONVERSATION_NOT_FOUND'],
    ['PAGE_NOT_FOUND', { path: `/api/stock/${MISSING}/dashboard`, auth: true }, 404, 'PAGE_NOT_FOUND'],
    ['VALIDATION_FAILED', { method: 'POST', path: '/api/admin/plans', auth: 'admin', body: {} }, 400, 'VALIDATION_FAILED'],
  ];
  const seenMessages = {};
  for (const [name, opts, status, code] of I18N) {
    for (const lang of ['en', 'fr', 'ar']) {
      const r = await t.check(`i18n ${lang} ${name}`, {
        ...opts, lang,
        expect: { status, code, ...(code === 'VALIDATION_FAILED' ? { field: 'slug' } : { noFields: true }) },
      });
      seenMessages[name] = seenMessages[name] || {};
      if (r?.json?.message) seenMessages[name][lang] = r.json.message;
    }
    const m = seenMessages[name] || {};
    const distinct = new Set([m.en, m.fr, m.ar].filter(Boolean));
    t.results.push({
      label: `${t.currentModule} › i18n ${name} — en/fr/ar really differ`,
      ok: distinct.size === 3,
      issues: distinct.size === 3 ? [] : [`only ${distinct.size} distinct message(s): ${JSON.stringify(m)}`],
    });
  }

  // Query-param language selector must work too.
  await t.check('i18n ?lang=ar overrides Accept-Language', {
    path: `/api/admin/users/${MISSING}?lang=ar`, auth: 'admin', headers: { 'Accept-Language': 'fr' },
    expect: { status: 404, code: 'USER_NOT_FOUND' }, lang: 'ar',
  });

  // -------------------------------------------------------------------------
  // 12. Malformed payloads must never 500
  // -------------------------------------------------------------------------
  await t.check('malformed JSON body', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin', body: '{"slug": ',
    headers: { 'Content-Type': 'application/json' },
    expect: { status: 400, code: 'INVALID_JSON' },
  });
  await t.check('array instead of object', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin', body: [1, 2, 3],
    expect: { status: 400, code: 'VALIDATION_FAILED' },
  });
  await t.check('deeply nested junk value', {
    method: 'POST', path: '/api/admin/plans', auth: 'admin', body: { slug: { a: { b: 1 } }, name: ['x'] },
    expect: { status: 400, code: 'VALIDATION_FAILED' },
  });
};
