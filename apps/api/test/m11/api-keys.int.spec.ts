// M11 — API-01 / API-02 (03 §18, 06 §5, api-contract §1.2 / §1.9): API keys (create shown once, SHA-256 stored, scopes,
// revoke, plan limits) and the endpoint whitelist per scope. AT-API-01.
import { asAdmin, asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { createProduct } from '../support/m2';
import { forbidNetwork } from '../support/m3';
import { idem, orderBody, seedFees } from '../support/m5';
import { db, withKey } from '../support/m11';

let app: TestApp;
let net: ReturnType<typeof forbidNetwork>;
beforeAll(async () => {
  app = await createTestApp();
  net = forbidNetwork();
});
afterAll(async () => {
  net.restore();
  await app.close();
});

const newKey = async (owner: Awaited<ReturnType<typeof asOwner>>, scopes: string[], environment = 'live') =>
  (await owner.post('/api-keys', { name: `Clé ${scopes.length} portées`, scopes, environment }).expect(201)).body.data as Record<string, any>;

describe('API keys (API-01)', () => {
  it('create ⇒ full key once (dj_live_ / dj_test_), only its SHA-256 stored, prefix shown, list + allowance, audit; revoke ⇒ 401 API_KEY_REVOKED', async () => {
    const owner = await asOwner(app);
    const created = await newKey(owner, ['orders:read', 'products:read']);
    expect(created.key).toMatch(/^dj_live_[A-Za-z0-9_-]{40,}$/);
    expect(created).toMatchObject({ environment: 'live', status: 'active', scopes: ['orders:read', 'products:read'], prefix: created.key.slice(0, 16), lastUsedAt: null });
    const row = await db.apiKey.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.keyHash).not.toContain(created.key);
    expect(JSON.stringify(row)).not.toContain(created.key);
    const test = await newKey(owner, ['orders:read'], 'test');
    expect(test.key).toMatch(/^dj_test_/);

    const list = (await owner.get('/api-keys').expect(200)).body.data;
    expect(list).toMatchObject({ used: 2, limit: 5, featureEnabled: true, rateLimitPerMinute: 600 });
    expect(list.keys.map((k: any) => k.id).sort()).toEqual([created.id, test.id].sort());
    expect(list.keys.every((k: any) => !('key' in k))).toBe(true);
    expect(await db.auditLog.count({ where: { workspaceId: owner.workspaceId, action: 'api_key.create' } })).toBe(2);

    // the key works, last use recorded
    await withKey(app, created.key).get('/orders').expect(200);
    expect((await db.apiKey.findUniqueOrThrow({ where: { id: created.id } })).lastUsedAt).not.toBeNull();

    const revoked = (await owner.post(`/api-keys/${created.id}/revoke`, {}).expect(200)).body.data;
    expect(revoked).toMatchObject({ status: 'revoked', actions: [{ key: 'revoke', enabled: false }] });
    expect((await owner.post(`/api-keys/${created.id}/revoke`, {}).expect(409)).body.error.code).toBe('CONFLICT');
    expect((await withKey(app, created.key).get('/orders').expect(401)).body.error.code).toBe('API_KEY_REVOKED');
    expect((await withKey(app, 'dj_live_unknownunknownunknownunknown').get('/orders').expect(401)).body.error.code).toBe('UNAUTHORIZED');
  });

  it('422 on invalid body; 403 per role (Operator); cross-workspace 404; plan without the feature ⇒ PLAN_FEATURE_REQUIRED; at the limit ⇒ PLAN_LIMIT', async () => {
    const owner = await asOwner(app);
    expect((await owner.post('/api-keys', { name: '', scopes: [] }).expect(422)).body.error.fields).toMatchObject({ name: 'validation.required', scopes: 'validation.required' });
    expect((await owner.post('/api-keys', { name: 'x', scopes: ['admin:all'] }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');
    const op = await asOperator(app, owner.workspaceId);
    expect((await op.get('/api-keys').expect(403)).body.error.code).toBe('FORBIDDEN');
    expect((await op.post('/api-keys', { name: 'x', scopes: ['orders:read'] }).expect(403)).body.error.code).toBe('FORBIDDEN');
    const admin = await asAdmin(app, owner.workspaceId);
    const k = await newKey(admin as never, ['orders:read']);
    const other = await asOwner(app);
    await other.post(`/api-keys/${k.id}/revoke`, {}).expect(404);

    const starter = await asOwner(app, 'starter');
    expect((await starter.post('/api-keys', { name: 'x', scopes: ['orders:read'] }).expect(403)).body.error).toMatchObject({ code: 'PLAN_FEATURE_REQUIRED', params: { feature: 'api_keys' } });
    expect((await starter.get('/api-keys').expect(200)).body.data).toMatchObject({ featureEnabled: false, actions: [{ key: 'create', enabled: false, reasonCode: 'PLAN_FEATURE_REQUIRED' }] });

    for (let i = 0; i < 4; i++) await newKey(owner, ['orders:read']);
    expect((await owner.post('/api-keys', { name: 'sixième', scopes: ['orders:read'] }).expect(403)).body.error).toMatchObject({ code: 'PLAN_LIMIT', params: { resource: 'api_keys', limit: 5, current: 5 } });
  });
});

describe('scope whitelist (API-02, 06 §5)', () => {
  it('AT-API-01 key with orders:read calling POST /orders ⇒ 403 API_SCOPE_FORBIDDEN; GET /billing/* ⇒ 403 always; account / admin / integrations routes refused', async () => {
    const owner = await asOwner(app);
    await seedFees(app, owner.workspaceId);
    const product = await createProduct(owner, { name: 'Robe API', price: 3000, stock: 5 });
    const read = withKey(app, (await newKey(owner, ['orders:read'])).key);
    expect((await read.post('/orders', orderBody(product.id)).set(idem()).expect(403)).body.error).toMatchObject({ code: 'API_SCOPE_FORBIDDEN', params: { scope: 'orders:write' } });
    await read.get('/orders').expect(200);

    const all = withKey(app, (await newKey(owner, ['orders:read', 'orders:write', 'products:read', 'products:write', 'customers:read', 'customers:write', 'conversations:read', 'conversations:reply', 'delivery:read', 'analytics:read', 'webhooks:manage'])).key);
    for (const url of ['/billing/subscription', '/billing/invoices', '/credits', '/workspace', '/workspace/members', '/agents', '/channels', '/api-keys', '/integrations/google-sheets', '/admin/workspaces', '/me', '/legal/pending', '/jobs']) {
      const res = await all.get(url);
      expect([url, res.status, res.body.error?.code]).toEqual([url, 403, 'API_SCOPE_FORBIDDEN']);
    }
    // whitelisted reads and writes
    for (const url of ['/products', '/categories', '/units', '/stock/movements', '/clients', '/conversations', '/delivery/fees', '/shipments', '/analytics/overview', '/webhooks']) {
      const res = await all.get(url);
      expect([url, res.status]).toEqual([url, 200]);
    }
    const created = await all.post('/orders', orderBody(product.id)).set(idem()).expect(201);
    expect(created.body.data.source).toMatchObject({ source: 'api', apiKeyName: 'Clé 11 portées' });
    // categories writes are not in 06 §5 ⇒ refused even with products:write
    expect((await all.post('/categories', { name: 'Robes' }).expect(403)).body.error.code).toBe('API_SCOPE_FORBIDDEN');
    // X-Workspace-Id is ignored: the key is bound to its workspace
    const other = await asOwner(app);
    const res = await all.get(`/orders/${created.body.data.id}`).set('X-Workspace-Id', other.workspaceId).expect(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it('600 requests / min / key with X-RateLimit-* headers', async () => {
    const owner = await asOwner(app);
    const k = await newKey(owner, ['orders:read']);
    const res = await withKey(app, k.key).get('/orders').expect(200);
    expect(res.headers['x-ratelimit-limit']).toBe('600');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBe(599);
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(Date.now() / 1000);
    const redis = (app.app.get(require('../../src/core/redis/redis.provider').RedisService) as any).client;
    const windowStart = Math.floor(Date.now() / 60_000) * 60;
    await redis.set(`rl:api-key:${k.id}:${windowStart}`, '600', 'EX', 61);
    const limited = await withKey(app, k.key).get('/orders');
    if (Math.floor(Date.now() / 60_000) * 60 === windowStart) {
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    }
  });
});
