// CHN-09 / 05-integrations §1.6 — `jobs / history-sync`: imports up to 25 conversations × 25 messages of a page (an
// Instagram account linked to a page is read through that page). Messages already known (`externalId`) are skipped;
// nothing imported triggers the AI, a notification or an unread badge. A token error fails the job with
// `PAGE_SYNC_TOKEN_EXPIRED` and flags the channel (CHN-04).
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { HISTORY_SYNC_MAX_CONVERSATIONS, HISTORY_SYNC_MAX_MESSAGES, type HistorySyncResult } from '@djaber/shared';
import { prisma, Prisma, type Tx } from '@djaber/db';
import { AppException, notFound } from '../../core/errors/app.exception';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { ChannelService } from '../channels/channel.service';
import { ChannelEvents, ChannelTokens } from '../channels/channel.util';
import { MetaError } from '../meta/meta-errors';
import { META_GATEWAY, type MetaGateway, type MetaHistoryConversation } from '../meta/meta.gateway';
import { JobService } from '../jobs/job.service';
import { ConversationResolver } from './conversation-resolver';
import { ConversationService } from './conversation.service';
import { previewOf } from './inbound-parser';
import { contextOf, type StoredAttachment } from './messaging.presenter';

const DAY = 86_400_000;
const MIME: Record<string, string> = { image: 'image/jpeg', audio: 'audio/mpeg', video: 'video/mp4', file: 'application/octet-stream' };

@Injectable()
export class HistorySyncService implements OnModuleInit {
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly jobs: JobService,
    private readonly queue: QueueOutbox,
    private readonly tokens: ChannelTokens,
    private readonly events: ChannelEvents,
    private readonly channels: ChannelService,
    private readonly resolver: ConversationResolver,
    private readonly conversations: ConversationService,
    @Inject(META_GATEWAY) private readonly meta: MetaGateway,
  ) {}

  onModuleInit() {
    this.registry.register('jobs', 'history-sync', (d: { jobId: string }) => this.jobs.run(d.jobId, async (job) => ({ result: await this.sync(job.id, job.payload as { channelId: string; days?: number }) })));
  }

  async sync(jobId: string, p: { channelId: string; days?: number }): Promise<HistorySyncResult> {
    const channel = await prisma.channel.findFirst({ where: { id: p.channelId }, include: { parent: { select: { externalId: true } } } });
    if (!channel) throw notFound();
    const auth = channel.status === 'active' ? this.tokens.auth(channel, channel.parent?.externalId) : null;
    if (!auth) throw new AppException('PAGE_SYNC_TOKEN_EXPIRED');
    let threads: MetaHistoryConversation[];
    try {
      threads = await this.meta.conversations(auth, { conversations: HISTORY_SYNC_MAX_CONVERSATIONS, messages: HISTORY_SYNC_MAX_MESSAGES });
    } catch (e) {
      if (e instanceof MetaError && e.needsReconnect) {
        await this.channels.markNeedsReconnect(channel.id, `sync:${e.code ?? e.kind}`);
        throw new AppException('PAGE_SYNC_TOKEN_EXPIRED');
      }
      if (e instanceof MetaError) throw new AppException('META_UNAVAILABLE');
      throw e;
    }
    const since = new Date(Date.now() - (p.days ?? 30) * DAY);
    const result: HistorySyncResult = { conversations: 0, messagesImported: 0, messagesSkipped: 0 };
    const list = threads.slice(0, HISTORY_SYNC_MAX_CONVERSATIONS);
    for (let i = 0; i < list.length; i++) {
      const thread = list[i]!;
      const messages = thread.messages
        .slice(0, HISTORY_SYNC_MAX_MESSAGES)
        .map((m) => ({ ...m, at: new Date(m.createdAt) }))
        .filter((m) => m.id && !Number.isNaN(m.at.getTime()) && m.at >= since)
        .sort((a, b) => a.at.getTime() - b.at.getTime());
      if (!thread.participantId || !messages.length) continue;
      await prisma.$transaction(async (db) => {
        const tx = db as Tx;
        const { conversation: conv } = await this.resolver.resolve(tx, channel, thread.participantId, { name: thread.participantName, avatarUrl: null }, messages[0]!.at);
        const known = new Set((await tx.message.findMany({ where: { conversationId: conv.id, externalId: { in: messages.map((m) => m.id) } }, select: { externalId: true } })).map((m) => m.externalId));
        let lastAt = conv.lastMessageAt;
        let lastCustomerAt = conv.lastCustomerMessageAt;
        let preview = conv.lastMessagePreview;
        let lastDirection = contextOf(conv).lastDirection;
        let imported = 0;
        for (const m of messages) {
          if (known.has(m.id)) {
            result.messagesSkipped++;
            continue;
          }
          const fromPage = m.fromId === channel.externalId || (!!channel.parent && m.fromId === channel.parent.externalId);
          const attachments: StoredAttachment[] = m.attachments
            .filter((a) => !!a.url)
            .map((a) => ({ type: a.type, url: a.url!, mime: a.mime ?? MIME[a.type] ?? MIME.file!, size: 0, ...(a.name ? { name: a.name } : {}), pending: true, sourceUrl: a.url }));
          const type = attachments[0] ? (attachments[0].type as 'image' | 'audio' | 'video' | 'file') : 'text';
          const row = await tx.message.create({
            data: {
              workspaceId: channel.workspaceId,
              conversationId: conv.id,
              externalId: m.id,
              direction: fromPage ? 'out' : 'in',
              type,
              // replies found in the page history were typed by a person (no AI run): never labelled as the AI (INB-02)
              author: fromPage ? 'human' : 'customer',
              text: m.text,
              attachments: attachments.length ? (attachments as unknown as Prisma.InputJsonValue) : undefined,
              payload: { external: true },
              sentAt: m.at,
              deliveryStatus: 'sent',
            },
          });
          for (let index = 0; index < attachments.length; index++) {
            await this.queue.add(tx, 'media', 'fetch-attachment', { workspaceId: channel.workspaceId, messageId: row.id, index }, `media:${row.id}:${index}`, { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } });
          }
          imported++;
          if (!lastAt || m.at >= lastAt) {
            lastAt = m.at;
            preview = previewOf({ text: m.text, type });
            lastDirection = fromPage ? 'out' : 'in';
          }
          if (!fromPage && (!lastCustomerAt || m.at > lastCustomerAt)) lastCustomerAt = m.at;
        }
        result.messagesImported += imported;
        if (imported) {
          const updated = await tx.conversation.update({
            where: { id: conv.id },
            data: { lastMessageAt: lastAt, lastCustomerMessageAt: lastCustomerAt, lastMessagePreview: preview, context: { ...contextOf(conv), lastDirection } as Prisma.InputJsonValue },
          });
          await this.conversations.emitUpdated(tx, updated);
        }
      });
      result.conversations++;
      await this.jobs.progress(jobId, ((i + 1) / list.length) * 100);
    }
    await prisma.$transaction(async (db) => {
      const tx = db as Tx;
      const updated = await tx.channel.update({ where: { id: channel.id }, data: { lastSyncAt: new Date() } });
      await this.events.changed(tx, updated, { kind: 'history_synced', description: `${result.conversations}/${result.messagesImported}`, actorType: 'system' });
    });
    return result;
  }
}
