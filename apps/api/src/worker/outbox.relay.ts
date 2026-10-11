// 03-events-and-jobs §1 — OutboxRelay: every 500 ms, batch 200, FOR UPDATE SKIP LOCKED, dispatch by topic.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { rawPrisma, TenantContext } from '@djaber/db';
import { AuditService, type AuditEntry } from '../core/audit/audit.service';
import { ProcessorRegistry } from '../core/queue/processor.registry';
import { WsEmitter } from '../core/ws/ws.emitter';

type Row = { id: string; workspaceId: string | null; topic: string; key: string; payload: any; attempts: number };
const MAX_ATTEMPTS = 10;

@Injectable()
export class OutboxRelay implements OnModuleDestroy {
  private readonly log = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly ws: WsEmitter,
    private readonly audit: AuditService,
  ) {
    this.registry.onOutbox('ws', async (row) => {
      this.ws.emit(row.payload.room, row.payload.event, row.payload.payload);
    });
    this.registry.onOutbox('audit', async (row) => {
      await this.audit.write(row.payload as AuditEntry);
    });
  }

  start(intervalMs = 500) {
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Processes one batch; returns the number of rows handled. Also called directly by tests. */
  async tick(batch = 200): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await TenantContext.runSystem(() =>
        rawPrisma.$transaction(
          async (tx) => {
            const rows = await tx.$queryRaw<Row[]>`
              SELECT "id","workspaceId","topic","key","payload","attempts" FROM "Outbox"
              WHERE "processedAt" IS NULL AND "attempts" < ${MAX_ATTEMPTS}
              ORDER BY "createdAt" ASC LIMIT ${batch} FOR UPDATE SKIP LOCKED`;
            for (const row of rows) {
              const handler = this.registry.outbox.get(row.topic);
              try {
                if (!handler) throw new Error(`no outbox handler for topic ${row.topic}`);
                await handler(row);
                await tx.$executeRaw`UPDATE "Outbox" SET "processedAt" = now() WHERE "id" = ${row.id}::uuid`;
              } catch (e) {
                this.log.error({ topic: row.topic, key: row.key, err: String(e) }, 'outbox dispatch failed');
                await tx.$executeRaw`UPDATE "Outbox" SET "attempts" = "attempts" + 1 WHERE "id" = ${row.id}::uuid`;
              }
            }
            return rows.length;
          },
          { timeout: 30_000 },
        ),
      );
    } finally {
      this.running = false;
    }
  }
}
