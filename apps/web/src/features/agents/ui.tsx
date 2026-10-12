'use client';
// Small display pieces shared by the agents screens: status pill (colours from the `StatusPill` map, labels from
// `enum.Agent.*`), insight type pill, model badge, channel chips.
import { cn, MonoChip, Pill, StatusPill } from '@djaber/ui';
import { useT, type TFunction } from '@/lib/i18n';
import type { Agent, ChannelRef, InsightType } from './contracts';
import { cardState, type AgentCardState } from './logic';

/** ACTIF · EN PAUSE · PAUSE (PLAN) · BROUILLON */
export const agentStateLabel = (t: TFunction, state: AgentCardState): string => (state === 'paused_plan' ? t('enum.Agent.pausedReason.plan') : t(`enum.Agent.status.${state}`));

export function AgentStatusPill({ agent, className }: { agent: Pick<Agent, 'status' | 'pausedReason'>; className?: string }) {
  const t = useT();
  const state = cardState(agent);
  return (
    <span data-testid="agent-status" data-state={state} className="inline-flex">
      <StatusPill enumKey="Agent.status" value={agent.status} className={cn('!rounded-[4px]', className)}>
        {agentStateLabel(t, state)}
      </StatusPill>
    </span>
  );
}

export function InsightTypePill({ type }: { type: InsightType }) {
  const t = useT();
  return (
    <StatusPill enumKey="AgentInsight.type" value={type} className="!rounded-[4px]">
      {t(`enum.AgentInsight.type.${type}`)}
    </StatusPill>
  );
}

/** Read-only model badge: the platform routing assigns the model, the merchant never picks one (D54). */
export function ModelBadge({ label, className }: { label: string; className?: string }) {
  const t = useT();
  return (
    <MonoChip title={t('agents.model.readOnly')} className={className}>
      <bdi dir="ltr" data-testid="model-badge">
        {label || '—'}
      </bdi>
    </MonoChip>
  );
}

const PLATFORM_SHORT: Record<ChannelRef['platform'], string> = { facebook: 'FB', instagram: 'IG' };
/** "Boutique Amel (FB)" */
export const channelLabel = (c: Pick<ChannelRef, 'name' | 'platform'>): string => `${c.name} (${PLATFORM_SHORT[c.platform]})`;

export function ChannelChips({ channels, empty }: { channels: ChannelRef[]; empty?: string }) {
  if (!channels.length)
    return empty ? (
      <Pill tone="warning" className="!rounded-[4px]">
        {empty}
      </Pill>
    ) : null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {channels.map((c) => (
        <li key={c.id}>
          <MonoChip tone={c.status === 'needs_reconnect' ? 'danger' : 'neutral'}>{c.name}</MonoChip>
        </li>
      ))}
    </ul>
  );
}
