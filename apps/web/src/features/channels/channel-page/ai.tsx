'use client';
// /channels/[id]/ai — Figma "CHN-07b — … IA & agent": the agent that answers on this page (or none), and the welcome
// message sent before the first AI reply (workspace system message `welcome`, edited in Settings › Messages système).
// M4: "Changer ⌄" / "Détacher" / "Rattacher un agent" / "Créer un agent" (`PUT /channels/:id/agent`, `GET /agents`).
import { buttonClass, Card, FormAlert, Ltr, StatusPill } from '@djaber/ui';
import type { AppLocale } from '@djaber/shared';
import { Bot } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useChannelPage } from './channel-shell';

export function ChannelAi() {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const { channel: c } = useChannelPage();
  const { workspace, can } = useSession();
  // `{shop}` is the workspace name in the message the customer receives
  const welcome = (workspace?.systemMessages?.welcome?.[locale]?.trim() || workspace?.systemMessages?.welcome?.fr?.trim() || '').replaceAll('{shop}', workspace?.name ?? '');
  const live = c.status === 'active' && c.agent?.status === 'active';
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card className="flex flex-col gap-4 p-4" data-testid="channel-ai">
        <h2 className="ts-title">{t('channels.page.tab.ai')}</h2>
        <div className="flex items-center gap-3 rounded-card border border-line-edge bg-ink-raised px-3.5 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-card border border-line-edge bg-ink-surface text-text-secondary">
            <Bot className="size-4" aria-hidden />
          </span>
          {c.agent ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{c.agent.name}</div>
                <div className="ts-label-meta mt-0.5 text-text-muted">
                  <Ltr>{t('channels.overview.agentProducts', { count: c.counts.productsInScope })}</Ltr>
                </div>
              </div>
              <StatusPill enumKey="Agent.status" value={c.agent.status} className="!rounded-[4px]">
                {t(`enum.Agent.status.${c.agent.status}`)}
              </StatusPill>
            </>
          ) : (
            <p className="min-w-0 flex-1 text-[13px] text-text-secondary" data-testid="channel-ai-none">
              {t('channels.ai.noneDescription')}
            </p>
          )}
        </div>
        <p className="text-[13px]" data-testid="channel-ai-live">
          <span className={live ? 'text-signal-live' : 'text-text-muted'}>{t(live ? 'channels.ai.liveOn' : 'channels.ai.liveOff')}</span>
        </p>
        <FormAlert tone="info">
          {t('error.AGENT_CHANNEL_SWITCH_NEXT_THREAD')} <Ltr>(AGENT_CHANNEL_SWITCH_NEXT_THREAD)</Ltr>
        </FormAlert>
      </Card>

      <Card className="flex flex-col gap-3 p-4" data-testid="channel-welcome">
        <h2 className="ts-title">{t('channels.ai.welcome.title')}</h2>
        {welcome ? (
          <blockquote dir="auto" className="rounded-card border border-line-edge bg-ink-raised px-3.5 py-3 text-[13px]">
            {welcome}
          </blockquote>
        ) : (
          <p className="text-[13px] text-text-muted">{t('channels.ai.welcome.empty')}</p>
        )}
        <p className="ts-label-meta text-text-muted">{t('channels.ai.welcome.note')}</p>
        {can('workspace.settings') ? (
          <Link href="/settings/system-messages" className={buttonClass({ size: 'sm', className: 'w-fit' })}>
            {t('channels.ai.welcome.edit')}
          </Link>
        ) : null}
      </Card>
    </div>
  );
}
