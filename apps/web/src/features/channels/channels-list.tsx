'use client';
// /channels — Figma "CHN-06 — Channels — list with statuses", "GLOBAL — Plan expired — free limits applied (Channels)",
// "MECH — … Channels row actions". Cards (one per connected page) with their state strip, platform tabs in the URL,
// plan-limit card, Meta approval notice, connect buttons opening the explainer.
import { ActionsMenu, Banner, Button, buttonClass, Card, cn, EmptyState, Ltr, SegmentedControl, Skeleton } from '@djaber/ui';
import { formatDate, formatNumber, type AppLocale } from '@djaber/shared';
import { Inbox, Package, Settings2, Share2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { QueryError } from '@/components/global-states';
import { Link } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useAppReviewStatus, useChannels } from './api';
import { useConnectFlow } from './connect';
import type { Channel } from './contracts';
import { cardState, filterByTab, isDimmed, limitReached, listSummary, parsePlatformTab, platformCounts, PLATFORM_TABS, type PlatformTab } from './logic';
import { AiState, CardStat, cardStateLabel, PlatformMark, StateStrip } from './ui';
import { ApprovalDialog, useChannelActions, type ChannelActions } from './use-channel-actions';

export function ChannelsList() {
  const t = useT();
  const { can } = useSession();
  const manage = can('channels.manage');
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = useChannels();
  const review = useAppReviewStatus(can('channels.read'));
  const rows = q.data?.rows ?? [];
  const planLimit = q.data?.planLimit ?? null;
  const connect = useConnectFlow({ planLimit });
  const actions = useChannelActions({ connect });
  const [approval, setApproval] = useState(false);

  const tab = parsePlatformTab(params.get('tab'));
  const setTab = (next: PlatformTab) => {
    const p = new URLSearchParams(params.toString());
    if (next === 'all') p.delete('tab');
    else p.set('tab', next);
    router.replace(p.size ? `${pathname}?${p}` : pathname, { scroll: false });
  };
  const counts = platformCounts(rows);
  const shown = filterByTab(rows, tab);
  const summary = listSummary(rows);
  const atLimit = limitReached(planLimit);
  const limitText = planLimit && planLimit.limit >= 0 ? t('channels.limit.ratio', { current: planLimit.current, limit: planLimit.limit }) : null;

  const header = manage ? (
    <>
      <Button onClick={() => connect.openExplainer('instagram')} data-testid="connect-instagram">
        {t('channels.connect.instagram')}
      </Button>
      <Button variant="primary" onClick={() => connect.openExplainer('facebook')} data-testid="connect-facebook">
        {t('channels.connect.facebook')}
      </Button>
    </>
  ) : null;

  return (
    <AppPage
      wide
      permission="channels.read"
      eyebrow={t('nav.group.ai')}
      title={t('nav.channels')}
      description={
        q.data ? (
          <span data-testid="channels-summary">
            {t('channels.summary', { count: summary.total, active: summary.active })}
            {summary.reconnect ? ` · ${t('channels.summary.reconnect', { count: summary.reconnect })}` : ''}
            {limitText ? (
              <>
                {' · '}
                {t('channels.summary.limit')} <Ltr>{limitText}</Ltr>
              </>
            ) : null}
          </span>
        ) : (
          t('channels.subtitle')
        )
      }
      actions={header}
    >
      {review.data && !review.data.instagramApproved ? (
        <Banner tone="warning" action={{ label: t('channels.approval.see'), onClick: () => setApproval(true) }}>
          {t('channels.approval.banner')}
        </Banner>
      ) : null}

      {q.isPending ? (
        <div role="status" aria-label={t('common.loading')} className="grid gap-5 lg:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex flex-col gap-4 p-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-12" />
              <Skeleton className="h-9" />
            </Card>
          ))}
        </div>
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Share2 className="size-5" />}
          title={t('channels.empty.title')}
          description={t('channels.empty.description')}
          action={manage ? { label: t('channels.connect.facebook'), onClick: () => connect.openExplainer('facebook') } : undefined}
          secondaryAction={manage ? { label: t('channels.connect.instagram'), onClick: () => connect.openExplainer('instagram') } : undefined}
        />
      ) : (
        <>
          <SegmentedControl
            label={t('channels.tabs.label')}
            value={tab}
            onChange={setTab}
            options={PLATFORM_TABS.map((p) => ({ value: p, label: `${t(`channels.tabs.${p}`)} ${counts[p]}` }))}
          />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {shown.map((c) => (
              <ChannelCard key={c.id} channel={c} parent={rows.find((p) => p.id === c.parentChannelId) ?? null} actions={actions} />
            ))}
            {shown.length === 0 ? (
              <Card className="px-6 py-10 text-center text-[13px] text-text-muted" data-testid="channels-tab-empty">
                {t('channels.tabs.empty', { platform: t(`channels.platform.${tab === 'all' ? 'facebook' : tab}`) })}
              </Card>
            ) : null}
            {atLimit && planLimit ? (
              <Card data-testid="plan-limit-card" className="flex flex-col items-center gap-3 px-6 py-9 text-center">
                <h2 className="ts-title">
                  {t('channels.limit.title')} <Ltr>({t('channels.limit.pages', { current: planLimit.current, limit: planLimit.limit })})</Ltr>
                </h2>
                <p className="text-[13px] text-text-secondary">{t('channels.limit.description')}</p>
                <Link href="/settings/billing" className={buttonClass()}>
                  {t('channels.limit.plans')}
                </Link>
              </Card>
            ) : null}
          </div>
        </>
      )}
      {connect.element}
      {actions.dialogs}
      <ApprovalDialog open={approval} onClose={() => setApproval(false)} />
    </AppPage>
  );
}

function ChannelCard({ channel: c, parent, actions }: { channel: Channel; parent: Channel | null; actions: ChannelActions }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const { can } = useSession();
  const canAgents = can('agents.manage');
  const state = cardState(c);
  const dim = isDimmed(c);
  const origin = c.parentChannelId ? t('channels.card.linkedTo', { name: parent?.name ?? '—' }) : t('channels.card.connectedOn', { date: formatDate(c.connectedAt, locale) });
  const quick = 'flex h-9 items-center justify-center gap-2 rounded-card border border-line-edge bg-ink-surface text-[13px] text-text-secondary hover:border-line-lit hover:text-text-primary';
  return (
    <div data-testid="channel-card" data-channel={c.id} data-state={state} className="flex min-w-0 flex-col gap-1.5">
      <Card className="flex min-w-0 flex-col gap-4 p-4">
        <div className={cn('flex flex-wrap items-start gap-3', dim && 'opacity-55')}>
          <PlatformMark platform={c.platform} src={c.avatarUrl} name={c.name} />
          <div className="min-w-0 flex-1">
            <Link href={`/channels/${c.id}`} className="block truncate ts-display-s hover:underline">
              {c.name}
            </Link>
            <div className="ts-label-meta mt-1 truncate uppercase text-text-muted">
              {t(`enum.Channel.platform.${c.platform}`)} · {origin} · {cardStateLabel(t, state)}
            </div>
          </div>
          <AiState channel={c} />
        </div>
        <div className={cn('grid grid-cols-2 gap-3 border-y sm:grid-cols-4 border-line-hairline py-3.5', dim && 'opacity-55')}>
          <CardStat value={formatNumber(c.counts.conversations)} label={t('channels.card.conversations')} sub={t('channels.card.activeCount', { count: c.counts.active })} />
          <CardStat value={formatNumber(c.counts.messages7d)} label={t('channels.card.messages7d')} sub={t('channels.card.inboundCount', { count: c.counts.inbound7d })} />
          <CardStat value={formatNumber(c.counts.unread)} label={t('channels.card.unread')} sub={t('channels.card.toAnswer')} />
          <CardStat value={formatNumber(c.counts.productsInScope)} label={t('channels.card.products')} sub={c.agent ? c.agent.name : t('channels.agent.none')} />
        </div>
        {c.status !== 'disconnected' ? (
          <div data-testid="card-agent" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]', dim && 'opacity-55')}>
            {c.agent ? (
              <>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {t('channels.card.agent')}{' '}
                  <Link href={`/agents/${c.agent.id}`} className="text-text-primary hover:underline">
                    {c.agent.name}
                  </Link>
                </span>
                {actions.manage && canAgents ? (
                  <Link href={`/agents/generate?channel=${c.id}`} className="ts-label-meta uppercase text-accent-inbound hover:underline" data-testid="card-generate">
                    {t('channels.card.generate')}
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-text-muted">{t('channels.card.noAgent')}</span>
                {actions.manage ? (
                  <button type="button" onClick={() => actions.link.pick(c)} className="ts-label-meta uppercase text-accent-inbound hover:underline" data-testid="card-link-agent">
                    {t('channels.action.linkAgent')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid min-w-[240px] flex-1 grid-cols-3 gap-2">
            <Link href={`/inbox?channel=${c.id}`} className={quick}>
              <Inbox className="size-3.5" aria-hidden />
              {t('action.inbox')}
            </Link>
            <Link href="/products" className={quick}>
              <Package className="size-3.5" aria-hidden />
              {t('action.stock')}
            </Link>
            <Link href={`/channels/${c.id}`} className={quick}>
              <Settings2 className="size-3.5" aria-hidden />
              {t('action.configure')}
            </Link>
          </div>
          <ActionsMenu label={t('action.actions')} actions={actions.menu(c)} heading={`${c.name} · ${t(`enum.Channel.platform.${c.platform}`)} · ${cardStateLabel(t, state)}`} size="md" />
        </div>
      </Card>
      <StateStrip channel={c} action={actions.strip(c)} />
    </div>
  );
}
