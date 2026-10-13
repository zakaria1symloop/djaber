// M10 — ADM-13 platform settings (D39, D58; 04 §15; 03 §26 PFS-01…07): AT-PFS-01…08, the force-update 2FA re-check,
// feature flags + FEATURE_DISABLED, maintenance window, legal re-acceptance, Meta permissions, providers test, the SMS of
// `invoice.unpaid` through the fake SMS port, roles per platform role, merchant users refused, audit rows with reason.
// Platform-wide rows touched here (limits, app versions, maintenance, flags, legal documents, providers) are restored.
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { rawPrisma as db, TenantContext, type Tx } from '@djaber/db';
import { RequirePermission } from '../../src/core/auth/decorators';
import { CryptoService } from '../../src/core/crypto/crypto.service';
import { FlagsService } from '../../src/core/flags/flags.service';
import { resetMaintenanceCache } from '../../src/core/platform/maintenance';
import { RequireFeature, resetAppVersionCache } from '../../src/core/platform/platform.guards';
import { TwoFactorService } from '../../src/modules/auth/two-factor.service';
import { SMS_GATEWAY, type FakeSmsGateway } from '../../src/modules/admin-ops/sms/sms.gateway';
import { PlatformSettingsService } from '../../src/modules/admin-ops/settings/platform-settings.service';
import { NotificationProducer } from '../../src/modules/notifications/notification.producer';
import { PUSH_GATEWAY, type FakePushGateway } from '../../src/modules/notifications/push/push.gateway';
import { ProvisioningService } from '../../src/modules/workspace/provisioning.service';
import { LegalService } from '../../src/modules/workspace/legal.service';
import { asOperator, asOwner, createWorkspace, type Actor } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { connect, delivery, messageItem, newSender, postWebhook } from '../support/m3';
import { auditRows, drainAll, PLATFORM_ROLES, platformUser, type PlatformActorT } from '../support/m10-ops';

@Controller('test-feature')
class TestFeatureController {
  @Get()
  @RequirePermission('workspace.read')
  @RequireFeature('image_recognition_v2')
  get() {
    return { ok: true };
  }
}

let app: TestApp;
let sa: PlatformActorT;
const SMS_DIR = mkdtempSync(join(tmpdir(), 'djaber-sms-'));
const REASON = 'Changement validé par la direction';

beforeAll(async () => {
  process.env.SMS_LOCAL_DIR = SMS_DIR;
  app = await createTestApp({ controllers: [TestFeatureController] });
  sa = await platformUser(app, 'super_admin');
});
afterAll(async () => {
  await app.close();
});

/** Super admin with a real TOTP secret (force update re-check). */
const adminWithTotp = async () => {
  const secret = authenticator.generateSecret();
  const a = await platformUser(app, 'super_admin');
  await db.user.update({ where: { id: a.userId }, data: { totpSecret: Buffer.from(app.app.get(CryptoService).encrypt(secret), 'utf8') } });
  return { ...a, code: (offset = 0) => TwoFactorService.codeFor(secret, offset) };
};
const withHeaders = (actor: Actor, method: 'get' | 'post', url: string, headers: Record<string, string>) => request(app.http())[method](`/api/v1${url}`).set(actor.headers).set(headers);

describe('ADM-13 access', () => {
  it('reads for every platform role, writes for super_admin only, merchant users and platform users without 2FA refused', async () => {
    for (const role of PLATFORM_ROLES) {
      const a = await platformUser(app, role);
      const all = await a.get('/admin/settings').expect(200);
      expect(Object.keys(all.body.data).sort()).toEqual(['appVersions', 'flags', 'incidentBanner', 'legal', 'maintenance', 'metaPermissions', 'providers', 'settings']);
      if (role !== 'super_admin') {
        expect((await a.put('/admin/settings/limits', { value: {}, reason: REASON }).expect(403)).body.error.code).toBe('FORBIDDEN');
        await a.post('/admin/feature-flags', { key: `nope_${role}` }).expect(403);
        await a.put('/admin/maintenance', { enabled: false }).expect(403);
        await a.put('/admin/incident-banner', { visible: false }).expect(403);
        await a.post('/admin/providers/sms/test').expect(403);
        await a.patch('/admin/meta/permissions/pages_messaging', { status: 'approved' }).expect(403);
      }
    }
    const owner = await asOwner(app);
    expect((await owner.get('/admin/settings').expect(403)).body.error.code).toBe('FORBIDDEN');
    await owner.put('/admin/maintenance', { enabled: true }).expect(403);
    const no2fa = await platformUser(app, 'super_admin');
    await db.user.update({ where: { id: no2fa.userId }, data: { totpEnabled: false } });
    expect((await no2fa.get('/admin/settings').expect(403)).body.error.code).toBe('TWO_FA_REQUIRED_FOR_ROLE');
  });
});

describe('PFS-07 limits & versioned settings', () => {
  it('AT-PFS-08 trial days 14 → 30: PlatformSettingVersion + audit with reason; new sign-ups get 30 days; 422 / ADMIN_REASON_REQUIRED / 404', async () => {
    const before = await db.platformSetting.findUnique({ where: { key: 'limits' } });
    try {
      const value = { apiRatePerMin: 600, webhookRetries: 6, trialDays: 30, trialCredits: 300, deletionGraceDays: 30, impersonationMinutes: 30, maxDevices: 20 };
      expect((await sa.put('/admin/settings/limits', { value }).expect(422)).body.error.code).toBe('ADMIN_REASON_REQUIRED');
      const bad = await sa.put('/admin/settings/limits', { value: { ...value, trialDays: -1 }, reason: REASON }).expect(422);
      expect(bad.body.error).toMatchObject({ code: 'VALIDATION_ERROR', fields: { 'value.trialDays': 'validation.range' } });
      await sa.put('/admin/settings/unknown_key', { value: {}, reason: REASON }).expect(404);

      const res = await sa.put('/admin/settings/limits', { value, reason: REASON }).expect(200);
      expect(res.body.data).toMatchObject({ key: 'limits', value, version: (before?.version ?? 0) + 1, updatedBy: { id: sa.userId } });
      const versions = (await sa.get('/admin/settings/limits/versions').expect(200)).body.data;
      expect(versions[0]).toMatchObject({ version: res.body.data.version, value, reason: REASON, changedBy: { id: sa.userId } });
      const audit = (await auditRows('setting.update', 'limits'))[0]!;
      expect(audit).toMatchObject({ actorId: sa.userId, actorType: 'admin', reason: REASON });

      // a new workspace gets the 30-day trial
      const user = await db.user.create({ data: { email: `trial-${Date.now()}@test.local`, passwordHash: 'x', firstName: 'Nadia', lastName: 'Kaci' } });
      const ws = await TenantContext.runSystem(() => db.$transaction((tx) => app.app.get(ProvisioningService).createWorkspace(tx as Tx, { name: 'Boutique Essai', locale: 'fr', ownerId: user.id })));
      const sub = await db.subscription.findFirstOrThrow({ where: { workspaceId: ws.id } });
      const days = Math.round((sub.trialEndsAt!.getTime() - Date.now()) / 86400_000);
      expect(days).toBe(30);
    } finally {
      if (before) await db.platformSetting.update({ where: { key: 'limits' }, data: { value: before.value as object } });
    }
  });
});

describe('PFS-01 / PFS-02 app versions', () => {
  it('AT-PFS-01 below minVersion ⇒ 426 APP_UPDATE_REQUIRED on every call; below recommended ⇒ 200 + X-App-Update: recommended', async () => {
    const before = await db.appVersion.findUniqueOrThrow({ where: { platform: 'android' } });
    try {
      await db.appVersion.update({ where: { platform: 'android' }, data: { minVersion: '2.1.0', recommendedVersion: '2.3.0', latestVersion: '2.3.0', forceUpdateAt: null } });
      resetAppVersionCache();
      const owner = await asOwner(app);
      const old = await withHeaders(owner, 'get', '/workspace', { 'X-App-Platform': 'android', 'X-App-Version': '2.0.9' }).expect(426);
      expect(old.body.error).toMatchObject({ code: 'APP_UPDATE_REQUIRED', params: { minVersion: '2.1.0', storeUrl: before.storeUrl, message: expect.any(String) } });
      await withHeaders(owner, 'post', '/workspace/quick-replies', { 'X-App-Platform': 'android', 'X-App-Version': '2.0.9' }).send({ title: 'A', body: 'b' }).expect(426);
      const mid = await withHeaders(owner, 'get', '/workspace', { 'X-App-Platform': 'android', 'X-App-Version': '2.2.0' }).expect(200);
      expect(mid.headers['x-app-update']).toBe('recommended');
      const fresh = await withHeaders(owner, 'get', '/workspace', { 'X-App-Platform': 'android', 'X-App-Version': '2.3.0' }).expect(200);
      expect(fresh.headers['x-app-update']).toBeUndefined();
      // web and other platforms are not gated; the public version check stays reachable
      await owner.get('/workspace').expect(200);
      await request(app.http()).get('/api/v1/app/version?platform=android&version=2.0.9').expect(200);
    } finally {
      await db.appVersion.update({ where: { platform: 'android' }, data: { minVersion: before.minVersion, recommendedVersion: before.recommendedVersion, latestVersion: before.latestVersion, forceUpdateAt: before.forceUpdateAt } });
      resetAppVersionCache();
    }
  });

  it('AT-PFS-02 force update: no / wrong 2FA code ⇒ TWO_FA_CONFIRMATION_REQUIRED; with code ⇒ saved, impact, audit, push app.update_required; store not published ⇒ blocked', async () => {
    const before = await db.appVersion.findUniqueOrThrow({ where: { platform: 'ios' } });
    const push = app.app.get<FakePushGateway>(PUSH_GATEWAY);
    const admin = await adminWithTotp();
    const user = await db.user.create({ data: { email: `dev-${Date.now()}@test.local`, passwordHash: 'x', firstName: 'Amine', lastName: 'Bey' } });
    const token = `ios-token-${Date.now()}`;
    await db.deviceToken.create({ data: { userId: user.id, token, platform: 'ios', appVersion: '1.0.0', locale: 'fr' } });
    const body = { minVersion: '9.1.0', recommendedVersion: '9.2.0', latestVersion: '9.2.0', storeUrl: before.storeUrl, updateMessage: { fr: 'Mettez à jour Djaber.', ar: 'حدّث جابر.', en: 'Update Djaber.' }, reason: REASON };
    try {
      expect((await admin.put('/admin/app-versions/ios', body).expect(403)).body.error.code).toBe('TWO_FA_CONFIRMATION_REQUIRED');
      expect((await admin.put('/admin/app-versions/ios', { ...body, totpCode: '000000' }).expect(403)).body.error.fields).toEqual({ totpCode: 'validation.invalid' });
      // the plain fixture admin has 2FA on but no secret: refused too
      await sa.put('/admin/app-versions/ios', { ...body, totpCode: admin.code() }).expect(403);
      expect((await admin.put('/admin/app-versions/ios', { ...body, recommendedVersion: '9.0.0', totpCode: admin.code() }).expect(422)).body.error.fields).toEqual({ recommendedVersion: 'validation.range' });
      await admin.put('/admin/app-versions/web', body).expect(404);
      // a store version still in review cannot be forced beyond the published one
      const blocked = await admin.put('/admin/app-versions/ios', { ...body, storeStatus: 'in_review', totpCode: admin.code() }).expect(422);
      expect(blocked.body.error.fields).toEqual({ minVersion: 'validation.range' });

      push.reset();
      const ok = await admin.put('/admin/app-versions/ios', { ...body, totpCode: admin.code() }).expect(200);
      expect(ok.body.data).toMatchObject({ platform: 'ios', minVersion: '9.1.0', recommendedVersion: '9.2.0', forceUpdateAt: expect.any(String) });
      expect(ok.body.data.devicesBelowMin.count).toBeGreaterThanOrEqual(1);
      expect(ok.body.data.devicesBelowMin.pct).toBeGreaterThan(0);
      const audit = (await auditRows('app_version.force_update', 'ios'))[0]!;
      expect(audit).toMatchObject({ actorId: admin.userId, reason: REASON, after: expect.objectContaining({ minVersion: '9.1.0' }) });
      expect(await drainAll(app)).toContain('app-update-push');
      const sent = push.sent.filter((m) => m.token === token);
      expect(sent).toHaveLength(1);
      expect(sent[0]!.data).toMatchObject({ type: 'app_update_required' });

      // the same minVersion again: no new 2FA prompt, no new push (once per version)
      push.reset();
      await admin.put('/admin/app-versions/ios', { ...body, latestVersion: '9.3.0', recommendedVersion: '9.2.0' }).expect(200);
      await drainAll(app);
      expect(push.sent.filter((m) => m.token === token)).toHaveLength(0);
      expect((await admin.get('/admin/app-versions/ios').expect(200)).body.data.latestVersion).toBe('9.3.0');
    } finally {
      await db.appVersion.update({ where: { platform: 'ios' }, data: { minVersion: before.minVersion, recommendedVersion: before.recommendedVersion, latestVersion: before.latestVersion, storeStatus: before.storeStatus, forceUpdateAt: before.forceUpdateAt, updateMessage: before.updateMessage as object } });
      await db.deviceToken.deleteMany({ where: { token } });
      resetAppVersionCache();
    }
  });
});

describe('PFS-02 feature flags', () => {
  const KEY = 'image_recognition_v2';
  afterAll(async () => {
    await db.featureFlag.deleteMany({ where: { key: { in: [KEY, 'det_check'] } } });
    await app.app.get(FlagsService).invalidate();
  });

  it('AT-PFS-03 20 % Pro ⇒ deterministic per workspace; disabled workspace ⇒ 403 FEATURE_DISABLED; plan mismatch; CRUD + audit + merchant map', async () => {
    await db.featureFlag.deleteMany({ where: { key: { in: [KEY, 'det_check'] } } });
    const flags = app.app.get(FlagsService);
    // determinism: the bucket decides, the same answer every time
    await sa.post('/admin/feature-flags', { key: 'det_check', webPct: 20, mobilePct: 0, reason: REASON }).expect(201);
    const ids = Array.from({ length: 40 }, () => randomUUID());
    for (const id of ids) {
      const a = await flags.evaluate('det_check', id);
      expect(a).toMatchObject({ enabled: FlagsService.bucket('det_check', id) < 20, reason: 'bucket' });
      expect((await flags.evaluate('det_check', id)).enabled).toBe(a.enabled);
      expect((await flags.evaluate('det_check', id, 'mobile')).enabled).toBe(false);
    }

    const created = await sa.post('/admin/feature-flags', { key: KEY, description: 'Reconnaissance photo v2', webPct: 0, mobilePct: 0, targeting: { planSlugs: ['pro'] }, reason: REASON }).expect(201);
    expect(created.body.data).toMatchObject({ key: KEY, webPct: 0, targeting: { planSlugs: ['pro'] }, isActive: true, updatedBy: { id: sa.userId } });
    expect((await sa.post('/admin/feature-flags', { key: KEY }).expect(409)).body.error.code).toBe('CONFLICT');
    await sa.post('/admin/feature-flags', { key: 'Bad Key' }).expect(422);
    await sa.post('/admin/feature-flags', { key: 'x_y', webPct: 101 }).expect(422);

    const pro = await asOwner(app, 'pro');
    const starter = await asOwner(app, 'starter');
    expect((await pro.get('/test-feature').expect(403)).body.error).toMatchObject({ code: 'FEATURE_DISABLED', params: { feature: KEY } });
    // 100 % for Pro: the Pro workspace passes, the Starter one stays out (plan targeting)
    await sa.patch(`/admin/feature-flags/${KEY}`, { webPct: 100, reason: REASON }).expect(200);
    expect((await pro.get('/test-feature').expect(200)).body.data).toEqual({ ok: true });
    await starter.get('/test-feature').expect(403);
    expect((await sa.get(`/admin/feature-flags/${KEY}/evaluate?workspaceId=${starter.workspaceId}`).expect(200)).body.data).toMatchObject({ enabled: false, reason: 'plan_mismatch' });
    // an explicit workspace list wins over the plan
    await sa.patch(`/admin/feature-flags/${KEY}`, { targeting: { planSlugs: ['pro'], workspaceIds: [starter.workspaceId] } }).expect(200);
    await starter.get('/test-feature').expect(200);
    expect((await sa.get(`/admin/feature-flags/${KEY}/evaluate?workspaceId=${starter.workspaceId}&platform=web`).expect(200)).body.data).toMatchObject({ enabled: true, reason: 'workspace_list' });
    await sa.get(`/admin/feature-flags/unknown_flag/evaluate?workspaceId=${starter.workspaceId}`).expect(404);

    // merchant map (mobile surface off: mobilePct 0 and no list for the Pro workspace)
    expect((await pro.get('/feature-flags?platform=web').expect(200)).body.data[KEY]).toBe(true);
    expect((await pro.get('/feature-flags?platform=mobile').expect(200)).body.data[KEY]).toBe(false);
    const operator = await asOperator(app, pro.workspaceId);
    await operator.get('/feature-flags').expect(200);

    await sa.patch(`/admin/feature-flags/${KEY}`, { isActive: false }).expect(200);
    await pro.get('/test-feature').expect(403);
    expect((await auditRows('feature_flag.update', KEY)).length).toBeGreaterThanOrEqual(3);
    await sa.delete(`/admin/feature-flags/${KEY}`).expect(200);
    await sa.delete(`/admin/feature-flags/${KEY}`).expect(404);
    expect((await auditRows('feature_flag.delete', KEY))[0]).toMatchObject({ actorId: sa.userId });
  });
});

describe('PFS-03 maintenance & incident banner', () => {
  afterEach(async () => {
    await sa.put('/admin/maintenance', { enabled: false }).expect(200);
    resetMaintenanceCache();
  });

  it('AT-PFS-04 window active ⇒ GET 200, mutations 503 MAINTENANCE_MODE {until}; Meta webhook stored unprocessed; admin / auth / legal still writable; scope', async () => {
    const owner = await asOwner(app);
    const until = new Date(Date.now() + 3600_000).toISOString();
    const res = await sa.put('/admin/maintenance', { enabled: true, scheduledTo: until, scope: 'all', text: { fr: 'Maintenance en cours', ar: 'صيانة جارية', en: 'Maintenance in progress' }, reason: REASON }).expect(200);
    expect(res.body.data).toMatchObject({ enabled: true, active: true, scheduledTo: until, scope: 'all', text: { fr: 'Maintenance en cours' } });
    expect((await auditRows('maintenance.update', 'maintenance'))[0]).toMatchObject({ actorId: sa.userId, reason: REASON });

    await owner.get('/workspace').expect(200);
    const blocked = await owner.post('/workspace/quick-replies', { title: 'Bonjour', body: 'Salam' }).expect(503);
    expect(blocked.body.error).toMatchObject({ code: 'MAINTENANCE_MODE', params: { until } });
    // the admin keeps working; the public version check shows the window
    await sa.put('/admin/incident-banner', { visible: false }).expect(200);
    expect((await request(app.http()).get('/api/v1/app/version?platform=android').expect(200)).body.data.maintenance).toMatchObject({ until });

    // Meta webhooks are acknowledged and stored (processed after the window by the worker)
    const sender = newSender();
    const page = { platform: 'facebook', externalId: `9${Date.now()}` };
    const item = messageItem(page, sender, { text: 'salam' });
    await postWebhook(app, delivery(page, [item])).expect(200);
    const stored = await db.inboundEvent.findFirstOrThrow({ where: { externalId: { contains: (item.message as { mid: string }).mid } } });
    expect(stored.processedAt).toBeNull();

    // scope mobile: the web stays writable, a mobile app is refused
    await sa.put('/admin/maintenance', { enabled: true, scheduledTo: until, scope: 'mobile' }).expect(200);
    await owner.post('/workspace/quick-replies', { title: `Web ${Date.now()}`, body: 'ok' }).expect(201);
    await withHeaders(owner, 'post', '/workspace/quick-replies', { 'X-App-Platform': 'android' }).send({ title: `M ${Date.now()}`, body: 'x' }).expect(503);

    // a scheduled window in the future is not active yet
    const later = await sa.put('/admin/maintenance', { enabled: true, scheduledFrom: new Date(Date.now() + 86400_000).toISOString(), scheduledTo: new Date(Date.now() + 90000_000).toISOString() }).expect(200);
    expect(later.body.data).toMatchObject({ enabled: true, active: false });
    await owner.post('/workspace/quick-replies', { title: `Later ${Date.now()}`, body: 'ok' }).expect(201);
    await sa.put('/admin/maintenance', { enabled: true, scheduledFrom: until, scheduledTo: new Date(Date.now() - 1000).toISOString() }).expect(422);
    expect((await sa.get('/admin/settings/maintenance/versions').expect(200)).body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('incident banner: visible needs a text (422); saved, versioned, audited, listed in GET /admin/settings', async () => {
    expect((await sa.put('/admin/incident-banner', { visible: true }).expect(422)).body.error.fields).toEqual({ text: 'validation.required' });
    const text = { fr: 'Retards Messenger en cours', ar: 'تأخيرات في ماسنجر', en: 'Messenger delays' };
    expect((await sa.put('/admin/incident-banner', { visible: true, text }).expect(200)).body.data).toEqual({ visible: true, text });
    expect((await sa.get('/admin/settings').expect(200)).body.data.incidentBanner).toEqual({ visible: true, text });
    expect((await auditRows('incident_banner.update', 'incident_banner'))[0]).toMatchObject({ actorId: sa.userId });
    await sa.put('/admin/incident-banner', { visible: false, text: null }).expect(200);
  });
});

describe('PFS-05 Meta', () => {
  it('AT-PFS-06 marking the Instagram messaging scope approved ⇒ pending IG channels activated + channel.approved', async () => {
    const scope = 'instagram_business_manage_messages';
    const before = await db.metaPermission.findUnique({ where: { scope } });
    await db.metaPermission.upsert({ where: { scope }, create: { scope, feature: 'instagram_messaging', status: 'in_review', submittedAt: new Date(Date.now() - 5 * 86400_000) }, update: { status: 'in_review', submittedAt: new Date(Date.now() - 5 * 86400_000) } });
    try {
      const owner = await asOwner(app);
      const report = await connect(owner, app, 'instagram');
      const id = report.pages[0]!.channelId!;
      expect((await db.channel.findUniqueOrThrow({ where: { id } })).status).toBe('pending_review');
      const list = (await sa.get('/admin/meta/permissions').expect(200)).body.data;
      expect(list.find((p: any) => p.scope === scope)).toMatchObject({ status: 'in_review', daysInReview: 5 });
      const moderator = await platformUser(app, 'moderator');
      await moderator.patch(`/admin/meta/permissions/${scope}`, { status: 'approved' }).expect(403);
      await sa.patch(`/admin/meta/permissions/${scope}`, { status: 'nope' }).expect(422);
      await sa.patch('/admin/meta/permissions/unknown_scope', { status: 'approved' }).expect(404);

      const res = await sa.patch(`/admin/meta/permissions/${scope}`, { status: 'approved', notes: 'Validé par Meta' }).expect(200);
      expect(res.body.data).toMatchObject({ scope, status: 'approved', decidedAt: expect.any(String), notes: 'Validé par Meta' });
      expect((await db.channel.findUniqueOrThrow({ where: { id } })).status).toBe('active');
      const notif = await db.outbox.findFirst({ where: { topic: 'notification', key: `channel_approved:${id}` } });
      expect(notif).not.toBeNull();
      expect((await auditRows('meta.permission', scope))[0]).toMatchObject({ actorId: sa.userId, after: { status: 'approved' } });
    } finally {
      if (before) await db.metaPermission.update({ where: { scope }, data: { status: before.status, submittedAt: before.submittedAt, decidedAt: before.decidedAt, notes: before.notes } });
      else await db.metaPermission.deleteMany({ where: { scope } });
    }
  });

  it('Meta app: app id stored, secret encrypted and never returned', async () => {
    await sa.put('/admin/meta/app', { appId: 'abc' }).expect(422);
    const secret = 'meta-secret-value-123';
    const res = await sa.put('/admin/meta/app', { appId: '123456789012345', appSecret: secret }).expect(200);
    expect(res.body.data).toMatchObject({ appId: '123456789012345', secretSet: true, webhookUrl: expect.stringMatching(/\/api\/v1\/webhooks\/meta$/), verifyTokenSet: true, mode: 'development' });
    expect(JSON.stringify(res.body)).not.toContain(secret);
    const row = await db.platformSetting.findUniqueOrThrow({ where: { key: 'meta_app' } });
    expect(JSON.stringify(row.value)).not.toContain(secret);
    expect(JSON.stringify((await sa.get('/admin/settings/meta_app/versions').expect(200)).body)).not.toContain('secret');
    expect(JSON.stringify(await auditRows('meta.app', 'meta_app'))).not.toContain(secret);
    await db.platformSetting.delete({ where: { key: 'meta_app' } });
  });
});

describe('PFS-06 providers', () => {
  const KEYS = ['chargily', 'email', 'sms', 'push', 'courier_zr', 'courier_ecotrack', 'courier_yalidine', 'google_oauth'] as const;
  let saved: Awaited<ReturnType<typeof db.platformProvider.findMany>> = [];
  beforeAll(async () => {
    for (const key of KEYS) await db.platformProvider.upsert({ where: { key }, create: { key, kind: key.split('_')[0]! }, update: {} });
    saved = await db.platformProvider.findMany({ where: { key: { in: [...KEYS] } } });
  });
  afterAll(async () => {
    for (const p of saved) await db.platformProvider.update({ where: { key: p.key }, data: { config: p.config as object, secret: p.secret, status: p.status, lastCheckedAt: p.lastCheckedAt, lastError: p.lastError, quota: p.quota ?? undefined, expiresAt: p.expiresAt } });
  });

  it('AT-PFS-07 "Tester" for every provider: ok (latency) / rejected / unreachable; SMS balance < 1 000 and APNs expiry < 30 d warnings', async () => {
    for (const key of KEYS) {
      for (const simulate of ['ok', 'rejected', 'unreachable'] as const) {
        await sa.put(`/admin/providers/${key}`, { config: { simulate }, reason: REASON }).expect(200);
        const t = (await sa.post(`/admin/providers/${key}/test`).expect(200)).body.data;
        expect(t).toMatchObject({ key, state: simulate, latencyMs: expect.any(Number), error: simulate === 'ok' ? null : expect.any(String) });
        expect(t.status).toBe(simulate === 'ok' ? 'ok' : 'error');
        const row = await db.platformProvider.findUniqueOrThrow({ where: { key } });
        expect(row.lastCheckedAt).not.toBeNull();
      }
    }
    // without a simulation: fake drivers pass, a provider without credentials is rejected
    await sa.put('/admin/providers/courier_yalidine', { config: {} }).expect(200);
    expect((await sa.post('/admin/providers/courier_yalidine/test').expect(200)).body.data.state).toBe('ok');
    await sa.put('/admin/providers/google_oauth', { config: {} }).expect(200);
    const google = (await sa.post('/admin/providers/google_oauth/test').expect(200)).body.data;
    expect(google.state).toBe(process.env.GOOGLE_CLIENT_ID ? 'ok' : 'rejected');
    await sa.put('/admin/providers/google_oauth', { config: {}, secret: 'client-secret-xyz' }).expect(200);
    expect((await sa.post('/admin/providers/google_oauth/test').expect(200)).body.data.state).toBe('ok');
    const list = (await sa.get('/admin/providers').expect(200)).body.data;
    expect(list.map((p: any) => p.key)).toEqual([...KEYS]);
    expect(list.find((p: any) => p.key === 'google_oauth')).toMatchObject({ secretSet: true });
    expect(JSON.stringify(list)).not.toContain('client-secret-xyz');

    // warnings
    await sa.put('/admin/providers/sms', { config: { balance: 800 } }).expect(200);
    const sms = (await sa.post('/admin/providers/sms/test').expect(200)).body.data;
    expect(sms).toMatchObject({ state: 'ok', status: 'warning' });
    expect((await sa.get('/admin/providers').expect(200)).body.data.find((p: any) => p.key === 'sms')).toMatchObject({ quota: { balance: 800 }, warnings: ['sms_balance_low'] });
    await sa.put('/admin/providers/push', { config: { apnsExpiresAt: new Date(Date.now() + 10 * 86400_000).toISOString() } }).expect(200);
    expect((await sa.get('/admin/providers').expect(200)).body.data.find((p: any) => p.key === 'push').warnings).toEqual(['apns_expiring']);

    await sa.post('/admin/providers/unknown/test').expect(404);
    await sa.put('/admin/providers/unknown', { config: {} }).expect(404);
    expect((await auditRows('provider.test', 'sms')).length).toBeGreaterThan(0);
  });

  it('M9 carry-over: invoice.unpaid SMS through the fake SMS port when the sms provider is ok (never otherwise)', async () => {
    const sms = app.app.get<FakeSmsGateway>(SMS_GATEWAY);
    const producer = app.app.get(NotificationProducer);
    const { ws, owner } = await createWorkspace();
    const phone = `0550${String(Date.now()).slice(-6)}`;
    await db.user.update({ where: { id: owner.id }, data: { phone } });
    const emit = (key: string) =>
      TenantContext.runSystem(() =>
        db.$transaction((tx) => producer.emit(tx as Tx, { type: 'invoice_unpaid', workspaceId: ws.id, target: { owner: true }, key, data: { invoiceId: randomUUID(), number: 'F-2026-000123', amount: 4900, stage: 'd0' } })),
      );

    // provider disabled ⇒ no SMS
    await db.platformProvider.update({ where: { key: 'sms' }, data: { status: 'disabled', config: {} } });
    await emit(`invoice_unpaid:sms-off:${Date.now()}`);
    await drainAll(app);
    expect(sms.sent.filter((m) => m.to === phone)).toHaveLength(0);

    // provider ok ⇒ one SMS to the owner's phone, written to the local SMS folder
    await db.platformProvider.update({ where: { key: 'sms' }, data: { status: 'ok' } });
    const key = `invoice_unpaid:sms-on:${Date.now()}`;
    await emit(key);
    expect(await drainAll(app)).toContain('sms-send');
    const sent = sms.sent.filter((m) => m.to === phone);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain('F-2026-000123');
    expect(readdirSync(SMS_DIR).length).toBeGreaterThan(0);
    // running the relay again sends nothing more (job id sms:<notificationId>)
    await drainAll(app);
    expect(sms.sent.filter((m) => m.to === phone)).toHaveLength(1);
  });
});

describe('PFS-04 legal documents', () => {
  it('AT-PFS-05 publish terms (major) ⇒ LEGAL_REACCEPT_REQUIRED until accepted + notification; minor ⇒ no prompt; acceptance %; version / cms checks; cms.write only', async () => {
    const legal = app.app.get(LegalService);
    const current = await db.legalDocument.findFirstOrThrow({ where: { key: 'terms' }, orderBy: { version: 'desc' } });
    const owner = await asOwner(app);
    const created: string[] = [];
    try {
      const moderator = await platformUser(app, 'moderator');
      await moderator.post('/admin/legal-documents/terms/publish', { version: current.version + 1, isMajor: true, cmsEntryId: current.cmsEntryId }).expect(403);
      expect((await sa.post('/admin/legal-documents/terms/publish', { version: current.version, isMajor: true, cmsEntryId: current.cmsEntryId }).expect(409)).body.error.code).toBe('CONFLICT');
      expect((await sa.post('/admin/legal-documents/terms/publish', { version: current.version + 1, isMajor: true, cmsEntryId: randomUUID() }).expect(422)).body.error.fields).toEqual({ cmsEntryId: 'validation.invalid' });
      await sa.post('/admin/legal-documents/cookies/publish', { version: 9, isMajor: true, cmsEntryId: current.cmsEntryId }).expect(404);

      const major = await sa.post('/admin/legal-documents/terms/publish', { version: current.version + 1, isMajor: true, cmsEntryId: current.cmsEntryId, reason: REASON }).expect(201);
      created.push(major.body.data.id);
      expect(major.body.data).toMatchObject({ key: 'terms', version: current.version + 1, isMajor: true, requiresReacceptance: true });
      expect((await auditRows('legal.publish', major.body.data.id))[0]).toMatchObject({ actorId: sa.userId, reason: REASON });

      const blocked = await owner.get('/workspace').expect(403);
      expect(blocked.body.error).toMatchObject({ code: 'LEGAL_REACCEPT_REQUIRED', params: { document: 'terms', version: current.version + 1 } });
      // the admin owes the terms too (every user): accept, then the admin pages answer again
      await sa.get('/admin/settings').expect(403);
      await sa.post('/legal/accept', { key: 'terms', version: current.version + 1 }).expect(204);

      // notification fan-out (job): one `legal.reacceptance_required` per concerned user
      await app.app.get(PlatformSettingsService).legalFanout(major.body.data.id);
      expect(await db.outbox.count({ where: { topic: 'notification', key: `legal_reacceptance_required:${owner.userId}:terms:${current.version + 1}` } })).toBe(1);

      await owner.post('/legal/accept', { key: 'terms', version: current.version + 1 }).expect(204);
      await owner.get('/workspace').expect(200);
      const stats = (await sa.get('/admin/legal-documents/terms/acceptance-stats').expect(200)).body.data;
      expect(stats).toMatchObject({ key: 'terms', version: current.version + 1, accepted: 2, required: expect.any(Number), byClient: [{ client: 'web', count: 2 }] });
      expect(stats.pct).toBeGreaterThanOrEqual(0);

      // minor version: nobody is prompted
      const minor = await sa.post('/admin/legal-documents/terms/publish', { version: current.version + 2, isMajor: false, cmsEntryId: current.cmsEntryId }).expect(201);
      created.push(minor.body.data.id);
      expect(minor.body.data).toMatchObject({ isMajor: false, requiresReacceptance: false });
      const fresh = await asOwner(app);
      await fresh.get('/workspace').expect(200);
      expect((await sa.get('/admin/legal-documents').expect(200)).body.data.filter((d: any) => d.key === 'terms')[0]).toMatchObject({ version: current.version + 2 });
    } finally {
      await db.outbox.deleteMany({ where: { OR: [{ key: { startsWith: 'legal_reacceptance_required:' } }, { key: { in: created.map((id) => `legal-fanout:${id}`) } }] } });
      await db.legalAcceptance.deleteMany({ where: { legalDocumentId: { in: created } } });
      await db.legalDocument.deleteMany({ where: { id: { in: created } } });
      await legal.invalidate();
    }
  });
});
