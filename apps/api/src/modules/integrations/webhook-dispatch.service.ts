// API-03 / 03-events §1 (`webhook` topic) + §3 (`outbox/webhook-dispatch`) + §6 — outbound webhook delivery.
// Outbox row `{ event, data }` ⇒ one `WebhookDelivery` per active endpoint subscribed to the event (deduplicated by the event id
// derived from the outbox key) ⇒ job `wh:<deliveryId>:<attempt>`. Each attempt: HMAC-signed POST, 5 s timeout, 2xx = success.
// A failed attempt increments the endpoint's consecutive failure counter (reset by a success); at 50 the endpoint is disabled
// and Owners / Admins get `webhook.disabled`. Retries after 1 min, 5 min, 30 min, 2 h, 12 h, 24 h (7 attempts at most).
// In development / test only local / LAN receivers are called unless WEBHOOKS_ALLOW_LIVE=true.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { WEBHOOK_DELIVERY_RETENTION_DAYS, WEBHOOK_DISABLE_AFTER, WEBHOOK_MAX_ATTEMPTS, WEBHOOK_RETRY_DELAYS_S, WEBHOOK_TIMEOUT_MS } from '@djaber/shared';
import { prisma, TenantContext, type Prisma, type Tx, type WebhookDelivery, type WebhookEndpoint } from '@djaber/db';
import { AuditService } from '../../core/audit/audit.service';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { RedisService } from '../../core/redis/redis.provider';
import { NotificationProducer } from '../notifications/notification.producer';
import { isLocalHost, signWebhook } from './webhook-signing';

type OutboxRow = { id: string; key: string; payload: any; workspaceId: string | null };
type JobData = { deliveryId: string; attempt: number; workspaceId: string };

/** `ping` (the "Tester" button) is a single attempt; every other event uses the 06 §4 schedule. */
export const maxAttemptsOf = (event: string) => (event === 'ping' ? 1 : WEBHOOK_MAX_ATTEMPTS);

/** One-line label of a delivery in the log ("order.created · #CMD-1042"). */
export const deliverySummary = (event: string, payload: unknown): string | null => {
  const data = ((payload as { data?: any } | null)?.data ?? {}) as any;
  const order = data.order ?? (event === 'order.created' ? data : null);
  if (order?.number) return String(order.number).startsWith('#') ? String(order.number) : `#${order.number}`;
  if (event.startsWith('stock.') || event.startsWith('product.')) return data.name ?? data.sku ?? data.product?.name ?? null;
  if (data.client?.name) return String(data.client.name);
  if (event === 'customer.blocked') return data.phone ?? null;
  if (event === 'payment.failed') return data.reason ?? null;
  if (event === 'conversation.escalated') return data.reason ?? null;
  return null;
};

/** Deterministic public event id of an outbox row (the same event to several endpoints shares it; a replay keeps it). */
export const eventIdOf = (outboxKey: string) => `evt_${createHash('sha256').update(outboxKey).digest('hex').slice(0, 26)}`;

@Injectable()
export class WebhookDispatchService implements OnModuleInit {
  private readonly log = new Logger(WebhookDispatchService.name);
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueOutbox,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationProducer,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.registry.onOutbox('webhook', (row) => this.fanOut(row));
    this.registry.register('outbox', 'webhook-dispatch', (data: JobData) => this.attempt(data), { concurrency: 8 });
    // 03-events §4 sched-retention: deliveries are kept 30 days
    this.registry.extendCron('sched-retention', 'webhook-deliveries', () => this.purge());
  }

  // --- producing ----------------------------------------------------------------------------------------------------------
  /** Outbox `webhook` row ⇒ deliveries for the subscribed active endpoints of the workspace (suspended workspace ⇒ none, ADM-02). */
  async fanOut(row: OutboxRow) {
    const p = row.payload as { event?: string; data?: unknown; workspaceId?: string };
    const workspaceId = row.workspaceId ?? p.workspaceId;
    if (!workspaceId || !p.event) return;
    await TenantContext.runSystem(async () => {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { status: true, deletedAt: true } });
      if (!ws || ws.deletedAt || ws.status === 'suspended') return;
      const endpoints = await prisma.webhookEndpoint.findMany({ where: { workspaceId, isActive: true, events: { has: p.event } } });
      if (!endpoints.length) return;
      const eventId = eventIdOf(row.key);
      await prisma.$transaction(async (db) => {
        const tx = db as Tx;
        for (const e of endpoints) {
          const exists = await tx.webhookDelivery.findFirst({ where: { endpointId: e.id, payload: { path: ['id'], equals: eventId } }, select: { id: true } });
          if (exists) continue; // the outbox row was relayed twice
          await this.createDelivery(tx, e, p.event!, p.data ?? {}, row.key, eventId);
        }
      });
    });
  }

  /** Stores a `pending` delivery and schedules its first attempt (outbox `job`, same transaction). */
  async createDelivery(tx: Tx, e: Pick<WebhookEndpoint, 'id' | 'workspaceId'>, event: string, data: unknown, key: string, eventId = eventIdOf(key)) {
    const payload = { id: eventId, event, createdAt: new Date().toISOString(), workspaceId: e.workspaceId, data } as Prisma.InputJsonValue;
    return this.enqueueDelivery(tx, e, { event, payload });
  }

  async enqueueDelivery(tx: Tx, e: Pick<WebhookEndpoint, 'id' | 'workspaceId'>, d: { event: string; payload: Prisma.InputJsonValue; replayOfId?: string }) {
    const delivery = await tx.webhookDelivery.create({ data: { endpointId: e.id, event: d.event, payload: d.payload, attempt: 1, status: 'pending', replayOfId: d.replayOfId ?? null } });
    await this.queue.add(tx, 'outbox', 'webhook-dispatch', { deliveryId: delivery.id, attempt: 1, workspaceId: e.workspaceId }, `wh:${delivery.id}:1`, { attempts: 3, backoff: { type: 'fixed', delay: 30_000 } });
    return delivery;
  }

  // --- one attempt (worker) -------------------------------------------------------------------------------------------------
  /** Safe to run twice: only the `pending` delivery whose current attempt is `data.attempt` is sent, under a Redis claim. */
  async attempt(data: JobData): Promise<{ status: string }> {
    const claim = await this.redis.client.set(`wh:claim:${data.deliveryId}:${data.attempt}`, '1', 'EX', 120, 'NX');
    if (!claim) return { status: 'claimed' };
    try {
      return await TenantContext.runSystem(() => this.send(data));
    } catch (e) {
      await this.redis.client.del(`wh:claim:${data.deliveryId}:${data.attempt}`);
      throw e;
    }
  }

  private async send(data: JobData): Promise<{ status: string }> {
    const d = await prisma.webhookDelivery.findUnique({ where: { id: data.deliveryId }, include: { endpoint: true } });
    if (!d || d.status !== 'pending' || d.attempt !== data.attempt) return { status: 'skipped' };
    const e = d.endpoint;
    if (!e.isActive) {
      await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: 'failed', nextAttemptAt: null, error: 'WEBHOOK_ENDPOINT_DISABLED' } });
      return { status: 'endpoint_disabled' };
    }
    const url = new URL(e.url);
    if (!this.config.isProd && !this.config.get('WEBHOOKS_ALLOW_LIVE') && !isLocalHost(url.hostname)) {
      // dev / test safety: a third-party URL is never called; recorded without retry and without counting as a failure
      await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: 'failed', nextAttemptAt: null, error: 'blocked: WEBHOOKS_ALLOW_LIVE=false' } });
      return { status: 'blocked' };
    }

    const body = JSON.stringify(d.payload);
    const secret = this.crypto.decrypt(Buffer.from(e.secret).toString('utf8'));
    const started = Date.now();
    let code: number | null = null;
    let error: string | null = null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(e.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Djaber-Webhooks/1',
          'X-Djaber-Event': d.event,
          'X-Djaber-Delivery': d.id,
          'X-Djaber-Signature': signWebhook(secret, body),
        },
        body,
        signal: ctrl.signal,
        redirect: 'manual',
      });
      code = res.status;
      if (res.status < 200 || res.status >= 300) error = (await res.text().catch(() => '')).slice(0, 300) || `HTTP ${res.status}`;
    } catch (err) {
      error = ctrl.signal.aborted ? `timeout after ${WEBHOOK_TIMEOUT_MS / 1000} s` : String((err as Error)?.message ?? err).slice(0, 300);
    } finally {
      clearTimeout(timer);
    }
    const durationMs = Date.now() - started;
    const ok = code !== null && code >= 200 && code < 300;

    if (ok) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: 'success', responseCode: code, durationMs, error: null, nextAttemptAt: null } }),
        prisma.webhookEndpoint.update({ where: { id: e.id }, data: { failureCount: 0, lastDeliveryAt: new Date() } }),
      ]);
      return { status: 'success' };
    }
    return this.onFailure(d, e, { code, error, durationMs });
  }

  private async onFailure(d: WebhookDelivery, e: WebhookEndpoint, r: { code: number | null; error: string | null; durationMs: number }) {
    const max = maxAttemptsOf(d.event);
    return prisma.$transaction(async (db) => {
      const tx = db as Tx;
      const [endpoint] = await tx.$queryRaw<{ failureCount: number; isActive: boolean }[]>`
        UPDATE "WebhookEndpoint" SET "failureCount" = "failureCount" + 1, "lastDeliveryAt" = now(), "updatedAt" = now()
        WHERE "id" = ${e.id}::uuid RETURNING "failureCount", "isActive"`;
      let disabledNow = false;
      if (endpoint && endpoint.isActive && endpoint.failureCount >= WEBHOOK_DISABLE_AFTER) {
        const n = await tx.webhookEndpoint.updateMany({ where: { id: e.id, workspaceId: e.workspaceId, isActive: true }, data: { isActive: false, disabledAt: new Date(), disabledReason: 'WEBHOOK_ENDPOINT_DISABLED' } });
        disabledNow = n.count > 0;
      }
      const stillActive = endpoint?.isActive && !disabledNow;
      const retry = stillActive && d.attempt < max;
      const base = { responseCode: r.code, durationMs: r.durationMs, error: r.error };
      if (retry) {
        const delayS = WEBHOOK_RETRY_DELAYS_S[d.attempt - 1] ?? WEBHOOK_RETRY_DELAYS_S[WEBHOOK_RETRY_DELAYS_S.length - 1]!;
        const next = d.attempt + 1;
        await tx.webhookDelivery.update({ where: { id: d.id }, data: { ...base, status: 'pending', attempt: next, nextAttemptAt: new Date(Date.now() + delayS * 1000) } });
        await this.queue.add(tx, 'outbox', 'webhook-dispatch', { deliveryId: d.id, attempt: next, workspaceId: e.workspaceId }, `wh:${d.id}:${next}`, { delay: delayS * 1000, attempts: 3, backoff: { type: 'fixed', delay: 30_000 } });
      } else {
        await tx.webhookDelivery.update({ where: { id: d.id }, data: { ...base, status: d.attempt >= max ? 'exhausted' : 'failed', nextAttemptAt: null } });
      }
      if (disabledNow) {
        await this.notifications.emit(tx, { type: 'webhook_disabled', workspaceId: e.workspaceId, target: { roles: ['owner', 'admin'] }, key: `webhook_disabled:${e.id}:${Date.now()}`, data: { endpointId: e.id, url: e.url, responseCode: r.code ?? 0 } });
        await tx.auditLog.create({ data: { workspaceId: e.workspaceId, actorType: 'system', action: 'webhook.auto_disabled', entity: 'WebhookEndpoint', entityId: e.id, after: { failureCount: endpoint!.failureCount, lastResponseCode: r.code } } });
        this.log.warn({ endpointId: e.id, failures: endpoint!.failureCount }, 'webhook endpoint disabled after consecutive failures');
      }
      return { status: retry ? 'retry' : 'failed' };
    });
  }

  async purge(now = new Date()) {
    const cutoff = new Date(now.getTime() - WEBHOOK_DELIVERY_RETENTION_DAYS * 86_400_000);
    return TenantContext.runSystem(() => prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: cutoff }, status: { not: 'pending' } } }));
  }
}
