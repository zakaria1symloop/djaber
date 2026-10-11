// Worker side of the channels module (03-events-and-jobs §3 / §4): every call to Meta that is not the OAuth callback.
//   jobs/channel-unsubscribe   — disconnect: `DELETE subscribed_apps`, then the token is wiped (CHN-06)
//   jobs/channel-sync-info     — name / avatar / followers + insights cache (CHN-07)
//   sched-token-refresh        02:00 — Instagram long-lived tokens expiring within 10 days (CHN-12)
//   sched-token-health         Mon 02:30 — Facebook page tokens via `debug_token`
//   sched-channel-webhook-retry every 30 min — channels whose page subscription failed
//   sched-meta-review-poll     06:00 — Instagram channels `pending_review` → `active` once Meta approved the scope
// Every handler is safe to run twice.
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { prisma, TenantContext, type Channel, type Tx } from '@djaber/db';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { MetaError } from '../meta/meta-errors';
import { META_GATEWAY, type MetaGateway } from '../meta/meta.gateway';
import { NotificationProducer } from '../notifications/notification.producer';
import { ChannelService, instagramScope } from './channel.service';
import { ChannelEvents, ChannelTokens } from './channel.util';

const DAY = 86_400_000;

@Injectable()
export class ChannelJobs implements OnModuleInit {
  private readonly log = new Logger(ChannelJobs.name);
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly tokens: ChannelTokens,
    private readonly events: ChannelEvents,
    private readonly channels: ChannelService,
    private readonly notifications: NotificationProducer,
    @Inject(META_GATEWAY) private readonly meta: MetaGateway,
  ) {}

  onModuleInit() {
    this.registry.register('jobs', 'channel-unsubscribe', (d: { channelId: string }) => this.unsubscribe(d.channelId));
    this.registry.register('jobs', 'channel-sync-info', (d: { channelId: string; insightsOnly?: boolean }) => this.syncInfo(d.channelId, d.insightsOnly === true));
    this.registry.cron('sched-token-refresh', '0 2 * * *', () => this.refreshInstagramTokens());
    this.registry.cron('sched-token-health', '30 2 * * 1', () => this.checkPageTokens());
    this.registry.cron('sched-channel-webhook-retry', '*/30 * * * *', () => this.retrySubscriptions());
    this.registry.cron('sched-meta-review-poll', '0 6 * * *', () => this.applyApprovals());
  }

  /** Disconnect: Meta unsubscribe (best effort for a dead token), then the stored token is cleared. */
  async unsubscribe(channelId: string) {
    return TenantContext.runSystem(async () => {
      const c = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!c || c.status !== 'disconnected' || !c.accessToken) return false; // reconnected meanwhile, or already done
      const auth = this.tokens.auth(c);
      // a linked Instagram account has no subscription of its own: it goes with its page
      if (auth && !auth.viaPage) {
        try {
          await this.meta.unsubscribePage(auth);
        } catch (e) {
          // a revoked token cannot unsubscribe and has nothing left to unsubscribe; anything else is retried by the queue
          if (!(e instanceof MetaError) || e.retryable) throw e;
        }
      }
      // conditional on the status: a reconnect that happened during the call keeps its fresh token
      const r = await prisma.channel.updateMany({ where: { id: channelId, status: 'disconnected' }, data: { accessToken: null, tokenExpiresAt: null } });
      return r.count === 1;
    });
  }

  async syncInfo(channelId: string, insightsOnly = false) {
    return TenantContext.runSystem(async () => {
      const c = await prisma.channel.findUnique({ where: { id: channelId } });
      const auth = c ? this.tokens.auth(c) : null;
      if (!c || !auth || c.status === 'disconnected') return false;
      try {
        if (!insightsOnly) {
          const info = await this.meta.pageInfo(auth);
          await prisma.$transaction(async (db) => {
            const tx = db as Tx;
            const updated = await tx.channel.update({
              where: { id: c.id },
              data: { name: info.name ?? c.name, avatarUrl: info.avatarUrl ?? c.avatarUrl, followersCount: info.followersCount ?? c.followersCount, lastInfoSyncAt: new Date() },
            });
            await this.events.changed(tx, updated, { kind: 'info_synced', actorType: 'system' });
          });
        }
        await this.refreshInsights(c, auth);
        return true;
      } catch (e) {
        if (e instanceof MetaError && e.needsReconnect) {
          await this.channels.markNeedsReconnect(c.id, `sync-info:${e.code ?? e.kind}`);
          return false;
        }
        throw e;
      }
    });
  }

  /** Any insights error is the "unavailable" card state, never a failure of the job (05 §1.6). */
  private async refreshInsights(c: Channel, auth: NonNullable<ReturnType<ChannelTokens['auth']>>) {
    if (c.platform !== 'facebook') return this.channels.storeInsights(c.id, null);
    try {
      const metrics = await this.meta.insights(auth);
      await this.channels.storeInsights(c.id, { fetchedAt: new Date().toISOString(), period: 'day', metrics });
    } catch (e) {
      if (e instanceof MetaError && e.needsReconnect) throw e;
      await this.channels.storeInsights(c.id, null);
    }
  }

  /** CHN-12: Instagram Business Login tokens (60 d) are refreshed when they expire within 10 days; failure ⇒ CHN-04. */
  async refreshInstagramTokens(now = new Date()) {
    return TenantContext.runSystem(async () => {
      const due = await prisma.channel.findMany({
        where: { platform: 'instagram', parentChannelId: null, accessToken: { not: null }, status: { in: ['active', 'paused', 'pending_review', 'disabled'] }, tokenExpiresAt: { lt: new Date(now.getTime() + 10 * DAY) } },
      });
      let refreshed = 0;
      for (const c of due) {
        const token = this.tokens.open(c.accessToken);
        try {
          if (!token) throw new MetaError('token', 'unreadable token');
          const next = await this.meta.refreshInstagramToken(token);
          await prisma.$transaction(async (db) => {
            const tx = db as Tx;
            const updated = await tx.channel.update({
              where: { id: c.id },
              data: { accessToken: this.tokens.seal(next.accessToken), tokenExpiresAt: new Date(now.getTime() + (next.expiresInSec ?? 60 * 86400) * 1000), lastTokenCheckAt: now },
            });
            await this.events.changed(tx, updated, { kind: 'token_checked', description: 'refreshed', actorType: 'system' });
          });
          refreshed++;
        } catch (e) {
          if (e instanceof MetaError && e.retryable) {
            this.log.warn({ channelId: c.id, kind: e.kind }, 'instagram token refresh postponed');
            continue; // Meta unavailable: tomorrow's run tries again, the token is still valid for days
          }
          await this.channels.markNeedsReconnect(c.id, 'token-refresh');
        }
      }
      return refreshed;
    });
  }

  /** CHN-12: Facebook page tokens never expire by date; `debug_token` tells when Meta revoked one. */
  async checkPageTokens(now = new Date()) {
    return TenantContext.runSystem(async () => {
      const pages = await prisma.channel.findMany({ where: { platform: 'facebook', accessToken: { not: null }, status: { in: ['active', 'paused', 'disabled'] } } });
      let invalid = 0;
      for (const c of pages) {
        const token = this.tokens.open(c.accessToken);
        try {
          const debug = token ? await this.meta.debugToken(token) : { isValid: false };
          if (!debug.isValid) throw new MetaError('token', 'token reported invalid', 190);
          await prisma.channel.update({ where: { id: c.id }, data: { lastTokenCheckAt: now } });
        } catch (e) {
          if (e instanceof MetaError && e.retryable) continue;
          invalid++;
          await this.channels.markNeedsReconnect(c.id, 'token-health');
        }
      }
      return invalid;
    });
  }

  /** CHN-01 warning `PAGE_WEBHOOK_SUBSCRIBE_FAILED`: retried until it succeeds, which clears the warning. */
  async retrySubscriptions() {
    return TenantContext.runSystem(async () => {
      const failed = await prisma.channel.findMany({ where: { webhookSubscribed: false, accessToken: { not: null }, status: { in: ['active', 'paused', 'pending_review', 'disabled'] } } });
      let fixed = 0;
      for (const c of failed) {
        const auth = this.tokens.auth(c);
        if (!auth) continue;
        try {
          await this.meta.subscribePage(auth);
          await prisma.$transaction(async (db) => {
            const tx = db as Tx;
            const updated = await tx.channel.update({ where: { id: c.id }, data: { webhookSubscribed: true } });
            await this.events.changed(tx, updated, { kind: 'webhook_resubscribed', actorType: 'system' });
          });
          fixed++;
        } catch (e) {
          if (e instanceof MetaError && e.needsReconnect) await this.channels.markNeedsReconnect(c.id, 'subscribe');
        }
      }
      return fixed;
    });
  }

  /** CHN-03 / CHN-11: reads the `MetaPermission` table kept by the platform team; approved scope ⇒ channel `active`. */
  async applyApprovals() {
    return TenantContext.runSystem(async () => {
      const pending = await prisma.channel.findMany({ where: { platform: 'instagram', status: 'pending_review' } });
      let approved = 0;
      for (const c of pending) {
        const row = await prisma.metaPermission.findUnique({ where: { scope: instagramScope(c.parentChannelId !== null) } });
        if (row && row.status !== 'approved') continue;
        await prisma.$transaction(async (db) => {
          const tx = db as Tx;
          const r = await tx.channel.updateMany({ where: { id: c.id, status: 'pending_review' }, data: { status: 'active' } });
          if (!r.count) return;
          await this.events.changed(tx, { ...c, status: 'active' }, { kind: 'approved', actorType: 'system' });
          await this.notifications.emit(tx, { type: 'channel_approved', workspaceId: c.workspaceId, target: { roles: ['owner', 'admin'] }, key: `channel_approved:${c.id}`, data: { channelId: c.id, page: c.name } });
        });
        approved++;
      }
      return approved;
    });
  }
}
