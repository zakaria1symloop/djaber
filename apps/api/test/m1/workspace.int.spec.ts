// M1 — workspaces: profile & settings, POST /workspaces (D30), ownership transfer (D51), danger zone (FL-14),
// onboarding (ONB-01 / ONB-02), switching (`User.lastWorkspaceId`), GET /me workspace summary.
import sharp from 'sharp';
import { WorkerRunner } from '../../src/worker/worker.runner';
import { ProcessorRegistry } from '../../src/core/queue/processor.registry';
import { ConfigService } from '../../src/core/config/config.service';
import { TwoFactorService } from '../../src/modules/auth/two-factor.service';
import { WorkspaceDeletionService } from '../../src/modules/workspace/workspace-deletion.service';
import { anonymous, asAdmin, asLoneUser, asMember, asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { api, db, eventually, mailsTo, PASSWORD, register, setPassword } from '../support/m1';
import { drain } from '../support/m2';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

const DAY = 86_400_000;

describe('GET / PATCH /workspace', () => {
  it('returns the WorkspaceDto of the contract with plan limits and real usage', async () => {
    const owner = await register(app);
    const res = await owner.get('/workspace').expect(200);
    const ws = res.body.data;
    expect(ws).toMatchObject({
      id: owner.workspaceId,
      logoUrl: null,
      phone: null,
      locale: 'fr',
      timezone: 'Africa/Algiers',
      stockMode: 'simple',
      onboardingStep: 1,
      freeDeliveryThreshold: null,
      autoPauseOnManualReply: true,
      handoffReminderMin: 30,
      targetMarginPct: 35,
      status: 'active',
      suspendReason: null,
      deletionScheduledAt: null,
      trustLevel: 'new',
      version: 1,
    });
    expect(Object.keys(ws.systemMessages).sort()).toEqual(['handoff', 'out_of_hours', 'out_of_stock', 'welcome']);
    expect(ws.plan).toMatchObject({ slug: 'pro', status: 'trial', usage: { pages: 0, agents: 0, products: 0, conversationsThisMonth: 0, members: 1, creditsUsed: 0 } });
    expect(ws.plan.limits).toMatchObject({ maxPages: 5, maxAgents: 5, maxMembers: 10, monthlyCredits: 5000, maxProducts: -1 });
    expect(ws.plan.limits.features).toContain('api_keys');
    await anonymous(app).get('/workspace').expect(401);
  });

  it('PATCH: validation (422 with fields), permission matrix, version conflict, audit', async () => {
    const owner = await asOwner(app);
    const admin = await asAdmin(app, owner.workspaceId);
    const operator = await asOperator(app, owner.workspaceId);

    const bad = await owner.patch('/workspace', { name: '', phone: '12', handoffReminderMin: -1, freeDeliveryThreshold: 1.5, targetMarginPct: 101, senderWilayaId: 70, stockMode: 'pro' }).expect(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.fields).toMatchObject({ name: 'validation.required', phone: 'validation.phone', handoffReminderMin: 'validation.range', freeDeliveryThreshold: 'validation.price', targetMarginPct: 'validation.range', senderWilayaId: 'validation.wilaya' });
    await owner.patch('/workspace', { status: 'active' }).expect(422); // unknown / forbidden field
    await owner.patch('/workspace', { workspaceId: admin.workspaceId }).expect(422);

    const ok = await owner
      .patch('/workspace', { name: 'Boutique Sétif', phone: '0555 12 34 56', address: 'Cité 1000 logements', senderWilayaId: 19, locale: 'ar', stockMode: 'advanced', freeDeliveryThreshold: 12500, autoPauseOnManualReply: false, handoffReminderMin: 0, targetMarginPct: 40, version: 1 })
      .expect(200);
    expect(ok.body.data).toMatchObject({ name: 'Boutique Sétif', phone: '0555123456', senderWilayaId: 19, locale: 'ar', stockMode: 'advanced', freeDeliveryThreshold: 12500, autoPauseOnManualReply: false, handoffReminderMin: 0, targetMarginPct: 40, version: 2 });

    // admin may edit, operator may only read
    expect((await admin.patch('/workspace', { freeDeliveryThreshold: null }).expect(200)).body.data).toMatchObject({ freeDeliveryThreshold: null, version: 3 });
    expect((await operator.patch('/workspace', { name: 'Hack' }).expect(403)).body.error.code).toBe('FORBIDDEN');
    expect((await operator.get('/workspace').expect(200)).body.data.name).toBe('Boutique Sétif');

    // stale version ⇒ 409 CONFLICT with the current resource
    const stale = await owner.patch('/workspace', { name: 'Ancien', version: 1 }).expect(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect(stale.body.error.details.current).toMatchObject({ name: 'Boutique Sétif', version: 3 });
    // a no-op does not bump the version
    expect((await owner.patch('/workspace', { name: 'Boutique Sétif', version: 3 }).expect(200)).body.data.version).toBe(3);

    const audit = await eventually(() => db.auditLog.findFirst({ where: { workspaceId: owner.workspaceId, action: 'workspace.update' }, orderBy: { at: 'asc' } }));
    expect(audit).toMatchObject({ actorId: owner.userId, entity: 'Workspace', entityId: owner.workspaceId });
    expect(audit!.after).toMatchObject({ stockMode: 'advanced', locale: 'ar' });
    // the tenant context cache follows the new settings
    expect((await owner.get('/me').expect(200)).body.data.workspace).toMatchObject({ stockMode: 'advanced', locale: 'ar' });
    // a WS event is queued for the workspace room
    const events = await db.outbox.findMany({ where: { topic: 'ws' }, orderBy: { createdAt: 'desc' }, take: 20 });
    expect(events.some((e) => (e.payload as any).room === `ws:${owner.workspaceId}` && (e.payload as any).event === 'workspace.updated')).toBe(true);
  });

  it('read-only member ⇒ 403 READ_ONLY_MEMBER on mutations, reads allowed', async () => {
    const owner = await asOwner(app);
    const ro = await asMember(app, owner.workspaceId, 'admin', { readOnly: true });
    await ro.get('/workspace').expect(200);
    expect((await ro.patch('/workspace', { name: 'X' }).expect(403)).body.error.code).toBe('READ_ONLY_MEMBER');
    expect((await ro.get('/me').expect(200)).body.data.workspace).toMatchObject({ role: 'admin', readOnly: true });
  });

  it('logo: direct upload, two-step upload, removal; operator ⇒ 403; foreign upload refused', async () => {
    const owner = await asOwner(app);
    const operator = await asOperator(app, owner.workspaceId);
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
    const direct = await api(app).post('/api/v1/workspace/logo').set(owner.headers).attach('file', png, { filename: 'logo.png', contentType: 'image/png' }).expect(200);
    expect(direct.body.data.logoUrl).toContain(`/files/ws/${owner.workspaceId}/logo/`);
    await api(app).post('/api/v1/workspace/logo').set(operator.headers).attach('file', png, { filename: 'logo.png', contentType: 'image/png' }).expect(403);
    await api(app).post('/api/v1/workspace/logo').set(owner.headers).attach('file', Buffer.from('x'), { filename: 'logo.pdf', contentType: 'application/pdf' }).expect(415);

    const up = await api(app).post('/api/v1/uploads').set(owner.headers).field('kind', 'logo').attach('file', png, { filename: 'l.png', contentType: 'image/png' }).expect(201);
    expect((await owner.patch('/workspace', { logoUploadId: up.body.data.id }).expect(200)).body.data.logoUrl).toBe(up.body.data.url);
    await api(app).post('/api/v1/uploads').set(operator.headers).field('kind', 'logo').attach('file', png, { filename: 'l.png', contentType: 'image/png' }).expect(422);
    const other = await asOwner(app);
    await other.patch('/workspace', { logoUploadId: up.body.data.id }).expect(422);
    expect((await owner.patch('/workspace', { logoUploadId: null }).expect(200)).body.data.logoUrl).toBeNull();
  });
});

describe('tenancy & switching', () => {
  it('another workspace id ⇒ 404; a valid explicit X-Workspace-Id is remembered as lastWorkspaceId', async () => {
    const a = await asOwner(app);
    const b = await asOwner(app);
    const res = await api(app).get('/api/v1/workspace').set({ ...a.headers, 'X-Workspace-Id': b.workspaceId }).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    await api(app).patch('/api/v1/workspace').set({ ...a.headers, 'X-Workspace-Id': b.workspaceId }).send({ name: 'Hack' }).expect(404);
    expect((await db.user.findUniqueOrThrow({ where: { id: a.userId } })).lastWorkspaceId).not.toBe(b.workspaceId);

    // a member of two workspaces switches with the header; the choice becomes the default of GET /me
    const guest = await asOperator(app, a.workspaceId);
    await db.membership.create({ data: { workspaceId: b.workspaceId, userId: guest.userId, role: 'admin' } });
    await api(app).get('/api/v1/workspace').set({ ...guest.headers, 'X-Workspace-Id': b.workspaceId }).expect(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: guest.userId } })).lastWorkspaceId).toBe(b.workspaceId);
    const bare = { Authorization: guest.headers.Authorization! };
    expect((await api(app).get('/api/v1/workspace').set(bare).expect(200)).body.data.id).toBe(b.workspaceId);
    const me = await api(app).get('/api/v1/me').set(bare).expect(200);
    expect(me.body.data.workspace).toMatchObject({ id: b.workspaceId, role: 'admin' });
    expect(me.body.data.memberships.map((m: any) => m.workspaceId).sort()).toEqual([a.workspaceId, b.workspaceId].sort());
    // GET /me with an explicit header describes that workspace
    expect((await guest.get('/me').expect(200)).body.data.workspace).toMatchObject({ id: a.workspaceId, role: 'operator' });
    // user without any workspace on a workspace route ⇒ 400 WORKSPACE_REQUIRED
    const lone = await asLoneUser(app);
    expect((await lone.get('/workspace').expect(400)).body.error.code).toBe('WORKSPACE_REQUIRED');
  });
});

describe('POST /workspaces (D30)', () => {
  it('AT-AUTH-10 only a user who owns no workspace may create one, once; same trial as sign-up', async () => {
    const lone = await asLoneUser(app);
    expect((await lone.post('/workspaces', { name: '' }).expect(422)).body.error.fields).toMatchObject({ name: 'validation.required' });
    await lone.post('/workspaces', { name: 'Ma boutique', senderWilayaId: 99 }).expect(422);
    await anonymous(app).post('/workspaces', { name: 'X' }).expect(401);

    const res = await lone.post('/workspaces', { name: 'Ma boutique', senderWilayaId: 16, stockMode: 'advanced' }).expect(201);
    expect(res.body.data).toMatchObject({ name: 'Ma boutique', senderWilayaId: 16, stockMode: 'advanced', onboardingStep: 1 });
    expect(res.body.data.plan).toMatchObject({ slug: 'pro', status: 'trial' });
    const wsId = res.body.data.id;
    const user = await db.user.findUniqueOrThrow({ where: { id: lone.userId } });
    expect(user.ownedWorkspaceId).toBe(wsId);
    expect(await db.membership.findFirst({ where: { workspaceId: wsId, userId: lone.userId } })).toMatchObject({ role: 'owner' });
    expect(await db.creditLedger.findFirst({ where: { workspaceId: wsId } })).toMatchObject({ action: 'grant', credits: 300 });
    expect(await db.quickReply.count({ where: { workspaceId: wsId } })).toBe(4);
    expect((await db.subscription.findFirstOrThrow({ where: { workspaceId: wsId } })).status).toBe('trial');

    const again = await lone.post('/workspaces', { name: 'Deuxième' }).expect(409);
    expect(again.body.error.code).toBe('CONFLICT');
    const owner = await asOwner(app);
    await owner.post('/workspaces', { name: 'Deuxième' }).expect(409);
    // the new workspace is immediately usable
    expect((await lone.get('/workspace').expect(200)).body.data.id).toBe(wsId);
  });
});

describe('ownership transfer (D51)', () => {
  it('AT-AUTH-10 / AT-OWN-transfer: target, password, 2FA rules; roles swapped in one transaction; e-mails; audit', async () => {
    const owner = await register(app);
    const admin = await asAdmin(app, owner.workspaceId);
    const operator = await asOperator(app, owner.workspaceId);
    const outsider = await asOwner(app);
    const url = `/workspaces/${owner.workspaceId}/transfer-ownership`;

    // validation
    expect((await owner.post(url, { newOwnerUserId: 'nope' }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');
    // by an Admin or an Operator ⇒ 403 (Owner only)
    expect((await admin.post(url, { newOwnerUserId: admin.userId, password: PASSWORD }).expect(403)).body.error.code).toBe('FORBIDDEN');
    await operator.post(url, { newOwnerUserId: admin.userId, password: PASSWORD }).expect(403);
    // another workspace id in the path ⇒ 404
    await owner.post(`/workspaces/${outsider.workspaceId}/transfer-ownership`, { newOwnerUserId: admin.userId, password: PASSWORD }).expect(404);
    // target must be an Admin member of this workspace
    for (const target of [operator.userId, outsider.userId, owner.userId]) {
      const res = await owner.post(url, { newOwnerUserId: target, password: PASSWORD }).expect(422);
      expect(res.body.error.code).toBe('OWNERSHIP_TRANSFER_TARGET_INVALID');
    }
    // wrong password
    expect((await owner.post(url, { newOwnerUserId: admin.userId, password: 'Wrong-password-1' }).expect(401)).body.error.code).toBe('AUTH_INVALID_CREDENTIALS');

    // owner with 2FA: code required
    const secret = (await owner.post('/auth/2fa/setup').expect(200)).body.data.secret;
    await owner.post('/auth/2fa/enable', { code: TwoFactorService.codeFor(secret) }).expect(200);
    expect((await owner.post(url, { newOwnerUserId: admin.userId, password: PASSWORD }).expect(403)).body.error.code).toBe('TWO_FA_CONFIRMATION_REQUIRED');
    expect((await owner.post(url, { newOwnerUserId: admin.userId, password: PASSWORD, totpCode: '000002' }).expect(403)).body.error.code).toBe('TWO_FA_CONFIRMATION_REQUIRED');
    expect(await db.membership.count({ where: { workspaceId: owner.workspaceId, role: 'owner' } })).toBe(1);

    const ok = await owner.post(url, { newOwnerUserId: admin.userId, password: PASSWORD, totpCode: TwoFactorService.codeFor(secret) }).expect(200);
    expect(ok.body.data).toEqual({ workspaceId: owner.workspaceId, ownerUserId: admin.userId, previousOwnerUserId: owner.userId });
    const members = await db.membership.findMany({ where: { workspaceId: owner.workspaceId } });
    expect(members.filter((m) => m.role === 'owner').map((m) => m.userId)).toEqual([admin.userId]);
    expect(members.find((m) => m.userId === owner.userId)!.role).toBe('admin');
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.userId } })).ownedWorkspaceId).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.userId } })).ownedWorkspaceId).toBe(owner.workspaceId);

    // the former owner is now an admin: cannot transfer back, cannot manage members
    await owner.post(url, { newOwnerUserId: owner.userId, password: PASSWORD, totpCode: TwoFactorService.codeFor(secret) }).expect(403);
    expect((await owner.get('/me').expect(200)).body.data).toMatchObject({ ownedWorkspaceId: null, workspace: { id: owner.workspaceId, role: 'admin' } });
    // the new owner can
    expect((await admin.get('/me').expect(200)).body.data.workspace.role).toBe('owner');

    const adminEmail = (await db.user.findUniqueOrThrow({ where: { id: admin.userId } })).email;
    expect(await mailsTo(app, owner.email, 'workspace/ownership-transferred')).toHaveLength(1);
    expect(await mailsTo(app, adminEmail, 'workspace/ownership-transferred')).toHaveLength(1);
    const audit = await eventually(() => db.auditLog.findFirst({ where: { workspaceId: owner.workspaceId, action: 'workspace.transfer_ownership' } }));
    expect(audit).toMatchObject({ actorId: owner.userId, before: { ownerUserId: owner.userId }, after: { ownerUserId: admin.userId } });
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);
  });

  it('owner without 2FA: totpCode is ignored', async () => {
    const owner = await asOwner(app);
    await setPassword(app, owner.userId);
    const admin = await asAdmin(app, owner.workspaceId);
    await owner.post(`/workspaces/${owner.workspaceId}/transfer-ownership`, { newOwnerUserId: admin.userId, password: PASSWORD, totpCode: '123456' }).expect(200);
  });
});

describe('danger zone (FL-14)', () => {
  it('AT-AUTH-12 workspace deletion: scheduled 30 d, channels disconnected, mutations refused for members, cancel, purge job after 30 d', async () => {
    const owner = await register(app, { workspaceName: 'Boutique à supprimer' });
    const admin = await asAdmin(app, owner.workspaceId);
    const operator = await asOperator(app, owner.workspaceId);
    const channel = await db.channel.create({
      data: { workspaceId: owner.workspaceId, platform: 'facebook', externalId: `page-${owner.workspaceId}`, name: 'Page', connectedById: owner.userId, accessToken: Buffer.from('secret-token') },
    });

    // permission matrix + validation
    expect((await admin.delete('/workspace').send({ password: PASSWORD, confirmName: 'Boutique à supprimer' }).expect(403)).body.error.code).toBe('FORBIDDEN');
    await operator.delete('/workspace').send({ password: PASSWORD, confirmName: 'Boutique à supprimer' }).expect(403);
    await owner.delete('/workspace').send({}).expect(422);
    expect((await owner.delete('/workspace').send({ password: PASSWORD, confirmName: 'Autre nom' }).expect(422)).body.error.fields).toEqual({ confirmName: 'validation.invalid' });
    expect((await owner.delete('/workspace').send({ password: 'Wrong-password-1', confirmName: 'Boutique à supprimer' }).expect(422)).body.error.code).toBe('AUTH_CURRENT_PASSWORD_INCORRECT');
    expect((await owner.post('/workspace/deletion/cancel').expect(409)).body.error.code).toBe('CONFLICT');
    await admin.post('/workspace/deletion/cancel').expect(403);

    const res = await owner.delete('/workspace').send({ password: PASSWORD, confirmName: 'boutique à supprimer' }).expect(200);
    expect(res.body.data.status).toBe('deletion_scheduled');
    expect(Math.round((new Date(res.body.data.deletionScheduledAt).getTime() - Date.now()) / DAY)).toBe(30);

    // channels are disconnected at once ⇒ nothing is received or answered (AI stops); the Meta unsubscribe is a queued
    // job (M3, through the Meta port) that wipes the stored token when it is done
    expect((await db.channel.findUniqueOrThrow({ where: { id: channel.id } })).status).toBe('disconnected');
    expect(await drain(app, owner.workspaceId, ['job'])).toContain('channel-unsubscribe');
    const ch = await db.channel.findUniqueOrThrow({ where: { id: channel.id } });
    expect(ch).toMatchObject({ status: 'disconnected', accessToken: null });
    // members: reads still work, every mutation is refused
    expect((await admin.get('/workspace').expect(200)).body.data).toMatchObject({ status: 'deletion_scheduled', deletionScheduledAt: res.body.data.deletionScheduledAt });
    for (const actor of [owner, admin, operator]) {
      const refused = await actor.post('/workspace/quick-replies', { title: 'Nouveau', body: 'x' }).expect(409);
      expect(refused.body.error).toMatchObject({ code: 'WORKSPACE_DELETION_SCHEDULED', params: { at: res.body.data.deletionScheduledAt } });
    }
    await owner.patch('/workspace', { name: 'Trop tard' }).expect(409);
    await owner.delete('/workspace').send({ password: PASSWORD, confirmName: 'Boutique à supprimer' }).expect(409);
    expect(await mailsTo(app, owner.email, 'workspace/deletion-scheduled')).toHaveLength(1);
    expect(await eventually(() => db.auditLog.findFirst({ where: { workspaceId: owner.workspaceId, action: 'workspace.deletion_scheduled' } }))).toBeTruthy();

    // not due yet: the purge job leaves it alone
    const svc = app.app.get(WorkspaceDeletionService);
    await svc.purgeDue();
    expect(await db.workspace.count({ where: { id: owner.workspaceId } })).toBe(1);

    // cancel (Owner only) restores the workspace; channels stay disconnected
    await admin.post('/workspace/deletion/cancel').expect(403);
    expect((await owner.post('/workspace/deletion/cancel').expect(200)).body.data).toMatchObject({ status: 'active', deletionScheduledAt: null });
    await admin.post('/workspace/quick-replies', { title: 'Nouveau', body: 'x' }).expect(201);
    expect((await db.channel.findUniqueOrThrow({ where: { id: channel.id } })).status).toBe('disconnected');
    expect(await eventually(() => db.auditLog.findFirst({ where: { workspaceId: owner.workspaceId, action: 'workspace.deletion_cancelled' } }))).toBeTruthy();

    // schedule again, let the 30 days pass, run the scheduled job (registered as `sched-workspace-purge`)
    await owner.delete('/workspace').send({ password: PASSWORD, confirmName: 'Boutique à supprimer' }).expect(200);
    await db.workspace.update({ where: { id: owner.workspaceId }, data: { deletionScheduledAt: new Date(Date.now() - 1000) } });
    const runner = new WorkerRunner(app.app.get(ConfigService), app.app.get(ProcessorRegistry));
    expect(await runner.runCron('sched-workspace-purge')).toBeGreaterThanOrEqual(1);
    expect(await db.workspace.count({ where: { id: owner.workspaceId } })).toBe(0);
    expect(await db.membership.count({ where: { workspaceId: owner.workspaceId } })).toBe(0);
    expect(await db.quickReply.count({ where: { workspaceId: owner.workspaceId } })).toBe(0);
    expect(await db.channel.count({ where: { id: channel.id } })).toBe(0);
    const former = await db.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(former).toMatchObject({ ownedWorkspaceId: null, lastWorkspaceId: null, status: 'active' });
    expect(await mailsTo(app, owner.email, 'workspace/deleted')).toHaveLength(1);
    // members lost access; the former owner may create a new workspace
    expect((await admin.get('/workspace').expect(404)).body.error.code).toBe('NOT_FOUND');
    expect((await owner.get('/me').expect(200)).body.data).toMatchObject({ workspace: null, memberships: [] });
    // running the job twice is harmless
    await runner.runCron('sched-workspace-purge');
    expect(await mailsTo(app, owner.email, 'workspace/deleted')).toHaveLength(1);
  });
});

describe('onboarding', () => {
  it('AT-ONB-01 the step is stored server-side: resumes at step 3 after a new login; every step skippable; 99 = skipped', async () => {
    const owner = await register(app);
    expect((await owner.get('/workspace/onboarding').expect(200)).body.data).toEqual({
      step: 1,
      checklist: { channel: false, product: false, agent: false, order: false },
      done: 0,
      total: 4,
    });
    expect((await owner.patch('/workspace/onboarding', { step: 7 }).expect(422)).body.error.fields).toEqual({ step: 'validation.range' });
    await owner.patch('/workspace/onboarding', { step: 2.5 }).expect(422);
    await owner.patch('/workspace/onboarding', {}).expect(422);
    await owner.patch('/workspace/onboarding', { step: 2 }).expect(200);
    expect((await owner.patch('/workspace/onboarding', { step: 3 }).expect(200)).body.data.step).toBe(3);

    // "close the browser": a brand-new session resumes at step 3
    const again = await api(app).post('/api/v1/auth/login').send({ email: owner.email, password: PASSWORD }).expect(200);
    const me = await api(app).get('/api/v1/me').set('Authorization', `Bearer ${again.body.data.accessToken}`).expect(200);
    expect(me.body.data.workspace.onboardingStep).toBe(3);

    // steps can be skipped in any order, up to "ready" (6) or the global skip (99)
    for (const step of [5, 6, 99]) expect((await owner.patch('/workspace/onboarding', { step }).expect(200)).body.data.step).toBe(step);
    expect((await owner.get('/workspace').expect(200)).body.data.onboardingStep).toBe(99);

    const admin = await asAdmin(app, owner.workspaceId);
    const operator = await asOperator(app, owner.workspaceId);
    await admin.patch('/workspace/onboarding', { step: 4 }).expect(200);
    expect((await operator.patch('/workspace/onboarding', { step: 1 }).expect(403)).body.error.code).toBe('FORBIDDEN');
    await operator.get('/workspace/onboarding').expect(200);
  });

  it('AT-ONB-02 stock mode is a workspace setting returned to every client; the checklist is computed from real rows', async () => {
    const owner = await register(app);
    expect((await owner.patch('/workspace', { stockMode: 'advanced' }).expect(200)).body.data.stockMode).toBe('advanced');
    expect((await owner.get('/me').expect(200)).body.data.workspace.stockMode).toBe('advanced');
    expect((await owner.patch('/workspace', { stockMode: 'simple' }).expect(200)).body.data.stockMode).toBe('simple');
    // navigation derives from this value on web and mobile; the API itself is unchanged in simple mode
    const operator = await asOperator(app, owner.workspaceId);
    expect((await operator.get('/me').expect(200)).body.data.workspace.stockMode).toBe('simple');
    await owner.get('/workspace/quick-replies').expect(200);

    // checklist: real entities, another workspace's rows never count
    const other = await asOwner(app);
    await db.product.create({ data: { workspaceId: other.workspaceId, sku: 'X-1', name: 'Autre', price: 1000 } });
    await db.product.create({ data: { workspaceId: owner.workspaceId, sku: 'P-1', name: 'Robe', price: 4500 } });
    await db.channel.create({ data: { workspaceId: owner.workspaceId, platform: 'facebook', externalId: `fb-${owner.workspaceId}`, name: 'Page', connectedById: owner.userId } });
    const state = await owner.get('/workspace/onboarding').expect(200);
    expect(state.body.data).toMatchObject({ checklist: { channel: true, product: true, agent: false, order: false }, done: 2, total: 4 });
    expect((await other.get('/workspace/onboarding').expect(200)).body.data).toMatchObject({ checklist: { channel: false, product: true }, done: 1 });
    expect((await owner.get('/workspace').expect(200)).body.data.plan.usage).toMatchObject({ pages: 1, products: 1 });
  });
});
