// Shared helpers of the channels module: token sealing (CHN-04, AES-256-GCM at rest), the Meta auth of a channel,
// the `maxPages` usage rule (CHN-10) and the `channel.updated` WebSocket payload (03-events §2).
import { Injectable } from '@nestjs/common';
import { TenantContext, type Channel, type ChannelEventKind, type Tx } from '@djaber/db';
import { CryptoService } from '../../core/crypto/crypto.service';
import { OutboxService } from '../../core/outbox/outbox.service';
import type { MetaChannelAuth } from '../meta/meta.gateway';

/** Statuses that occupy a page slot of the plan (paused, disabled and disconnected channels do not). */
export const SLOT_STATUSES = ['active', 'pending_review', 'needs_reconnect'] as const;
export const occupiesSlot = (c: Pick<Channel, 'status' | 'parentChannelId'>) => c.parentChannelId === null && (SLOT_STATUSES as readonly string[]).includes(c.status);

export type ChannelLike = Pick<Channel, 'id' | 'platform' | 'externalId' | 'accessToken' | 'parentChannelId'>;

@Injectable()
export class ChannelTokens {
  constructor(private readonly crypto: CryptoService) {}

  /** Ciphertext stored in `Channel.accessToken` (never the token itself). */
  seal(token: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(Buffer.from(this.crypto.encrypt(token), 'utf8'));
  }
  open(sealed: Uint8Array | null | undefined): string | null {
    if (!sealed || !sealed.length) return null;
    try {
      return this.crypto.decrypt(Buffer.from(sealed).toString('utf8'));
    } catch {
      return null;
    }
  }
  /** Auth used for a Meta call on this channel; null when the token is gone (disconnected). */
  auth(c: ChannelLike, parentExternalId?: string | null): MetaChannelAuth | null {
    const token = this.open(c.accessToken);
    if (!token) return null;
    // a linked Instagram account is driven with its page token (CHN-02)
    const viaPage = c.platform === 'instagram' && c.parentChannelId !== null;
    return { platform: c.platform, externalId: c.externalId, token, viaPage, ...(viaPage && parentExternalId ? { pageId: parentExternalId } : {}) };
  }
}

@Injectable()
export class ChannelEvents {
  constructor(private readonly outbox: OutboxService) {}

  /** WS `channel.updated` + (optionally) a `ChannelEvent` row of the history tab, inside the caller's transaction. */
  async changed(
    tx: Tx,
    c: Pick<Channel, 'id' | 'workspaceId' | 'status' | 'pausedReason' | 'lastSeenAt'>,
    event?: { kind: ChannelEventKind; description?: string | null; actorType?: 'user' | 'system' | 'admin'; actorId?: string | null },
  ) {
    if (event) {
      await tx.channelEvent.create({
        data: { workspaceId: c.workspaceId, channelId: c.id, kind: event.kind, description: event.description ?? null, actorType: event.actorType ?? (event.actorId ? 'user' : 'system'), actorId: event.actorId ?? null },
      });
    }
    const link = await tx.agentChannel.findUnique({ where: { channelId: c.id }, select: { agentId: true } });
    await this.outbox.ws(tx, `ws:${c.workspaceId}`, 'channel.updated', {
      id: c.id,
      channel: { id: c.id, status: c.status, pausedReason: c.pausedReason, agentId: link?.agentId ?? null, lastSeenAt: c.lastSeenAt?.toISOString() ?? null },
    });
  }
}

/**
 * Page slots of the plan inside a transaction (advisory lock: concurrent connects / resumes of one workspace queue up).
 * `-1` = unlimited. Usage is counted, never stored.
 */
export const pageSlots = async (tx: Tx, limit: number = TenantContext.get().limits.maxPages) => {
  const workspaceId = TenantContext.get().workspaceId;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId} || ':pages-limit', 0))`;
  const current = await tx.channel.count({ where: { parentChannelId: null, status: { in: [...SLOT_STATUSES] } } });
  return { limit, current, free: limit === -1 ? Number.POSITIVE_INFINITY : Math.max(0, limit - current) };
};
