'use client';
// Small display pieces shared by the channels screens: platform mark, status pill (colours from the `StatusPill` map,
// labels from `enum.Channel.*`), AI state of a page, and the state strip drawn under a card or a page header.
import { Button, cn, Ltr, Pill, StatusPill, type Tone } from '@djaber/ui';
import { formatDate, type AppLocale } from '@djaber/shared';
import { Facebook, Instagram } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocaleCode, useT, type TFunction } from '@/lib/i18n';
import type { Channel, Platform } from './contracts';
import { cardState, type CardState } from './logic';

/** Page picture, or the platform icon when there is none or it fails to load (expired Meta CDN link). */
export function PlatformMark({ platform, size = 40, src, name }: { platform: Platform; size?: number; src?: string | null; name?: string }) {
  const Icon = platform === 'instagram' ? Instagram : Facebook;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span style={{ width: size, height: size }} className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-card border border-line-edge bg-ink-raised text-text-secondary">
      {src && failed !== src ? <img src={src} alt={name ?? ''} className="size-full object-cover" onError={() => setFailed(src)} /> : <Icon style={{ width: size * 0.45, height: size * 0.45 }} aria-hidden />}
    </span>
  );
}

/** ACTIVE · EN PAUSE · EN PAUSE (PLAN) · EN ATTENTE META · RECONNEXION REQUISE · DÉSACTIVÉ · DÉCONNECTÉ */
export const cardStateLabel = (t: TFunction, state: CardState): string =>
  state === 'paused_plan' ? t('enum.Channel.status.paused') : state === 'paused' ? t('channels.state.paused') : state === 'paused_moderation' ? t('channels.state.pausedModeration') : t(`enum.Channel.status.${state}`);

export function ChannelStatusPill({ channel, className }: { channel: Pick<Channel, 'status' | 'pausedReason'>; className?: string }) {
  const t = useT();
  return (
    <StatusPill enumKey="Channel.status" value={channel.status} className={cn('!rounded-[4px]', className)}>
      {cardStateLabel(t, cardState(channel))}
    </StatusPill>
  );
}

/** "● IA ACTIVE" when an active agent answers on an active page; otherwise why it does not. */
export function AiState({ channel }: { channel: Pick<Channel, 'status' | 'agent'> }) {
  const t = useT();
  const live = channel.status === 'active' && channel.agent?.status === 'active';
  const key = live ? 'channels.ai.active' : !channel.agent ? 'channels.ai.none' : channel.agent.status !== 'active' ? 'channels.ai.agentPaused' : 'channels.ai.silent';
  return (
    <span data-testid="ai-state" className={cn('inline-flex shrink-0 items-center gap-1.5 ts-label-meta uppercase', live ? 'text-signal-live' : 'text-text-muted')}>
      <span aria-hidden className={cn('size-1.5 rounded-full', live ? 'bg-signal-live' : 'bg-text-muted')} />
      {t(key)}
    </span>
  );
}

const STRIP: Partial<Record<CardState, { tone: Tone; border: string }>> = {
  needs_reconnect: { tone: 'danger', border: 'border-accent-alert/70' },
  pending_review: { tone: 'warning', border: 'border-accent-starred/70' },
  paused_plan: { tone: 'warning', border: 'border-line-edge' },
  paused_moderation: { tone: 'warning', border: 'border-line-edge' },
  paused: { tone: 'neutral', border: 'border-line-edge' },
  disabled: { tone: 'neutral', border: 'border-line-edge' },
  disconnected: { tone: 'neutral', border: 'border-line-edge' },
};

/**
 * Strip under a page: À RECONNECTER (Reconnecter) · EN ATTENTE META · EN PAUSE · PLAN (Reprendre) · EN PAUSE
 * (Reprendre) · DÉSACTIVÉ (Réactiver) · DÉCONNECTÉ (Reconnecter). Nothing for an active page.
 */
export function StateStrip({
  channel,
  action,
  className,
}: {
  channel: Channel;
  /** the one explicit button of the strip; absent for a member who cannot manage pages */
  action?: { label: string; onClick: () => void; loading?: boolean; disabledReason?: string; primary?: boolean };
  className?: string;
}) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const state = cardState(channel);
  const look = STRIP[state];
  if (!look) return null;
  const date = channel.health?.tokenCheckedAt ? formatDate(channel.health.tokenCheckedAt, locale) : null;
  const text: ReactNode =
    state === 'needs_reconnect' ? (date ? t('channels.strip.needs_reconnect.dated', { date }) : t('channels.strip.needs_reconnect')) : t(`channels.strip.${state}`);
  return (
    <div data-testid="state-strip" data-state={state} role={state === 'needs_reconnect' ? 'alert' : 'status'} className={cn('flex flex-wrap items-center gap-3 rounded-card border bg-ink-surface px-3.5 py-2.5 text-[13px]', look.border, className)}>
      <Pill tone={look.tone} className="!rounded-[4px]">
        {t(`channels.strip.${state}.label`)}
      </Pill>
      <span className="min-w-0 flex-1 text-text-secondary">{text}</span>
      {action ? (
        <Button size="sm" variant={action.primary ? 'primary' : 'ghost'} onClick={action.onClick} loading={action.loading} disabledReason={action.disabledReason}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** Mono stat of a card: big number, label, sub-line. */
export function CardStat({ value, label, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="ts-numeral-m">
        <Ltr>{value}</Ltr>
      </div>
      <div className="ts-label-micro mt-1 text-text-muted">{label}</div>
      {sub ? <div className="ts-label-micro mt-0.5 text-text-muted">{sub}</div> : null}
    </div>
  );
}
