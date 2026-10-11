// Feature modules register their job handlers and scheduled tasks here (in onModuleInit).
// Only the worker process (WorkerRunner) consumes them; in the API process registration is inert.
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { QueueName } from './queue.service';

export type JobHandler = (data: any, job: Job) => Promise<unknown>;
export type ProcessorOptions = {
  /** attempts / backoff are per job name (03-events-and-jobs §3) and applied when the job is added by the relay or service */
  concurrency?: number;
};
export type OutboxHandler = (row: { id: string; topic: string; key: string; payload: any; workspaceId: string | null }) => Promise<void>;
export type CronTask = { name: string; pattern: string; handler: () => Promise<unknown> };

@Injectable()
export class ProcessorRegistry {
  readonly handlers = new Map<QueueName, Map<string, JobHandler>>();
  readonly concurrency = new Map<QueueName, number>();
  readonly outbox = new Map<string, OutboxHandler>();
  readonly crons: CronTask[] = [];

  register(queue: QueueName, name: string, handler: JobHandler, opts: ProcessorOptions = {}) {
    let m = this.handlers.get(queue);
    if (!m) this.handlers.set(queue, (m = new Map()));
    m.set(name, handler);
    if (opts.concurrency) this.concurrency.set(queue, Math.max(this.concurrency.get(queue) ?? 1, opts.concurrency));
  }

  /** Outbox topic dispatcher (03 §1). */
  onOutbox(topic: string, handler: OutboxHandler) {
    this.outbox.set(topic, handler);
  }

  /** Scheduled job, cron pattern evaluated in Africa/Algiers (03 §4). Singleton across worker instances. */
  cron(name: string, pattern: string, handler: () => Promise<unknown>) {
    if (!this.crons.some((c) => c.name === name)) this.crons.push({ name, pattern, handler });
  }
}
