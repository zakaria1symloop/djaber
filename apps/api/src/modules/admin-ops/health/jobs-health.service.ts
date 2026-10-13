// ADM-14 — jobs & health (03 §27 OPS-01…04, 03-events-and-jobs §3.2): BullMQ queues with their state, the DLQ (failed
// jobs) with replay, the scheduler list ("Lancer maintenant"), Meta webhook figures of the last 24 h, AI health,
// duplicated AI orders and worker heartbeats. Queue actions are audited and announced on `admin:platform`.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, type Job } from 'bullmq';
import { prisma, type Tx } from '@djaber/db';
import type { FailedJobDto, HealthDto, QueueHealthDto } from '@djaber/shared';
import { AuditService, redact } from '../../../core/audit/audit.service';
import { ConfigService } from '../../../core/config/config.service';
import { AppException, notFound, validationError } from '../../../core/errors/app.exception';
import { page, type Page } from '../../../core/http/pagination';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { OutboxService } from '../../../core/outbox/outbox.service';
import { ProcessorRegistry } from '../../../core/queue/processor.registry';
import { bullConnection, jobId, QUEUES, QueueService, type QueueName } from '../../../core/queue/queue.service';
import { RedisService } from '../../../core/redis/redis.provider';
import { auditAdmin, sys, type PlatformActor } from '../admin-ops.util';

export const SCHEDULER_QUEUE = 'scheduler';
export const HEALTH_QUEUES = [...QUEUES, SCHEDULER_QUEUE] as const;
/** `meta-inbound` cannot be paused (03-events §3: webhooks are acked and must keep flowing); the scheduler is not a work queue. */
const UNPAUSABLE = new Set<string>(['meta-inbound', SCHEDULER_QUEUE]);
/**
 * Expected p95 run time per queue (ms) — the "baseline" of the `warning` rule (p95 > 3 × baseline). Constants chosen from the
 * budgets of 03-events §3 / 07-non-functional (AI 45 s budget, courier 15 s timeout, Meta 10 s).
 */
export const QUEUE_BASELINE_P95_MS: Record<string, number> = { 'meta-inbound': 1_000, 'ai-reply': 15_000, media: 10_000, outbox: 3_000, jobs: 60_000, courier: 10_000, payments: 5_000, notifications: 3_000, scheduler: 60_000 };
export const WORKERS_KEY = 'health:workers';
const REPLAYS_KEY = (q: string) => `health:replays:${q}`;
const FAILED_WARN_PER_HOUR = 10;
const SAMPLE = 200;
const REPLAY_ALL_MAX = 1000;
const HOUR = 3600_000;

/** p95 of a list of durations (ms); 0 when empty. */
export const p95 = (values: number[]): number => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]!;
};

/** 03-events §3.2 queue state rule. */
export const queueState = (o: { paused: boolean; incident: boolean; failedLastHour: number; p95Ms: number; baselineMs: number }): QueueHealthDto['state'] =>
  o.paused ? 'paused' : o.incident ? 'incident' : o.failedLastHour > FAILED_WARN_PER_HOUR || (o.p95Ms > 0 && o.p95Ms > 3 * o.baselineMs) ? 'warning' : 'ok';

const PHONE = /(\+?213|0)[5-7]\d{8}/g;
/** DLQ payloads: secrets redacted (audit rule) and phone numbers masked (PII in admin viewers, CLAUDE.md rule 9). */
export const maskJobData = (v: unknown, depth = 0): unknown => {
  if (depth > 6) return null;
  const r = depth === 0 ? redact(v) : v;
  if (typeof r === 'string') return r.replace(PHONE, (p) => `${p.slice(0, 2)}•• •• •• ${p.slice(-2)}`);
  if (Array.isArray(r)) return r.slice(0, 50).map((x) => maskJobData(x, depth + 1));
  if (r && typeof r === 'object') return Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, x]) => [k, maskJobData(x, depth + 1)]));
  return r;
};

@Injectable()
export class JobsHealthService implements OnModuleInit, OnModuleDestroy {
  private scheduler?: Queue;
  constructor(
    private readonly queues: QueueService,
    private readonly config: ConfigService,
    private readonly registry: ProcessorRegistry,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.metrics.setQueueCollector(() => this.queues.counts());
  }

  async onModuleDestroy() {
    await this.scheduler?.close().catch(() => undefined);
  }

  queue(name: string): Queue {
    if (name === SCHEDULER_QUEUE) {
      this.scheduler ??= new Queue(SCHEDULER_QUEUE, { connection: bullConnection(this.config.get('REDIS_URL')) });
      return this.scheduler;
    }
    if (!(QUEUES as readonly string[]).includes(name)) throw notFound();
    return this.queues.queue(name as QueueName);
  }

  // --- health -------------------------------------------------------------------------------------------------------------
  private async queueHealth(name: string, incidentQueues: Set<string>): Promise<QueueHealthDto> {
    const q = this.queue(name);
    const [counts, paused, completed, failed] = await Promise.all([q.getJobCounts('waiting', 'active', 'failed', 'delayed', 'paused', 'prioritized'), q.isPaused(), q.getCompleted(0, SAMPLE - 1), q.getFailed(0, SAMPLE - 1)]);
    const since = Date.now() - HOUR;
    const durations = completed.filter((j) => j.finishedOn && j.processedOn).map((j) => j.finishedOn! - j.processedOn!);
    const p95Ms = p95(durations);
    const failedLastHour = failed.filter((j) => (j.finishedOn ?? 0) >= since).length;
    const incident = incidentQueues.has(name);
    const state = queueState({ paused, incident, failedLastHour, p95Ms, baselineMs: QUEUE_BASELINE_P95_MS[name] ?? 10_000 });
    return {
      name,
      waiting: (counts.waiting ?? 0) + (counts.paused ?? 0) + (counts.prioritized ?? 0),
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      completedLastHour: completed.filter((j) => (j.finishedOn ?? 0) >= since).length,
      p95Ms,
      state,
      note: state === 'warning' && failedLastHour > FAILED_WARN_PER_HOUR ? `failed_last_hour:${failedLastHour}` : state === 'warning' ? `p95_over_baseline:${QUEUE_BASELINE_P95_MS[name] ?? 10_000}` : null,
      pausable: !UNPAUSABLE.has(name),
    };
  }

  private async metaWebhooks(): Promise<HealthDto['metaWebhooks']> {
    const [rows, totals, median] = await Promise.all([
      prisma.$queryRaw<{ total: bigint; messages: bigint; postbacks: bigint; reads: bigint }[]>`
        SELECT count(*) AS total,
               count(*) FILTER (WHERE "payload"->'item' ? 'message') AS messages,
               count(*) FILTER (WHERE "payload"->'item' ? 'postback') AS postbacks,
               count(*) FILTER (WHERE "payload"->'item' ? 'read') AS reads
        FROM "InboundEvent" WHERE "provider" = 'meta' AND "receivedAt" >= now() - interval '24 hours'`,
      this.metrics.metaWebhookTotals(),
      // inbound customer message → first AI reply of the thread (last 2 000 inbound messages of 24 h)
      prisma.$queryRaw<{ median: number | null }[]>`
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r."createdAt" - m."createdAt")) * 1000)::float AS median
        FROM (SELECT "id", "conversationId", "createdAt" FROM "Message" WHERE "direction" = 'in' AND "author" = 'customer' AND "createdAt" >= now() - interval '24 hours' ORDER BY "createdAt" DESC LIMIT 2000) m
        JOIN LATERAL (SELECT x."createdAt" FROM "Message" x WHERE x."conversationId" = m."conversationId" AND x."author" = 'ai' AND x."createdAt" > m."createdAt" ORDER BY x."createdAt" ASC LIMIT 1) r ON true
        WHERE r."createdAt" - m."createdAt" < interval '1 hour'`,
    ]);
    const r = rows[0];
    const total = Number(r?.total ?? 0);
    const messages = Number(r?.messages ?? 0);
    const postbacks = Number(r?.postbacks ?? 0);
    const reads = Number(r?.reads ?? 0);
    return {
      received24h: total,
      byType: { messages, postbacks, reads, other: Math.max(0, total - messages - postbacks - reads) },
      invalidSignatures: totals.invalidSignatures,
      ackOver5s: totals.ackOver5s,
      p95Ms: totals.ackP95Ms,
      ackP95Ms: totals.ackP95Ms,
      ackUnder1sPct: totals.acks ? Math.round((totals.ackUnder1s / totals.acks) * 100) : null,
      medianToReplyMs: median[0]?.median === null || median[0]?.median === undefined ? null : Math.round(median[0].median),
      dedupedCount: totals.deduped,
    };
  }

  private async ai(): Promise<HealthDto['ai']> {
    const [runs, routes] = await Promise.all([
      prisma.$queryRaw<{ total: bigint; errors: bigint }[]>`SELECT count(*) AS total, count(*) FILTER (WHERE "status" = 'error') AS errors FROM "AiRun" WHERE "startedAt" >= now() - interval '24 hours' AND "status" <> 'running'`,
      prisma.aiRoute.findMany({ include: { primaryModel: { include: { provider: { select: { key: true } } } } } }),
    ]);
    const total = Number(runs[0]?.total ?? 0);
    const text = routes.find((r) => r.capability === 'text');
    return {
      errorRate24hPct: total ? Math.round((Number(runs[0]?.errors ?? 0) / total) * 1000) / 10 : 0,
      failoverActive: routes.some((r) => r.failoverActive),
      provider: text?.primaryModel.provider.key ?? 'none',
      thresholdPct: text?.errorThresholdPct ?? 2,
    };
  }

  /** OPS-04 "duplicated orders 7 d": AI orders of one conversation with the same total created within 10 minutes. */
  private async duplicates7d(): Promise<number> {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Order" a JOIN "Order" b ON b."conversationId" = a."conversationId" AND b."id" > a."id" AND b."total" = a."total"
        AND b."source" = 'ai' AND abs(EXTRACT(EPOCH FROM (b."createdAt" - a."createdAt"))) < 600
      WHERE a."source" = 'ai' AND a."conversationId" IS NOT NULL AND a."createdAt" >= now() - interval '7 days'`;
    return Number(r[0]?.n ?? 0);
  }

  async workers(): Promise<HealthDto['workers']> {
    const all = await this.redis.client.hgetall(WORKERS_KEY).catch(() => ({}) as Record<string, string>);
    const cutoff = Date.now() - 24 * HOUR;
    return Object.entries(all)
      .filter(([, at]) => Date.parse(at) >= cutoff)
      .map(([host, at]) => ({ host, lastHeartbeatAt: at }))
      .sort((a, b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt));
  }

  async schedulers(): Promise<HealthDto['schedulers']> {
    const stored = await this.queue(SCHEDULER_QUEUE).getJobSchedulers().catch(() => []);
    return this.registry.crons.map((c) => {
      const s = stored.find((x) => x.key === c.name);
      return { name: c.name, pattern: c.pattern, nextRunAt: s?.next ? new Date(s.next).toISOString() : null };
    });
  }

  async health(): Promise<HealthDto> {
    return sys(async () => {
      const incidents = await prisma.incident.findMany({ where: { status: { not: 'resolved' } }, orderBy: { startedAt: 'desc' }, take: 20 });
      const incidentQueues = new Set(incidents.flatMap((i) => i.components));
      const [queues, metaWebhooks, ai, duplicates7d, workers, schedulers] = await Promise.all([
        Promise.all(HEALTH_QUEUES.map((n) => this.queueHealth(n, incidentQueues))),
        this.metaWebhooks(),
        this.ai(),
        this.duplicates7d(),
        this.workers(),
        this.schedulers(),
      ]);
      return {
        queues,
        metaWebhooks,
        ai,
        duplicates7d,
        incidents: incidents.map((i) => ({ id: i.id, title: (i.title as { fr?: string })?.fr ?? '', status: i.status, severity: i.severity, startedAt: i.startedAt.toISOString() })),
        workers,
        schedulers,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  // --- queue actions ------------------------------------------------------------------------------------------------------
  private async announce(action: string, queue: string, actor: PlatformActor, after: Record<string, unknown> = {}) {
    await auditAdmin(this.audit, actor, { action: `queue.${action}`, entity: 'Queue', entityId: queue, after: { queue, ...after } });
    await this.outbox.ws(prisma as unknown as Tx, 'admin:platform', 'health.updated', { queue, action }, `health.updated:${queue}:${action}:${Date.now()}`);
  }

  async action(name: string, action: string, body: { cron?: string }, actor: PlatformActor) {
    const q = this.queue(name);
    switch (action) {
      case 'pause':
        if (UNPAUSABLE.has(name)) throw new AppException('CONFLICT', {}, {}, { reason: 'queue_not_pausable', queue: name });
        await q.pause();
        await this.announce('pause', name, actor);
        return { queue: name, paused: true };
      case 'resume':
        await q.resume();
        await this.announce('resume', name, actor);
        return { queue: name, paused: false };
      case 'drain-failed': {
        const removed = await q.clean(0, 100_000, 'failed');
        await this.announce('drain_failed', name, actor, { removed: removed.length });
        return { queue: name, removed: removed.length };
      }
      case 'replay-failed': {
        const failed = await q.getFailed(0, REPLAY_ALL_MAX - 1);
        const ids: string[] = [];
        for (const j of failed) ids.push(await this.replayJob(name, j));
        await this.announce('replay_failed', name, actor, { replayed: ids.length });
        return { queue: name, replayed: ids.length, jobIds: ids.slice(0, 100) };
      }
      case 'run-now': {
        if (!body.cron) throw validationError({ cron: 'validation.required' });
        const task = this.registry.crons.find((c) => c.name === body.cron);
        if (!task) throw notFound();
        const job = await this.queue(SCHEDULER_QUEUE).add(task.name, {}, { jobId: jobId(`run-now:${task.name}:${Date.now()}`), removeOnComplete: 50, removeOnFail: 200 });
        await this.announce('run_now', name, actor, { cron: task.name });
        return { queue: SCHEDULER_QUEUE, cron: task.name, jobId: job.id ?? null };
      }
      default:
        throw notFound();
    }
  }

  // --- DLQ ----------------------------------------------------------------------------------------------------------------
  private async present(queue: string, j: Job): Promise<FailedJobDto> {
    const replays = Number((await this.redis.client.hget(REPLAYS_KEY(queue), String(j.id)).catch(() => null)) ?? 0);
    return {
      id: String(j.id),
      queue,
      name: j.name,
      data: maskJobData(j.data),
      failedReason: j.failedReason ?? null,
      stacktrace: (j.stacktrace ?? []).slice(0, 5).map((s) => s.slice(0, 4000)),
      attemptsMade: j.attemptsMade,
      timestamp: new Date(j.timestamp).toISOString(),
      finishedOn: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
      replays,
    };
  }

  async failed(name: string, q: { page: number; pageSize: number }): Promise<Page<FailedJobDto>> {
    const queue = this.queue(name);
    const start = (q.page - 1) * q.pageSize;
    const [jobs, total] = await Promise.all([queue.getFailed(start, start + q.pageSize - 1), queue.getFailedCount()]);
    return page(await Promise.all(jobs.map((j) => this.present(name, j))), total, q);
  }

  /** A failed job by id (searched in every queue unless `queue` is given). */
  private async find(id: string, queue?: string): Promise<{ queue: string; job: Job }> {
    const names = queue ? [queue] : [...HEALTH_QUEUES];
    for (const n of names) {
      const job = await this.queue(n).getJob(id);
      if (job) return { queue: n, job };
    }
    throw notFound();
  }

  async failedJob(id: string, queue?: string): Promise<FailedJobDto> {
    const { queue: q, job } = await this.find(id, queue);
    return this.present(q, job);
  }

  /** 03-events §3.2: re-add with the same name and payload, attempts reset, id `<id>:replay<n>`; the failed copy is removed. */
  private async replayJob(queue: string, job: Job): Promise<string> {
    const n = await this.redis.client.hincrby(REPLAYS_KEY(queue), String(job.id), 1);
    await this.redis.client.expire(REPLAYS_KEY(queue), 30 * 86400);
    const id = jobId(`${String(job.id)}:replay${n}`);
    await this.queue(queue).add(job.name, job.data, { jobId: id, attempts: job.opts.attempts ?? 1, ...(job.opts.backoff ? { backoff: job.opts.backoff } : {}) });
    await job.remove().catch(() => undefined);
    return id;
  }

  async replay(id: string, queue: string | undefined, actor: PlatformActor) {
    const found = await this.find(id, queue);
    if ((await found.job.getState()) !== 'failed') throw new AppException('CONFLICT', {}, {}, { reason: 'job_not_failed' });
    const newId = await this.replayJob(found.queue, found.job);
    await auditAdmin(this.audit, actor, { action: 'queue.replay', entity: 'Job', entityId: id, after: { queue: found.queue, name: found.job.name, newJobId: newId, replayedBy: actor.userId } });
    await this.outbox.ws(prisma as unknown as Tx, 'admin:platform', 'health.updated', { queue: found.queue, action: 'replay' }, `health.updated:${found.queue}:replay:${newId}`);
    return { jobId: newId, queue: found.queue };
  }
}
