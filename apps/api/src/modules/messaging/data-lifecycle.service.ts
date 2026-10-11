// MSG-08 / D28 / 04 §9 — data lifecycle of the messaging module.
//   Meta data-deletion callback  → `DataDeletionRequest` + job `jobs / meta-data-deletion` that hard-deletes every
//                                   conversation, message, identity (and stored media) of that sender, across workspaces
//   sched-retention (step)       → messages older than 12 months purged, emptied conversations anonymised,
//                                   raw inbound events older than 7 days dropped, orphan placeholder clients removed
// Both are safe to run twice.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { DataDeletionStatusView } from '@djaber/shared';
import { prisma, TenantContext, type Tx } from '@djaber/db';
import { ConfigService } from '../../core/config/config.service';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { StorageService } from '../../core/storage/storage.service';
import { attachmentsOf } from './messaging.presenter';

const DAY = 86_400_000;
export const MESSAGE_RETENTION_DAYS = 365; // D28: 12 months
export const INBOUND_EVENT_RETENTION_DAYS = 7;
export const PLACEHOLDER_RETENTION_DAYS = 90;
const BATCH = 500;

@Injectable()
export class DataLifecycleService implements OnModuleInit {
  private readonly log = new Logger(DataLifecycleService.name);
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueOutbox,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.registry.register('jobs', 'meta-data-deletion', (d: { requestId: string }) => this.runDeletion(d.requestId));
    this.registry.extendCron('sched-retention', 'messaging', () => this.purge());
  }

  private async deleteObjects(keys: string[]) {
    for (const key of keys) await this.storage.delete(key).catch((e) => this.log.warn({ err: String(e) }, 'stored media delete failed'));
  }

  // --- Meta data deletion (MSG-08) ----------------------------------------------------------------------------------------
  statusUrl(code: string) {
    return `${this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '')}/meta/data-deletion/${code}`;
  }

  /** Callback: registers the request and queues the deletion; a repeated callback for the same user returns the pending one. */
  async request(externalUserId: string): Promise<{ url: string; confirmation_code: string }> {
    const row = await TenantContext.runSystem(() =>
      prisma.$transaction(async (db) => {
        const tx = db as Tx;
        const pending = await tx.dataDeletionRequest.findFirst({ where: { provider: 'meta', externalUserId, status: 'pending' } });
        if (pending) return pending;
        const created = await tx.dataDeletionRequest.create({ data: { provider: 'meta', externalUserId, confirmationCode: randomBytes(9).toString('base64url').replace(/[-_]/g, 'x').toUpperCase() } });
        await this.queue.add(tx, 'jobs', 'meta-data-deletion', { requestId: created.id }, `datadel:${created.id}`, { attempts: 5, backoff: { type: 'exponential', delay: 30_000 } });
        return created;
      }),
    );
    return { url: this.statusUrl(row.confirmationCode), confirmation_code: row.confirmationCode };
  }

  /** `GET /data-deletion/:code` (public). An unknown code answers `not_found`, never a 404 (the page shows the state). */
  async status(code: string): Promise<DataDeletionStatusView> {
    const row = await TenantContext.runSystem(() => prisma.dataDeletionRequest.findUnique({ where: { confirmationCode: code } }));
    if (!row) return { code, status: 'not_found', requestedAt: null, completedAt: null };
    return { code: row.confirmationCode, status: row.status, requestedAt: row.requestedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null };
  }

  /** Hard delete of everything held about one Meta user id, in every workspace. */
  async runDeletion(requestId: string): Promise<number> {
    return TenantContext.runSystem(async () => {
      const req = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== 'pending') return 0;
      const sender = req.externalUserId;
      const keys: string[] = [];
      const workspaces = new Set<string>();
      await prisma.$transaction(
        async (db) => {
          const tx = db as Tx;
          const conversations = await tx.conversation.findMany({ where: { externalSenderId: sender }, select: { id: true, workspaceId: true } });
          const ids = conversations.map((c) => c.id);
          for (const c of conversations) workspaces.add(c.workspaceId);
          if (ids.length) {
            const withMedia = await tx.message.findMany({ where: { conversationId: { in: ids } }, select: { attachments: true } });
            for (const m of withMedia) for (const a of attachmentsOf(m)) if (a.storageKey) keys.push(a.storageKey);
            // messages, notes, insights and recommendation events go with the conversation (FK cascade); orders keep their rows
            await tx.conversation.deleteMany({ where: { id: { in: ids } } });
          }
          const identities = await tx.clientIdentity.findMany({ where: { externalSenderId: sender }, select: { id: true, clientId: true } });
          await tx.clientIdentity.deleteMany({ where: { externalSenderId: sender } });
          await tx.customerBlock.updateMany({ where: { externalSenderId: sender }, data: { externalSenderId: null, channelId: null } });
          // a placeholder client that existed only through this identity disappears too; a real client (orders) is kept
          for (const clientId of new Set(identities.map((i) => i.clientId))) {
            const c = await tx.client.findUnique({ where: { id: clientId }, include: { _count: { select: { orders: true, sales: true, identities: true, conversations: true } } } });
            if (c && c.isPlaceholder && !c._count.orders && !c._count.sales && !c._count.identities && !c._count.conversations) {
              await tx.customerBlock.deleteMany({ where: { clientId } });
              await tx.report.updateMany({ where: { clientId }, data: { clientId: null } });
              await tx.client.delete({ where: { id: clientId } });
            }
          }
          await tx.dataDeletionRequest.update({ where: { id: req.id }, data: { status: 'done', completedAt: new Date(), affectedWorkspaces: workspaces.size } });
        },
        { timeout: 60_000 },
      );
      await this.deleteObjects(keys);
      return workspaces.size;
    });
  }

  // --- retention (sched-retention step) -----------------------------------------------------------------------------------
  async purge(now = new Date()): Promise<{ messages: number; conversations: number; inboundEvents: number; placeholders: number }> {
    return TenantContext.runSystem(async () => {
      const cutoff = new Date(now.getTime() - MESSAGE_RETENTION_DAYS * DAY);
      let messages = 0;
      for (;;) {
        const old = await prisma.message.findMany({ where: { sentAt: { lt: cutoff } }, select: { id: true, attachments: true }, take: BATCH });
        if (!old.length) break;
        const keys = old.flatMap((m) => attachmentsOf(m).map((a) => a.storageKey).filter((k): k is string => !!k));
        // reports keep their own masked excerpt; the link to the purged message is dropped
        await prisma.report.updateMany({ where: { messageId: { in: old.map((m) => m.id) } }, data: { messageId: null } });
        const r = await prisma.message.deleteMany({ where: { id: { in: old.map((m) => m.id) } } });
        messages += r.count;
        await this.deleteObjects(keys);
        if (old.length < BATCH) break;
      }
      // the conversation row stays, anonymised, once nothing is left in it (the sender can no longer be matched)
      const empty = await prisma.conversation.findMany({
        where: { lastMessageAt: { lt: cutoff }, messages: { none: {} }, NOT: { externalSenderId: { startsWith: 'anon:' } } },
        select: { id: true, externalSenderId: true, channelId: true },
        take: 5000,
      });
      for (const c of empty) {
        const hash = createHash('sha256').update(`${c.channelId}:${c.externalSenderId}`).digest('hex').slice(0, 40);
        await prisma.conversation.update({ where: { id: c.id }, data: { externalSenderId: `anon:${hash}`, lastMessagePreview: null, context: {} } });
      }
      const inbound = await prisma.inboundEvent.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - INBOUND_EVENT_RETENTION_DAYS * DAY) } } });
      const stale = await prisma.client.findMany({
        where: { isPlaceholder: true, createdAt: { lt: new Date(now.getTime() - PLACEHOLDER_RETENTION_DAYS * DAY) }, orders: { none: {} }, sales: { none: {} }, conversations: { none: {} }, blocks: { none: {} }, reports: { none: {} }, mergedFrom: { none: {} } },
        select: { id: true },
        take: 5000,
      });
      const placeholders = stale.length ? (await prisma.client.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } })).count : 0;
      return { messages, conversations: empty.length, inboundEvents: inbound.count, placeholders };
    });
  }
}
