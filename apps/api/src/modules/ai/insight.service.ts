// AGT-08 / 04-ai-pipeline §10 — creation side of the insights queue: what the AI could not handle (`unclear`,
// `unknown_topic`, `handoff`, `error`), with the customer message, the AI answer and the reason. Rows are written inside
// the run's transaction; the resolution side (instruction / FAQ / dismiss) lives in the agents module.
import { Injectable } from '@nestjs/common';
import type { AgentUpdatedEvent } from '@djaber/shared';
import type { Agent, InsightType, Tx } from '@djaber/db';
import { OutboxService } from '../../core/outbox/outbox.service';
import { NotificationProducer } from '../notifications/notification.producer';
import { fold } from './tools/wilaya-aliases';

export type NewInsight = {
  agent: Pick<Agent, 'id' | 'workspaceId' | 'name' | 'status' | 'pausedReason' | 'version'>;
  conversationId: string;
  messageId?: string | null;
  aiRunId?: string | null;
  type: InsightType;
  customerMessage: string;
  aiResponse?: string | null;
  detail?: string | null;
  /** groups repeated insights ("12 clients ont demandé…"); default = the normalised customer message */
  topicKey?: string | null;
};

export const topicKeyOf = (text: string) => fold(text).replace(/\s+/g, ' ').slice(0, 80) || null;

@Injectable()
export class InsightService {
  constructor(
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationProducer,
  ) {}

  /** WS `agent.updated` with the fresh pending-insights badge. */
  async emitAgent(tx: Tx, agent: Pick<Agent, 'id' | 'workspaceId' | 'status' | 'pausedReason' | 'version'>, o: { deleted?: boolean } = {}) {
    const pendingInsights = await tx.agentInsight.count({ where: { agentId: agent.id, status: 'pending' } });
    const payload: AgentUpdatedEvent = { id: agent.id, agent: { id: agent.id, status: agent.status, pausedReason: agent.pausedReason === 'moderation' ? 'manual' : agent.pausedReason, pendingInsights, version: agent.version, ...(o.deleted ? { deleted: true } : {}) } };
    await this.outbox.ws(tx, `ws:${agent.workspaceId}`, 'agent.updated', payload as unknown as Record<string, unknown>);
  }

  /**
   * Creates the insight unless its topic was dismissed "for 30 days" (AGT-08). One notification per (agent, topic)
   * while an insight of that topic is pending (03-events §5.1).
   */
  async create(tx: Tx, n: NewInsight): Promise<string | null> {
    // a message without any letter ("??") still belongs to a topic, so it can be muted
    const topicKey = n.topicKey ?? (n.type === 'error' ? `error:${(n.detail ?? '').split(':')[0]}` : (topicKeyOf(n.customerMessage) ?? `${n.type}:no-text`));
    if (topicKey) {
      const muted = await tx.agentInsight.findFirst({ where: { agentId: n.agent.id, topicKey, snoozedUntil: { gt: new Date() } }, select: { id: true } });
      if (muted) return null;
    }
    const alreadyPending = topicKey ? await tx.agentInsight.count({ where: { agentId: n.agent.id, topicKey, status: 'pending' } }) : 0;
    const row = await tx.agentInsight.create({
      data: {
        workspaceId: n.agent.workspaceId,
        agentId: n.agent.id,
        conversationId: n.conversationId,
        messageId: n.messageId ?? null,
        aiRunId: n.aiRunId ?? null,
        type: n.type,
        customerMessage: n.customerMessage.slice(0, 2000),
        aiResponse: n.aiResponse ? n.aiResponse.slice(0, 2000) : null,
        detail: n.detail ? n.detail.slice(0, 200) : null,
        topicKey,
      },
    });
    if (!alreadyPending) {
      await this.notifications.emit(tx, { type: 'agent_insight', workspaceId: n.agent.workspaceId, key: `agent_insight:${row.id}`, data: { agentId: n.agent.id, insightId: row.id, type: n.type, agent: n.agent.name } });
    }
    await this.emitAgent(tx, n.agent);
    return row.id;
  }
}
