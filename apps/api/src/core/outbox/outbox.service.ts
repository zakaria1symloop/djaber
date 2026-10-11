// 09-code-conventions §2.7 — side effects are written in the caller's transaction and relayed by the worker.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { prisma, type Tx } from '@djaber/db';

export type OutboxTopic = 'ws' | 'notification' | 'meta-send' | 'webhook' | 'sheets' | 'audit' | 'mail' | 'job';
export type OutboxMessage = {
  topic: OutboxTopic;
  key: string;
  payload: Record<string, unknown>;
  workspaceId?: string | null;
};

type RawExecutor = { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number> };

@Injectable()
export class OutboxService {
  /** Enqueue inside a transaction (preferred): committed atomically with the business data. */
  async enqueue(tx: Tx | RawExecutor, m: OutboxMessage) {
    await (tx as RawExecutor).$executeRaw`
      INSERT INTO "Outbox" ("id","workspaceId","topic","key","payload","attempts","createdAt")
      VALUES (uuid_generate_v7(), ${m.workspaceId ?? null}::uuid, ${m.topic}, ${m.key}, ${JSON.stringify(m.payload)}::jsonb, 0, now())
      ON CONFLICT ("topic","key") DO NOTHING`;
  }

  /** Outside a transaction (audit rows written after the response, best effort). */
  enqueueNoTx(m: OutboxMessage) {
    return this.enqueue(prisma as unknown as RawExecutor, m);
  }

  /** WebSocket event to a room (`ws:<workspaceId>`, `user:<id>`, `admin:platform`). */
  ws(tx: Tx | RawExecutor, room: string, event: string, payload: Record<string, unknown>, key?: string) {
    const k = key ?? `${event}:${String(payload.id ?? randomUUID())}:${Date.now()}`;
    return this.enqueue(tx, { topic: 'ws', key: `ws:${k}`, payload: { room, event, payload } });
  }
}
