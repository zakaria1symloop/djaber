// 03-events §4 `sched-daily-stats` (03:30 Africa/Algiers) + the read side of `DailyStat` (00-build-order M8 Risks):
// the cron enqueues one `jobs/daily-stats` job per workspace (deterministic id `daily-stats:<workspaceId>:<day>`); the job
// recomputes yesterday and the 7 days before it (late deliveries, edits) plus every day still missing back to the first
// activity (≤ 732 days), and overwrites the rows (upsert, never incremented). `AnalyticsService` reads these rows for past
// days and computes today (and any day without a row) live with the same `computeDays`.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ANALYTICS_MAX_RANGE_DAYS } from '@djaber/shared';
import { Prisma, prisma, TenantContext } from '@djaber/db';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueService } from '../../core/queue/queue.service';
import { algiersDay, algiersDayEnd, algiersDayStart } from '../../core/time/algiers';
import { computeDays, emptyDay, METRICS_VERSION, type DayMetrics } from './day-metrics';
import { addDays, eachDay } from './range';

/** days recomputed before the target day at every nightly run */
const TRAILING_DAYS = 7;
/** live computations are chunked so one query never spans more than this many days */
const CHUNK_DAYS = 62;

export type DaysResult = { byDay: Map<string, DayMetrics>; rollupDays: number; liveDays: number };

@Injectable()
export class DailyStatsService implements OnModuleInit {
  private readonly log = new Logger(DailyStatsService.name);
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.registry.cron('sched-daily-stats', '30 3 * * *', () => this.scheduleAll());
    this.registry.register('jobs', 'daily-stats', (data: { workspaceId: string; day: string }) => this.rollupWorkspace(data.workspaceId, data.day), { concurrency: 2 });
  }

  /** Cron: one job per live workspace for yesterday. Safe to run twice (same job ids; the job itself overwrites). */
  async scheduleAll(now: Date = new Date()) {
    const day = addDays(algiersDay(now), -1);
    const workspaces = await TenantContext.runSystem(() => prisma.workspace.findMany({ where: { deletedAt: null }, select: { id: true } }));
    for (const w of workspaces) {
      await this.queue.add('jobs', 'daily-stats', { workspaceId: w.id, day }, `daily-stats:${w.id}:${day}`, { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } });
    }
    return { workspaces: workspaces.length, day };
  }

  /** First day with any activity of the workspace (bounds the backfill). */
  private async firstActivityDay(workspaceId: string): Promise<string | null> {
    const [r] = await prisma.$queryRaw<{ at: Date | null }[]>`
      SELECT LEAST(
        (SELECT min("orderedAt") FROM "Order" WHERE "workspaceId" = ${workspaceId}::uuid),
        (SELECT min("createdAt") FROM "Conversation" WHERE "workspaceId" = ${workspaceId}::uuid),
        (SELECT min("soldAt") FROM "Sale" WHERE "workspaceId" = ${workspaceId}::uuid),
        (SELECT min("startedAt") FROM "AiRun" WHERE "workspaceId" = ${workspaceId}::uuid),
        (SELECT min("createdAt") FROM "Shipment" WHERE "workspaceId" = ${workspaceId}::uuid)
      ) at`;
    return r?.at ? algiersDay(r.at) : null;
  }

  /**
   * Job `jobs/daily-stats`: recomputes `upTo` and the 7 days before it, plus the days without a current row.
   * Returns the number of rows written.
   */
  async rollupWorkspace(workspaceId: string, upTo: string): Promise<{ written: number; from: string | null }> {
    return TenantContext.runAs(workspaceId, async () => {
      const first = await this.firstActivityDay(workspaceId);
      if (!first || first > upTo) return { written: 0, from: null };
      const floor = addDays(upTo, -(ANALYTICS_MAX_RANGE_DAYS - 1));
      const earliest = first > floor ? first : floor;
      const have = await prisma.$queryRaw<{ d: string }[]>`
        SELECT to_char("day", 'YYYY-MM-DD') d FROM "DailyStat"
        WHERE "workspaceId" = ${workspaceId}::uuid AND "day" >= ${earliest}::date AND "day" <= ${upTo}::date AND ("metrics"->>'v')::int = ${METRICS_VERSION}`;
      const done = new Set(have.map((r) => r.d));
      const trailingFrom = addDays(upTo, -TRAILING_DAYS);
      const missing = eachDay(earliest, upTo).filter((d) => !done.has(d) || d >= trailingFrom);
      if (!missing.length) return { written: 0, from: null };
      const from = missing[0]!;
      let written = 0;
      for (let start = from; start <= upTo; start = addDays(start, CHUNK_DAYS)) {
        const end = addDays(start, CHUNK_DAYS - 1) < upTo ? addDays(start, CHUNK_DAYS - 1) : upTo;
        const days = await computeDays({ workspaceId, gte: algiersDayStart(start), lt: algiersDayEnd(end) });
        const rows = eachDay(start, end)
          .filter((d) => !done.has(d) || d >= trailingFrom)
          .map((d) => ({ d, m: days.get(d) ?? emptyDay() }));
        written += await this.write(workspaceId, rows);
      }
      this.log.log({ workspaceId, from, upTo, written }, 'daily stats recomputed');
      return { written, from };
    });
  }

  private async write(workspaceId: string, rows: { d: string; m: DayMetrics }[]) {
    if (!rows.length) return 0;
    const values = Prisma.join(rows.map((r) => Prisma.sql`(${workspaceId}::uuid, ${r.d}::date, ${JSON.stringify(r.m)}::jsonb, now())`));
    await prisma.$executeRaw`
      INSERT INTO "DailyStat" ("workspaceId", "day", "metrics", "computedAt") VALUES ${values}
      ON CONFLICT ("workspaceId", "day") DO UPDATE SET "metrics" = EXCLUDED."metrics", "computedAt" = EXCLUDED."computedAt"`;
    return rows.length;
  }

  /** Current-version rollup rows of `[from, to]` (selected top-level keys only, to keep the payload small). */
  async readRollups(workspaceId: string, from: string, to: string, keys?: readonly (keyof DayMetrics)[]): Promise<Map<string, DayMetrics>> {
    const pick = keys?.length ? Prisma.raw(`jsonb_build_object(${keys.map((k) => `'${k}', "metrics"->'${k}'`).join(', ')})`) : Prisma.raw('"metrics"');
    const rows = await prisma.$queryRaw<{ d: string; m: DayMetrics }[]>`
      SELECT to_char("day", 'YYYY-MM-DD') d, ${pick} m FROM "DailyStat"
      WHERE "workspaceId" = ${workspaceId}::uuid AND "day" >= ${from}::date AND "day" <= ${to}::date AND ("metrics"->>'v')::int = ${METRICS_VERSION}`;
    return new Map(rows.map((r) => [r.d, r.m]));
  }

  /**
   * Figures of every day of `[from, to]`: rollup rows for the past days, live for today, for the past days without a
   * current row, and for everything when a page filter is set. Days without activity are absent from `byDay`.
   */
  async days(s: { workspaceId: string; from: string; to: string; channelId?: string | null; keys?: readonly (keyof DayMetrics)[] }, now: Date = new Date()): Promise<DaysResult> {
    const today = algiersDay(now);
    const total = eachDay(s.from, s.to).length;
    const live = async (from: string, to: string) => {
      const out = new Map<string, DayMetrics>();
      for (let start = from; start <= to; start = addDays(start, CHUNK_DAYS)) {
        const end = addDays(start, CHUNK_DAYS - 1) < to ? addDays(start, CHUNK_DAYS - 1) : to;
        for (const [d, m] of await computeDays({ workspaceId: s.workspaceId, gte: algiersDayStart(start), lt: algiersDayEnd(end), channelId: s.channelId })) out.set(d, m);
      }
      return out;
    };
    if (s.channelId) return { byDay: await live(s.from, s.to), rollupDays: 0, liveDays: total };
    const pastTo = s.to < today ? s.to : addDays(today, -1);
    const byDay = new Map<string, DayMetrics>();
    let rollupDays = 0;
    let liveDays = 0;
    if (s.from <= pastTo) {
      const rolled = await this.readRollups(s.workspaceId, s.from, pastTo, s.keys);
      rollupDays = rolled.size;
      for (const [d, m] of rolled) byDay.set(d, m);
      const missing = eachDay(s.from, pastTo).filter((d) => !rolled.has(d));
      if (missing.length) {
        liveDays += missing.length;
        const computed = await live(missing[0]!, missing[missing.length - 1]!);
        const want = new Set(missing);
        for (const [d, m] of computed) if (want.has(d)) byDay.set(d, m);
      }
    }
    if (s.to >= today && s.from <= today) {
      liveDays += 1;
      const t = await live(today, today);
      const m = t.get(today);
      if (m) byDay.set(today, m);
    }
    return { byDay, rollupDays, liveDays };
  }
}
