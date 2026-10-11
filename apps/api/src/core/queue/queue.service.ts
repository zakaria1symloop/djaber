// 03-events-and-jobs §3 — queue names and the single place that adds jobs (deterministic job ids).
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import { ConfigService } from '../config/config.service';

export const QUEUES = ['meta-inbound', 'ai-reply', 'media', 'outbox', 'jobs', 'courier', 'payments', 'notifications'] as const;
export type QueueName = (typeof QUEUES)[number];

export const bullConnection = (redisUrl: string) => {
  const u = new URL(redisUrl);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  };
};

/** BullMQ forbids `:` in custom job ids. */
export const jobId = (id: string) => id.replace(/:/g, '_');

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue>();
  constructor(private readonly config: ConfigService) {}

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: bullConnection(this.config.get('REDIS_URL')),
        defaultJobOptions: { removeOnComplete: { age: 3600, count: 1000 }, removeOnFail: { age: 7 * 24 * 3600 } },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  /** `id` is the deterministic job id from 03 §3 (a second add with the same id is a no-op while the job exists). */
  async add(queue: QueueName, name: string, data: Record<string, unknown>, id: string, opts: JobsOptions = {}) {
    return this.queue(queue).add(name, data, { jobId: jobId(id), ...opts });
  }

  /** Replace a pending delayed job (AI debounce, sheets upsert). */
  async replaceDelayed(queue: QueueName, name: string, data: Record<string, unknown>, id: string, delayMs: number, opts: JobsOptions = {}) {
    const q = this.queue(queue);
    const existing = await q.getJob(jobId(id));
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed') {
        await existing.changeDelay(delayMs);
        await existing.updateData(data);
        return existing;
      }
      if (state === 'completed' || state === 'failed') await existing.remove().catch(() => undefined);
      else return existing; // active / waiting: let it run
    }
    return q.add(name, data, { jobId: jobId(id), delay: delayMs, ...opts });
  }

  async counts() {
    const out: Record<string, Record<string, number>> = {};
    for (const name of QUEUES) {
      out[name] = await this.queue(name).getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    }
    return out;
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close().catch(() => undefined)));
  }
}
