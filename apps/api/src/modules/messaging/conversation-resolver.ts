// MSG-04 — find-or-create the Conversation `(channelId, externalSenderId)` and the Client behind it (`ClientIdentity`).
// Used by the inbound processor and by the history sync. Runs inside the caller's transaction; an advisory lock on the
// pair serialises two events of the same new sender processed at the same time.
import { Injectable } from '@nestjs/common';
import type { Channel, Conversation, Prisma, Tx } from '@djaber/db';
import type { MetaProfile } from '../meta/meta.gateway';

export const placeholderName = (platform: 'facebook' | 'instagram', senderId: string) => `${platform === 'instagram' ? 'IG' : 'FB'} User ·${senderId.slice(-6)}`;

@Injectable()
export class ConversationResolver {
  async lock(tx: Tx, channelId: string, senderId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${channelId}:${senderId}`}, 0))`;
  }

  async resolve(tx: Tx, channel: Pick<Channel, 'id' | 'workspaceId' | 'platform'>, senderId: string, profile: MetaProfile | null, at: Date): Promise<{ conversation: Conversation; created: boolean }> {
    await this.lock(tx, channel.id, senderId);
    const existing = await tx.conversation.findFirst({ where: { channelId: channel.id, externalSenderId: senderId } });
    if (existing) return { conversation: existing, created: false };

    const displayName = profile?.name?.trim() || null;
    let identity = await tx.clientIdentity.findUnique({ where: { channelId_externalSenderId: { channelId: channel.id, externalSenderId: senderId } }, include: { client: true } });
    if (!identity) {
      // unknown sender: a placeholder client until a phone number is known (name from the Meta profile when it answers)
      const client = await tx.client.create({ data: { workspaceId: channel.workspaceId, name: displayName ?? placeholderName(channel.platform, senderId), isPlaceholder: true, source: 'ai' } });
      identity = await tx.clientIdentity.create({ data: { clientId: client.id, channelId: channel.id, externalSenderId: senderId, displayName, avatarUrl: profile?.avatarUrl ?? null }, include: { client: true } });
    }
    const clientId = identity.client.mergedIntoId ?? identity.clientId;
    const link = await tx.agentChannel.findUnique({ where: { channelId: channel.id }, select: { agentId: true } });
    const context: Prisma.InputJsonValue = { displayName: identity.displayName ?? displayName, avatarUrl: identity.avatarUrl ?? profile?.avatarUrl ?? null };
    const conversation = await tx.conversation.create({
      data: { workspaceId: channel.workspaceId, channelId: channel.id, externalSenderId: senderId, clientId, agentId: link?.agentId ?? null, firstInboundAt: at, context },
    });
    return { conversation, created: true };
  }
}
