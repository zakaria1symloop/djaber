// 07-non-functional §5 "Metrics" + carry-overs M3/M4/M6 — Prometheus registry of the process (API or worker), scraped on
// `/metrics` (internal network only). The Meta webhook figures are also written to Redis hourly buckets so that the
// instance serving `GET /admin/health` (ADM-14) sees the totals of every instance of the last 24 h.
import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { RedisService } from '../redis/redis.provider';

/** Ack-time bucket boundaries (ms) of the Redis histogram; the last bucket is `+Inf`. */
export const ACK_BUCKETS_MS = [100, 250, 500, 1000, 2000, 5000, 10000] as const;
const HOUR = 3600_000;
const BUCKET_TTL_S = 26 * 3600;
export const metaBucketKey = (at: number) => `metrics:meta-webhook:${Math.floor(at / HOUR)}`;

export type MetaWebhookTotals = { acks: number; invalidSignatures: number; ackOver5s: number; deduped: number; ackUnder1s: number; ackP95Ms: number };

/** p95 from a bucket histogram (upper bound of the bucket holding the 95th percentile). */
export const p95FromBuckets = (counts: number[], bounds: readonly number[]): number => {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const target = Math.ceil(total * 0.95);
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    seen += counts[i] ?? 0;
    if (seen >= target) return bounds[i] ?? (bounds[bounds.length - 1] ?? 0) * 2;
  }
  return bounds[bounds.length - 1] ?? 0;
};

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly metaAck = new Histogram({ name: 'meta_webhook_ack_seconds', help: 'Meta webhook ack time', buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10], registers: [this.registry] });
  readonly metaInvalidSignature = new Counter({ name: 'meta_webhook_invalid_signature_total', help: 'Meta webhook calls with an invalid X-Hub-Signature-256', registers: [this.registry] });
  readonly metaDeduped = new Counter({ name: 'meta_webhook_deduped_total', help: 'Meta webhook events already stored (redeliveries)', registers: [this.registry] });
  readonly metaSendFailures = new Counter({ name: 'meta_send_failures_total', help: 'Final failures of Meta sends', labelNames: ['code'], registers: [this.registry] });
  readonly aiLatency = new Histogram({ name: 'ai_run_latency_seconds', help: 'AI run duration', labelNames: ['status'], buckets: [0.5, 1, 2, 5, 10, 20, 45, 90], registers: [this.registry] });
  readonly aiErrors = new Counter({ name: 'ai_run_errors_total', help: 'AI runs closed in error', labelNames: ['provider'], registers: [this.registry] });
  readonly creditsDebited = new Counter({ name: 'credits_debited_total', help: 'Credits debited by AI runs', registers: [this.registry] });
  readonly courierRequests = new Counter({ name: 'courier_requests_total', help: 'Courier adapter calls', labelNames: ['provider', 'outcome'], registers: [this.registry] });
  readonly courierUnknownStatus = new Counter({ name: 'courier_unknown_status_total', help: 'Courier statuses without a mapping', labelNames: ['provider', 'raw'], registers: [this.registry] });
  readonly queueJobs = new Gauge({ name: 'bullmq_jobs', help: 'BullMQ jobs per queue and state (collected on scrape)', labelNames: ['queue', 'state'], registers: [this.registry] });
  private collector?: () => Promise<Record<string, Record<string, number>>>;
  private defaults = false;

  constructor(private readonly redis: RedisService) {}

  /** Queue counts read at scrape time (set by the health module, which owns the queue list). */
  setQueueCollector(fn: () => Promise<Record<string, Record<string, number>>>) {
    this.collector = fn;
  }

  async text(): Promise<string> {
    if (!this.defaults) {
      collectDefaultMetrics({ register: this.registry });
      this.defaults = true;
    }
    if (this.collector) {
      const counts = await this.collector().catch(() => ({}) as Record<string, Record<string, number>>);
      for (const [queue, states] of Object.entries(counts)) for (const [state, n] of Object.entries(states)) this.queueJobs.set({ queue, state }, n);
    }
    return this.registry.metrics();
  }

  get contentType() {
    return this.registry.contentType;
  }

  // --- Meta webhook (M3 carry-over) -------------------------------------------------------------------------------------
  private async bump(fields: Record<string, number>) {
    const key = metaBucketKey(Date.now());
    const m = this.redis.client.multi();
    for (const [f, n] of Object.entries(fields)) m.hincrby(key, f, n);
    m.expire(key, BUCKET_TTL_S);
    await m.exec().catch(() => undefined);
  }

  async metaWebhookAck(ms: number) {
    this.metaAck.observe(ms / 1000);
    const i = ACK_BUCKETS_MS.findIndex((b) => ms <= b);
    await this.bump({ acks: 1, [`b${i < 0 ? ACK_BUCKETS_MS.length : i}`]: 1, ...(ms > 5000 ? { over5s: 1 } : {}) });
  }

  async metaWebhookInvalidSignature() {
    this.metaInvalidSignature.inc();
    await this.bump({ invalid: 1 });
  }

  async metaWebhookDeduped(n: number) {
    if (n <= 0) return;
    this.metaDeduped.inc(n);
    await this.bump({ deduped: n });
  }

  /** Sum of the last 24 hourly buckets. */
  async metaWebhookTotals(now = Date.now()): Promise<MetaWebhookTotals> {
    const keys = Array.from({ length: 24 }, (_, i) => metaBucketKey(now - i * HOUR));
    const rows = await Promise.all(keys.map((k) => this.redis.client.hgetall(k).catch(() => ({}) as Record<string, string>)));
    const sum = (f: string) => rows.reduce((n, r) => n + Number(r[f] ?? 0), 0);
    const buckets = Array.from({ length: ACK_BUCKETS_MS.length + 1 }, (_, i) => sum(`b${i}`));
    const acks = sum('acks');
    const under1s = buckets.slice(0, ACK_BUCKETS_MS.indexOf(1000) + 1).reduce((a, b) => a + b, 0);
    return { acks, invalidSignatures: sum('invalid'), ackOver5s: sum('over5s'), deduped: sum('deduped'), ackUnder1s: under1s, ackP95Ms: p95FromBuckets(buckets, ACK_BUCKETS_MS) };
  }

  // --- AI / credits (M4 carry-over) --------------------------------------------------------------------------------------
  aiRun(status: string, ms: number, provider: string | null) {
    this.aiLatency.observe({ status }, ms / 1000);
    if (status === 'error') this.aiErrors.inc({ provider: provider ?? 'unknown' });
  }

  // --- couriers (M6 carry-over) ------------------------------------------------------------------------------------------
  courier(provider: string, outcome: string) {
    this.courierRequests.inc({ provider, outcome });
  }
  courierUnknown(provider: string, raw: string) {
    this.courierUnknownStatus.inc({ provider, raw: raw.slice(0, 60) });
  }
}
