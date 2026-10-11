// CLAUDE.md rule 4 — a BullMQ job requested by an HTTP handler is written to the outbox inside the business transaction
// (topic `job`); the relay adds it to its queue after commit. The outbox key is the deterministic job id (03 §3).
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';
import type { Tx } from '@djaber/db';
import { OutboxService } from '../outbox/outbox.service';
import { ProcessorRegistry } from './processor.registry';
import { QueueService, type QueueName } from './queue.service';

type Payload = { queue: QueueName; name: string; data: Record<string, unknown>; opts?: JobsOptions };

@Injectable()
export class QueueOutbox implements OnModuleInit {
  constructor(
    private readonly outbox: OutboxService,
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.registry.onOutbox('job', async (row) => {
      const p = row.payload as Payload;
      await this.queue.add(p.queue, p.name, p.data, row.key, p.opts ?? {});
    });
  }

  /** `id` = deterministic job id; a second call with the same id is a no-op (`Outbox @@unique([topic, key])`). */
  async add(tx: Tx, queue: QueueName, name: string, data: Record<string, unknown> & { workspaceId?: string | null }, id: string, opts: JobsOptions = {}) {
    await this.outbox.enqueue(tx, { topic: 'job', key: id, workspaceId: data.workspaceId ?? null, payload: { queue, name, data, opts } });
  }
}
