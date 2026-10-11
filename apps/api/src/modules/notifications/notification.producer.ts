// 03-events-and-jobs §5 — in-app notifications leave through the outbox (CLAUDE.md rule 4).
// M2 ships the minimal producer needed by the catalogue (stock.low / stock.out) and by jobs (job.finished / job.failed):
// one `Notification` row per recipient + WS `notification.created`. Preferences, e-mail and push fan-out, grouping and the
// notification centre endpoints arrive with the notifications module of M5, which keeps this entry point.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { prisma, TenantContext, type NotificationType, type Tx } from '@djaber/db';
import { OutboxService } from '../../core/outbox/outbox.service';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { WsEmitter } from '../../core/ws/ws.emitter';

export type NotificationInput = {
  type: NotificationType;
  workspaceId: string;
  /** recipients; omitted = every member of the workspace */
  userIds?: string[];
  data: Record<string, unknown>;
  /** deduplication key: the throttle window of 03 §5.1 is part of it (e.g. `stock_low:<productId>:<day>`) */
  key: string;
};

/** `stock_low` → `stock.low` (i18n key suffix and deep-link label, 00-build-order §0). */
export const notificationSlug = (type: string) => type.replace('_', '.');

@Injectable()
export class NotificationProducer implements OnModuleInit {
  constructor(
    private readonly outbox: OutboxService,
    private readonly registry: ProcessorRegistry,
    private readonly ws: WsEmitter,
  ) {}

  onModuleInit() {
    this.registry.onOutbox('notification', async (row) => {
      await this.deliver(row.payload as NotificationInput);
    });
    // TODO(M11): outbound webhooks (`stock.low`, `stock.out`, `product.updated`, …) are delivered by the integrations
    // module; until then the rows are produced (deterministic key = sent once) and acknowledged without a delivery.
    if (!this.registry.outbox.has('webhook')) this.registry.onOutbox('webhook', async () => undefined);
  }

  /** Inside the caller's transaction: at most one notification per `key`. */
  async emit(tx: Tx, n: NotificationInput) {
    await this.outbox.enqueue(tx, { topic: 'notification', key: n.key, workspaceId: n.workspaceId, payload: n });
  }

  /** Outbox handler (worker). Safe to run twice: rows are keyed by the outbox key stored in `data.key`. */
  async deliver(n: NotificationInput) {
    return TenantContext.runSystem(async () => {
      const already = await prisma.notification.count({ where: { workspaceId: n.workspaceId, type: n.type, data: { path: ['key'], equals: n.key } } });
      if (already) return 0;
      const recipients =
        n.userIds ?? (await prisma.membership.findMany({ where: { workspaceId: n.workspaceId }, select: { userId: true } })).map((m) => m.userId);
      if (!recipients.length) return 0;
      const slug = notificationSlug(n.type);
      const rows = await prisma.notification.createManyAndReturn({
        data: recipients.map((userId) => ({
          workspaceId: n.workspaceId,
          userId,
          type: n.type,
          title: { key: `notification.${slug}.title` },
          body: { key: `notification.${slug}.body`, params: n.data } as object,
          data: { ...n.data, key: n.key } as object,
        })),
      });
      for (const r of rows) {
        this.ws.emit(`user:${r.userId}`, 'notification.created', { notification: { id: r.id, type: r.type, data: r.data, createdAt: r.createdAt.toISOString() } });
      }
      return rows.length;
    });
  }
}
