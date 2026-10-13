// Starts one BullMQ Worker per queue and the cron schedulers, using the handlers registered by feature modules.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DelayedError, Queue, Worker } from 'bullmq';
import { TenantContext } from '@djaber/db';
import { ConfigService } from '../core/config/config.service';
import { ProcessorRegistry } from '../core/queue/processor.registry';
import { bullConnection, QUEUES } from '../core/queue/queue.service';
import { maintenanceNow } from '../core/platform/maintenance';

/** 04 §15 "Maintenance": inbound Meta events stay stored (`processedAt=null`) and are replayed after the window. */
const MAINTENANCE_RETRY_MS = 60_000;

const SCHEDULER_QUEUE = 'scheduler';

@Injectable()
export class WorkerRunner implements OnModuleDestroy {
  private readonly log = new Logger(WorkerRunner.name);
  private readonly workers: Worker[] = [];
  private schedulerQueue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly registry: ProcessorRegistry,
  ) {}

  async start(opts: { crons?: boolean } = { crons: true }) {
    const connection = bullConnection(this.config.get('REDIS_URL'));
    for (const queue of QUEUES) {
      const handlers = this.registry.handlers.get(queue);
      if (!handlers) continue;
      const worker = new Worker(
        queue,
        async (job, token) => {
          const handler = handlers.get(job.name);
          if (!handler) throw new Error(`no handler for ${queue}/${job.name}`);
          if (queue === 'meta-inbound' && token && (await maintenanceNow()).active) {
            await job.moveToDelayed(Date.now() + MAINTENANCE_RETRY_MS, token);
            throw new DelayedError();
          }
          // handlers open their own tenant scope (TenantContext.run(await tenants.forWorker(id), …))
          return TenantContext.runSystem(() => handler(job.data, job));
        },
        { connection, concurrency: this.registry.concurrency.get(queue) ?? 4 },
      );
      worker.on('failed', (job, err) =>
        this.log.error({ queue, name: job?.name, id: job?.id, attempt: job?.attemptsMade, err: err.message }, 'job failed'),
      );
      this.workers.push(worker);
    }

    if (opts.crons && this.registry.crons.length) {
      this.schedulerQueue = new Queue(SCHEDULER_QUEUE, { connection });
      const wanted = new Set(this.registry.crons.map((c) => c.name));
      for (const s of await this.schedulerQueue.getJobSchedulers()) {
        if (s.key && !wanted.has(s.key)) await this.schedulerQueue.removeJobScheduler(s.key);
      }
      for (const c of this.registry.crons) {
        await this.schedulerQueue.upsertJobScheduler(
          c.name,
          { pattern: c.pattern, tz: 'Africa/Algiers' },
          { name: c.name, opts: { removeOnComplete: 50, removeOnFail: 200 } },
        );
      }
      const worker = new Worker(
        SCHEDULER_QUEUE,
        async (job) => {
          const task = this.registry.crons.find((c) => c.name === job.name);
          if (!task) return;
          // 04 §15: cron jobs are paused during the maintenance window
          if ((await maintenanceNow()).active) return { skipped: 'maintenance' };
          return TenantContext.runSystem(() => task.handler());
        },
        { connection, concurrency: 2 },
      );
      worker.on('failed', (job, err) => this.log.error({ name: job?.name, err: err.message }, 'scheduled job failed'));
      this.workers.push(worker);
    }
    this.log.log(`worker started: ${this.workers.length} queue consumers, ${this.registry.crons.length} schedulers`);
  }

  /** Runs a registered scheduled task immediately (tests, admin "run now"). */
  async runCron(name: string) {
    const task = this.registry.crons.find((c) => c.name === name);
    if (!task) throw new Error(`unknown scheduler ${name}`);
    return TenantContext.runSystem(() => task.handler());
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close().catch(() => undefined)));
    await this.schedulerQueue?.close().catch(() => undefined);
  }
}
