// Helpers of the M9 suites (billing, credits, packs, IAP, order payments). Nothing here leaves the process: the payment
// gateway is `ChargilyGateway` on the simulated Chargily API (PAYMENT_DRIVER=fake), the stores are the fake validators
// (IAP_DRIVER=fake), and `forbidNetwork` fails any real call. The worker side runs synchronously.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { rawPrisma as db, TenantContext } from '@djaber/db';
import { ProcessorRegistry } from '../../src/core/queue/processor.registry';
import { TenantResolver } from '../../src/core/tenancy/tenant.resolver';
import { FAKE_CHARGILY } from '../../src/modules/billing/dev-billing.service';
import { DunningService } from '../../src/modules/billing/dunning.service';
import type { FakeChargilyBackend, FakeOutcome } from '../../src/modules/billing/gateway/fake-chargily';
import { PaymentService } from '../../src/modules/billing/payment.service';
import type { Actor } from './actors';
import { createUser } from './actors';
import type { TestApp } from './app';
import { drain } from './m2';

export const idem = () => ({ 'Idempotency-Key': randomUUID() });
export const DAY = 86_400_000;

export const fakeChargily = (app: TestApp): FakeChargilyBackend => {
  const f = app.app.get<FakeChargilyBackend | null>(FAKE_CHARGILY);
  if (!f) throw new Error('tests must run with the simulated Chargily (PAYMENT_DRIVER=fake)');
  return f;
};

export const planId = async (slug: string) => (await db.plan.findUniqueOrThrow({ where: { slug } })).id;
export const packBySlug = (slug: string) => db.creditPack.findUniqueOrThrow({ where: { slug } });
export const checkoutIdOf = (url: string) => url.split('/').pop()!;

/** Posts a raw webhook body to `/webhooks/chargily` (signed with the simulated Chargily secret unless `signature` is given). */
export const postChargilyWebhook = (app: TestApp, raw: Buffer | string, signature?: string | null) => {
  const r = request(app.http()).post('/api/v1/webhooks/chargily').set('Content-Type', 'application/json');
  if (signature !== null) r.set('signature', signature ?? fakeChargily(app).sign(raw));
  return r.send(typeof raw === 'string' ? raw : raw.toString('utf8'));
};

/** The tester's choice on the fake checkout page, delivered as Chargily's signed webhook through the real endpoint (worker drained). */
export const payFake = async (app: TestApp, checkoutUrl: string, outcome: FakeOutcome = 'paid', o: { workspaceId?: string; drainAfter?: boolean } = {}) => {
  const id = checkoutIdOf(checkoutUrl);
  const r = await fakeChargily(app).decide(id, outcome);
  if (!r) throw new Error(`unknown fake checkout ${id}`);
  if (r.webhook) {
    await postChargilyWebhook(app, r.webhook.rawBody, r.webhook.signature).expect(200);
    if (o.drainAfter !== false) await runPayments(app);
  }
  return r;
};

/** Runs the pending `payments` jobs (payment-webhook, order-link-create, iap-validate, store-notification) and the given workspace's jobs / notifications. */
export const runPayments = async (app: TestApp, workspaceIds: string[] = []) => {
  const registry = app.app.get(ProcessorRegistry);
  for (let round = 0; round < 10; round++) {
    const rows = await db.outbox.findMany({ where: { processedAt: null, topic: 'job' }, orderBy: { createdAt: 'asc' } });
    const mine = rows.filter((r) => (r.payload as { queue?: string }).queue === 'payments' || (workspaceIds.length && workspaceIds.includes(r.workspaceId ?? '')));
    if (!mine.length) break;
    for (const row of mine) {
      const p = row.payload as { queue: string; name: string; data: Record<string, unknown> };
      const handler = registry.handlers.get(p.queue as never)?.get(p.name);
      if (!handler) throw new Error(`no handler for ${p.queue}/${p.name}`);
      await TenantContext.runSystem(() => handler(p.data, { id: row.key, name: p.name, attemptsMade: 0 } as never));
      await db.outbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
    }
  }
  for (const ws of workspaceIds) await drain(app, ws);
};

export const currentSubOf = (workspaceId: string) => db.subscription.findFirstOrThrow({ where: { workspaceId, status: { in: ['trial', 'active', 'dunning'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
export const invalidate = (app: TestApp, workspaceId: string) => app.app.get(TenantResolver).invalidate(workspaceId);

/** Moves the current subscription to a period ending at `end` (start = end − 1 month, or `start`). */
export const setPeriod = async (app: TestApp, workspaceId: string, end: Date, o: { start?: Date; trialEndsAt?: Date | null } = {}) => {
  const s = await currentSubOf(workspaceId);
  const start = o.start ?? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()));
  await db.subscription.update({ where: { id: s.id }, data: { currentPeriodStart: start, currentPeriodEnd: end, ...(o.trialEndsAt !== undefined ? { trialEndsAt: o.trialEndsAt } : {}) } });
  await invalidate(app, workspaceId);
};

/** A trial workspace (as sign-up creates it: pro, 14 days, provider none) — `createWorkspace` makes paid pro rows. */
export const makeTrial = async (app: TestApp, workspaceId: string, endsAt = new Date(Date.now() + 14 * DAY)) => {
  const s = await currentSubOf(workspaceId);
  await db.subscription.update({ where: { id: s.id }, data: { status: 'trial', billingCycle: 'none', provider: 'none', appliedPrice: 0, trialEndsAt: endsAt, currentPeriodEnd: endsAt } });
  await invalidate(app, workspaceId);
};

/** A paid subscription on `slug` (Chargily provider), period [start, end). */
export const makePaid = async (app: TestApp, workspaceId: string, slug = 'starter', cycle: 'monthly' | 'yearly' = 'monthly', end = new Date(Date.now() + 20 * DAY)) => {
  const s = await currentSubOf(workspaceId);
  const plan = await db.plan.findUniqueOrThrow({ where: { slug } });
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (cycle === 'yearly' ? 12 : 1), end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds()));
  await db.subscription.update({ where: { id: s.id }, data: { planId: plan.id, status: 'active', billingCycle: cycle, provider: 'chargily', appliedPrice: cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly, currentPeriodStart: start, currentPeriodEnd: end, trialEndsAt: null, dunningStage: null } });
  await invalidate(app, workspaceId);
  return currentSubOf(workspaceId);
};

export const runExpiry = (app: TestApp, now?: Date) => app.app.get(DunningService).runExpiry(now);
export const runDunning = (app: TestApp, now?: Date) => app.app.get(DunningService).runDunning(now);
export const reconcile = (app: TestApp, now?: Date) => app.app.get(PaymentService).reconcile(now);
/** `sched-payment-reconcile` with its steps (pending IAP purchases, order links). */
export const runReconcileCron = async (app: TestApp) => {
  const task = app.app.get(ProcessorRegistry).crons.find((c) => c.name === 'sched-payment-reconcile');
  if (!task) throw new Error('sched-payment-reconcile not registered');
  return task.handler();
};
/** A real AiRun row (credit reservations reference it). */
export const aiRun = async (workspaceId: string) => {
  const route = await db.aiRoute.findUniqueOrThrow({ where: { capability: 'text' }, include: { primaryModel: true } });
  return db.aiRun.create({ data: { workspaceId, kind: 'reply', modelId: route.primaryModelId, providerId: route.primaryModel.providerId } });
};

/** N live top-level channels created directly (oldest first), for the 02 §5 pause rule. */
export const channels = async (workspaceId: string, n: number) => {
  const user = await db.membership.findFirstOrThrow({ where: { workspaceId, role: 'owner' } });
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await db.channel.create({ data: { workspaceId, platform: 'facebook', externalId: `page-${randomUUID()}`, name: `Page ${i + 1}`, connectedById: user.userId, status: 'active', createdAt: new Date(Date.now() - (n - i) * 60_000) } }));
  }
  return out;
};
export const agents = async (workspaceId: string, n: number) => {
  const out = [];
  const route = await db.aiRoute.findUniqueOrThrow({ where: { capability: 'text' } });
  for (let i = 0; i < n; i++) out.push(await db.agent.create({ data: { workspaceId, name: `Agent ${i + 1}`, modelId: route.primaryModelId, status: 'active', isActive: true, createdAt: new Date(Date.now() - (n - i) * 60_000) } }));
  return out;
};
export const members = async (workspaceId: string, n: number) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = await createUser();
    out.push(await db.membership.create({ data: { workspaceId, userId: u.id, role: 'operator', createdAt: new Date(Date.now() - (n - i) * 60_000 + 30_000) } }));
  }
  return out;
};

export const notificationsOf = (workspaceId: string, type: string) => db.notification.findMany({ where: { workspaceId, type: type as never } });
export const outboxNotifications = async (workspaceId: string, type: string) => (await db.outbox.findMany({ where: { workspaceId, topic: 'notification' } })).filter((r) => (r.payload as { type?: string }).type === type);

export type { Actor };
export { db };
