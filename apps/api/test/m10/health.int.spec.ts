// M10 ADM-14 — jobs & health (queues, DLQ replay, schedulers), incidents, public status page + subscription, /metrics,
// throughput limits (D59, 03 §27 OPS-01…06, 03-events §3 / §3.2). AT-OPS-01, AT-OPS-03, AT-API-02-style DLQ replay.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Queue, Worker } from 'bullmq';
import { rawPrisma as db } from '@djaber/db';
import { ConfigService } from '../../src/core/config/config.service';
import { CryptoService } from '../../src/core/crypto/crypto.service';
import { bullConnection } from '../../src/core/queue/queue.service';
import { acquireSemaphore, releaseSemaphore } from '../../src/core/queue/throttle';
import { RedisService } from '../../src/core/redis/redis.provider';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { auditRows, PLATFORM_ROLES, platformUser, roomEvents, type PlatformActorT } from '../support/m10-ops';

let app: TestApp;
let sa: PlatformActorT;
let support: PlatformActorT;
let moderator: PlatformActorT;
const roles: Record<string, PlatformActorT> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const T = (fr: string) => ({ fr, ar: `${fr} (ar)`, en: `${fr} (en)` });

beforeAll(async () => {
  app = await createTestApp();
  for (const r of PLATFORM_ROLES) roles[r] = await platformUser(app, r);
  sa = roles.super_admin!;
  support = roles.support!;
  moderator = roles.moderator!;
});
afterAll(async () => {
  // leave the shared test Redis as found: no paused queue
  const q = new Queue('jobs', { connection: bullConnection(app.app.get(ConfigService).get('REDIS_URL')) });
  await q.resume().catch(() => undefined);
  await q.close();
  await app.close();
});

/** Puts one failed job in `queue` the way production does: a worker throws on the last attempt. */
const failedJob = async (queueName: string, data: Record<string, unknown>) => {
  const connection = bullConnection(app.app.get(ConfigService).get('REDIS_URL'));
  const q = new Queue(queueName, { connection });
  const name = `health-test-${randomUUID().slice(0, 6)}`;
  const id = `ht-${randomUUID()}`;
  const worker = new Worker(queueName, async (job) => {
    if (job.name === name) throw new Error('boom: provider said no');
  }, { connection, autorun: true });
  await q.add(name, data, { jobId: id, attempts: 1 });
  for (let i = 0; i < 100 && (await q.getJob(id).then((j) => j?.getState())) !== 'failed'; i++) await sleep(50);
  await worker.close();
  return { q, id, name };
};

describe('GET /admin/health (AT-OPS-01)', () => {
  it('every platform role reads the queues with BullMQ counts, Meta webhook 24 h, AI, workers, schedulers; merchants get 403', async () => {
    const q = new Queue('jobs', { connection: bullConnection(app.app.get(ConfigService).get('REDIS_URL')) });
    await q.add('health-count', { a: 1 }, { jobId: `count-${randomUUID()}`, delay: 60_000 });
    // an invalid Meta signature is counted for the 24 h panel
    await request(app.http()).post('/api/v1/webhooks/meta').set('X-Hub-Signature-256', 'sha256=deadbeef').send({ object: 'page', entry: [] }).expect(401);
    for (const r of PLATFORM_ROLES) await roles[r]!.get('/admin/health').expect(200);
    const h = (await sa.get('/admin/health').expect(200)).body.data;
    expect(h.queues.map((x: any) => x.name)).toEqual(['meta-inbound', 'ai-reply', 'media', 'outbox', 'jobs', 'courier', 'payments', 'notifications', 'scheduler']);
    const jobs = h.queues.find((x: any) => x.name === 'jobs');
    expect(jobs).toMatchObject({ state: expect.stringMatching(/ok|warning|incident|paused/), pausable: true });
    expect(jobs.delayed).toBeGreaterThanOrEqual(1);
    expect(h.queues.find((x: any) => x.name === 'meta-inbound').pausable).toBe(false);
    expect(h.metaWebhooks).toMatchObject({ received24h: expect.any(Number), byType: { messages: expect.any(Number) } });
    expect(h.metaWebhooks.invalidSignatures).toBeGreaterThanOrEqual(1);
    expect(h.ai).toMatchObject({ errorRate24hPct: expect.any(Number), failoverActive: expect.any(Boolean) });
    expect(h.duplicates7d).toBe(0);
    expect(h.schedulers.map((s: any) => s.name)).toEqual(expect.arrayContaining(['sched-trust-levels', 'sched-moderation-sla', 'sched-ai-run-reaper']));
    await q.close();

    const owner = await asOwner(app);
    expect((await owner.get('/admin/health').expect(403)).body.error.code).toBe('FORBIDDEN');
  });

  it('pause stops consumers (BullMQ paused) and shows PAUSED; resume; meta-inbound cannot be paused (409); writes are super_admin only; audited', async () => {
    for (const r of ['support', 'moderator', 'finance', 'read']) expect((await roles[r]!.post('/admin/queues/jobs/pause', {}).expect(403)).body.error.code).toBe('FORBIDDEN');
    await sa.post('/admin/queues/jobs/pause', {}).expect(200);
    const q = new Queue('jobs', { connection: bullConnection(app.app.get(ConfigService).get('REDIS_URL')) });
    expect(await q.isPaused()).toBe(true);
    expect((await sa.get('/admin/health').expect(200)).body.data.queues.find((x: any) => x.name === 'jobs').state).toBe('paused');
    await sa.post('/admin/queues/jobs/resume', {}).expect(200);
    expect(await q.isPaused()).toBe(false);
    await q.close();
    expect((await sa.post('/admin/queues/meta-inbound/pause', {}).expect(409)).body.error.code).toBe('CONFLICT');
    await sa.post('/admin/queues/nope/pause', {}).expect(404);
    await sa.post('/admin/queues/jobs/explode', {}).expect(404);
    expect((await auditRows('queue.pause', 'jobs'))[0]).toMatchObject({ actorType: 'admin', actorId: sa.userId });
    expect((await roomEvents('admin:platform', 'health.updated')).length).toBeGreaterThan(0);
  });

  it('run-now adds the scheduler job; unknown scheduler 404; missing cron 422', async () => {
    const r = (await sa.post('/admin/queues/scheduler/run-now', { cron: 'sched-trust-levels' }).expect(200)).body.data;
    expect(r).toMatchObject({ queue: 'scheduler', cron: 'sched-trust-levels' });
    const q = new Queue('scheduler', { connection: bullConnection(app.app.get(ConfigService).get('REDIS_URL')) });
    expect((await q.getJob(r.jobId))?.name).toBe('sched-trust-levels');
    await q.getJob(r.jobId).then((j) => j?.remove());
    await q.close();
    await sa.post('/admin/queues/scheduler/run-now', { cron: 'sched-nothing' }).expect(404);
    expect((await sa.post('/admin/queues/scheduler/run-now', {}).expect(422)).body.error.fields).toEqual({ cron: 'validation.required' });
  });
});

describe('DLQ (03-events §3.2, AT-API-02-style replay)', () => {
  it('failed job listed with masked payload; replay re-enqueues the same payload under <id>:replay1 (support allowed, moderator 403), audited', async () => {
    const data = { orderId: randomUUID(), phone: '0555123456', accessToken: 'secret-token' };
    const { q, id, name } = await failedJob('payments', data);
    const list = (await support.get('/admin/queues/payments/failed?page=1&pageSize=25').expect(200)).body;
    const row = list.data.find((j: any) => j.id === id);
    expect(row).toMatchObject({ queue: 'payments', name, failedReason: 'boom: provider said no', attemptsMade: 1, data: { orderId: data.orderId, phone: '05•• •• •• 56', accessToken: '[redacted]' } });
    expect((await sa.get(`/admin/queues/failed/${id}`).expect(200)).body.data.id).toBe(id);
    await sa.get(`/admin/queues/failed/nope-${randomUUID()}`).expect(404);

    expect((await moderator.post(`/admin/queues/failed/${id}/replay`, {}).expect(403)).body.error.code).toBe('FORBIDDEN');
    const replayed = (await support.post(`/admin/queues/failed/${id}/replay?queue=payments`, {}).expect(200)).body.data;
    expect(replayed).toEqual({ jobId: `${id}_replay1`, queue: 'payments' });
    const again = await q.getJob(replayed.jobId);
    expect(again).toMatchObject({ name, data });
    expect(again!.attemptsMade).toBe(0);
    expect(await q.getJob(id)).toBeUndefined();
    expect((await auditRows('queue.replay', id))[0]).toMatchObject({ actorId: support.userId, after: { queue: 'payments', newJobId: replayed.jobId, replayedBy: support.userId } });
    // a job that is not failed cannot be replayed
    expect((await sa.post(`/admin/queues/failed/${replayed.jobId}/replay?queue=payments`, {}).expect(409)).body.error.code).toBe('CONFLICT');
    await again!.remove();
    await q.close();
  });

  it('replay-failed and drain-failed act on the whole failed set (super_admin), audited', async () => {
    const a = await failedJob('payments', { n: 1 });
    const b = await failedJob('payments', { n: 2 });
    await support.post('/admin/queues/payments/replay-failed', {}).expect(403);
    const r = (await sa.post('/admin/queues/payments/replay-failed', {}).expect(200)).body.data;
    expect(r.replayed).toBeGreaterThanOrEqual(2);
    for (const j of r.jobIds as string[]) await a.q.getJob(j).then((x) => x?.remove());
    const c = await failedJob('payments', { n: 3 });
    const d = (await sa.post('/admin/queues/payments/drain-failed', {}).expect(200)).body.data;
    expect(d.removed).toBeGreaterThanOrEqual(1);
    expect(await c.q.getJob(c.id)).toBeUndefined();
    expect((await auditRows('queue.drain_failed', 'payments')).length).toBeGreaterThan(0);
    await Promise.all([a.q.close(), b.q.close(), c.q.close()]);
  });
});

describe('incidents and the public status page (AT-OPS-03)', () => {
  it('declare ⇒ status page entry, component state, banner, admin alert, subscriber mails; resolve ⇒ duration + post-mortem, banner hidden', async () => {
    const crypto = app.app.get(CryptoService);
    const sub = await db.statusSubscriber.create({ data: { email: `sub-${randomUUID().slice(0, 6)}@exemple.dz`, tokenHash: crypto.sha256('t'), verifiedAt: new Date(), locale: 'fr' } });
    for (const r of ['support', 'moderator', 'finance', 'read']) await roles[r]!.post('/admin/incidents', { title: T('x') }).expect(403);
    expect((await sa.post('/admin/incidents', { severity: 'critical' }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');

    const inc = (await sa.post('/admin/incidents', { title: T('Réponses IA retardées'), severity: 'critical', components: ['ai_agent', 'ai-reply'], body: T('Nous enquêtons.'), banner: true }).expect(201)).body.data;
    expect(inc).toMatchObject({ status: 'open', severity: 'critical', bannerVisible: true, durationMinutes: null, updates: [{ status: 'open', body: { fr: 'Nous enquêtons.' } }] });
    expect((await roomEvents('admin:platform', 'platform.alert')).some((e) => e.payload.kind === 'incident' && e.payload.payload.id === inc.id)).toBe(true);
    expect((await db.outbox.findMany({ where: { topic: 'mail', key: { startsWith: `status-incident:${inc.id}:created:${sub.id}` } } })).length).toBe(1);

    const page = (await request(app.http()).get('/api/v1/status').set('Accept-Language', 'fr').expect(200)).body.data;
    expect(page.overall).toBe('incident');
    expect(page.components.find((c: any) => c.key === 'ai_agent')).toMatchObject({ status: 'incident', name: expect.any(String) });
    expect(page.components.find((c: any) => c.key === 'payment').status).toBe('operational');
    expect(page.banner).toBe('Réponses IA retardées');
    expect(page.incidents[0]).toMatchObject({ id: inc.id, title: 'Réponses IA retardées', updates: [{ body: 'Nous enquêtons.' }] });
    const en = (await request(app.http()).get('/api/v1/status?lang=en').expect(200)).body.data;
    expect(en.incidents.find((i: any) => i.id === inc.id).title).toBe('Réponses IA retardées (en)');
    // the queue listed by the incident shows INCIDENT on ADM-14
    expect((await sa.get('/admin/health').expect(200)).body.data.queues.find((x: any) => x.name === 'ai-reply').state).toBe('incident');

    const upd = (await sa.post(`/admin/incidents/${inc.id}/updates`, { status: 'identified', body: T('Fournisseur en panne.') }).expect(201)).body.data;
    expect(upd).toMatchObject({ status: 'identified', identifiedAt: expect.any(String) });
    await sa.patch(`/admin/incidents/${inc.id}`, { severity: 'major' }).expect(200);

    await sleep(1100);
    const done = (await sa.post(`/admin/incidents/${inc.id}/resolve`, { postMortem: 'Quota fournisseur dépassé.' }).expect(200)).body.data;
    expect(done).toMatchObject({ status: 'resolved', postMortem: 'Quota fournisseur dépassé.', bannerVisible: false, durationMinutes: expect.any(Number) });
    const after = (await request(app.http()).get('/api/v1/status').expect(200)).body.data;
    expect(after.banner).toBeNull();
    expect(after.incidents.find((i: any) => i.id === inc.id)).toMatchObject({ status: 'resolved', resolvedAt: expect.any(String), durationMinutes: expect.any(Number) });
    expect(after.components.find((c: any) => c.key === 'ai_agent').uptime90d).toBeLessThanOrEqual(100);
    const versions = await db.platformSettingVersion.findMany({ where: { setting: { key: 'incident_banner' } }, orderBy: { version: 'desc' }, take: 2 });
    expect((versions[0]!.value as any).visible).toBe(false);
    expect((await auditRows('incident.create', inc.id))[0]).toMatchObject({ actorId: sa.userId });
    expect((await auditRows('incident.resolve', inc.id)).length).toBe(1);

    expect((await sa.get('/admin/incidents?status=resolved').expect(200)).body.data.some((i: any) => i.id === inc.id)).toBe(true);
    await sa.get(`/admin/incidents/${randomUUID()}`).expect(404);
    await sa.post(`/admin/incidents/${randomUUID()}/resolve`, {}).expect(404);
    await roles.read!.get(`/admin/incidents/${inc.id}`).expect(200);
  });

  it('subscribe ⇒ 202 + confirmation mail (token sealed); confirm; unsubscribe; unknown tokens 404; invalid e-mail 422', async () => {
    const email = `suivi-${randomUUID().slice(0, 6)}@exemple.dz`;
    const anon = request(app.http());
    await anon.post('/api/v1/status/subscribe').send({ email: 'pas-un-mail' }).expect(422);
    await anon.post('/api/v1/status/subscribe').send({ email, locale: 'ar' }).expect(202);
    const sub = await db.statusSubscriber.findUniqueOrThrow({ where: { email } });
    const mail = await db.outbox.findFirstOrThrow({ where: { topic: 'mail', key: { startsWith: `status-subscribe:${sub.id}` } } });
    expect(mail.payload).toMatchObject({ to: email, template: 'status/subscribe-confirm', locale: 'ar' });
    const secret = app.app.get(CryptoService).decryptJson<{ url: string }>((mail.payload as any).sealed);
    const token = secret.url.split('/status/confirm/')[1]!;
    const confirmed = (await anon.get(`/api/v1/status/confirm/${token}`).expect(200)).body.data;
    expect(confirmed).toMatchObject({ email, subscribed: true });
    expect((await db.statusSubscriber.findUniqueOrThrow({ where: { email } })).verifiedAt).not.toBeNull();
    // an active subscriber asking again gets nothing new (still 202: no enumeration)
    await anon.post('/api/v1/status/subscribe').send({ email }).expect(202);
    expect(await db.outbox.count({ where: { topic: 'mail', key: { startsWith: `status-subscribe:${sub.id}` } } })).toBe(1);
    await anon.get('/api/v1/status/confirm/nope').expect(404);
    await anon.get(`/api/v1/status/unsubscribe/${sub.id}.0000`).expect(404);
    await anon.get(`/api/v1/status/unsubscribe/${confirmed.unsubscribeToken}`).expect(200);
    expect((await db.statusSubscriber.findUniqueOrThrow({ where: { email } })).unsubscribedAt).not.toBeNull();
  });
});

describe('metrics and throughput limits', () => {
  it('GET /metrics (internal network) exposes the M3/M4/M6 carry-over metrics', async () => {
    const text = (await request(app.http()).get('/api/v1/metrics').expect(200)).text;
    for (const m of ['meta_webhook_ack_seconds', 'meta_webhook_invalid_signature_total', 'meta_send_failures_total', 'ai_run_latency_seconds', 'ai_run_errors_total', 'credits_debited_total', 'courier_requests_total', 'courier_unknown_status_total', 'bullmq_jobs']) expect(text).toContain(m);
  });

  it('ai-reply workspace semaphore: 2 holders max, released slots are reusable, a crashed holder expires', async () => {
    const redis = app.app.get(RedisService).client;
    const key = `ai-reply:test-${randomUUID()}`;
    expect(await acquireSemaphore(redis, key, 'a', 2, 60_000)).toBe(true);
    expect(await acquireSemaphore(redis, key, 'b', 2, 60_000)).toBe(true);
    expect(await acquireSemaphore(redis, key, 'c', 2, 60_000)).toBe(false);
    expect(await acquireSemaphore(redis, key, 'a', 2, 60_000)).toBe(true); // same holder re-entering
    await releaseSemaphore(redis, key, 'a');
    expect(await acquireSemaphore(redis, key, 'c', 2, 60_000)).toBe(true);
    const short = `ai-reply:test-${randomUUID()}`;
    expect(await acquireSemaphore(redis, short, 'x', 1, 50)).toBe(true);
    expect(await acquireSemaphore(redis, short, 'y', 1, 50)).toBe(false);
    await sleep(80);
    expect(await acquireSemaphore(redis, short, 'y', 1, 50)).toBe(true);
  });
});
