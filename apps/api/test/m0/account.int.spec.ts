import { rawPrisma } from '@djaber/db';
import { createTestApp, type TestApp } from '../support/app';
import { anonymous, asLoneUser, asMember, asOwner } from '../support/actors';

describe('M0 — mobile-facing account endpoints', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /workspaces lists the memberships of the user with role and plan', async () => {
    const a = await asOwner(app, 'starter');
    const b = await asOwner(app);
    const guest = await asMember(app, b.workspaceId, 'operator');
    const mine = await a.get('/workspaces');
    expect(mine.status).toBe(200);
    expect(mine.body.data).toEqual([expect.objectContaining({ id: a.workspaceId, role: 'owner', status: 'active', planSlug: 'starter' })]);
    const theirs = await guest.get('/workspaces');
    expect(theirs.body.data).toEqual([expect.objectContaining({ id: b.workspaceId, role: 'operator', planSlug: 'pro' })]);
    expect((await (await asLoneUser(app)).get('/workspaces')).body.data).toEqual([]);
    expect((await anonymous(app).get('/workspaces')).status).toBe(401);
  });

  it('POST /me/devices upserts on token, enforces 20 devices, DELETE removes only own token', async () => {
    const u = await asLoneUser(app);
    const first = await u.post('/me/devices', { token: 'tok-aaaaaaaa-1', platform: 'android', appVersion: '1.0.0', locale: 'ar' });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ token: 'tok-aaaaaaaa-1', platform: 'android', locale: 'ar' });
    await u.post('/me/devices', { token: 'tok-aaaaaaaa-1', platform: 'android', appVersion: '1.0.1' });
    expect(await rawPrisma.deviceToken.count({ where: { userId: u.userId } })).toBe(1);

    await rawPrisma.deviceToken.createMany({
      data: Array.from({ length: 19 }, (_, i) => ({ userId: u.userId, token: `bulk-${u.userId}-${i}`, platform: 'ios' as const })),
    });
    const over = await u.post('/me/devices', { token: 'tok-overflow-1', platform: 'ios' });
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({ code: 'DEVICE_LIMIT', params: { max: 20 } });

    const other = await asLoneUser(app);
    expect((await other.delete('/me/devices/tok-aaaaaaaa-1')).status).toBe(204);
    expect(await rawPrisma.deviceToken.count({ where: { token: 'tok-aaaaaaaa-1' } })).toBe(1);
    expect((await u.delete('/me/devices/tok-aaaaaaaa-1')).status).toBe(204);
    expect(await rawPrisma.deviceToken.count({ where: { token: 'tok-aaaaaaaa-1' } })).toBe(0);

    const bad = await u.post('/me/devices', { token: 'x', platform: 'windows' });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['platform', 'token']);
  });
});
