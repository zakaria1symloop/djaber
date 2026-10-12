'use client';
// /settings/credits — Figma "BIL-04 / BIL-03 — Credits page (ledger) · Invoices · Checkout return" (tiles + ledger).
// M4 is the read-only part: the balance (every member, `billing.read_credits`) and the ledger (`billing.read`),
// kept live by WS `credits.updated`. Filters, page and page size live in the URL.
// M9: "Calculateur" (GET /credits/calculator), "Acheter un pack" (GET /credit-packs, POST /credits/packs/checkout),
// "Exporter CSV" (GET /credits/ledger/export), the invoices card and the checkout-return page.
import { formatDate, formatDateTime, formatNumber, type AppLocale } from '@djaber/shared';
import { ActiveFilters, Banner, Card, cn, CreditsMeter, EmptyState, FilterChips, FilterDateRange, FilterDropdown, KpiTile, Ltr, Skeleton, StatusPill, Table, Td, Th, Tr, type ActiveFilter } from '@djaber/ui';
import { Zap } from 'lucide-react';
import { useMemo } from 'react';
import { ListFilteredEmpty, ListLoading, QueryError } from '@/components/global-states';
import { useAgents } from '@/features/agents/api';
import { ListPagination } from '@/features/catalog/ui';
import { Section, SettingsPage } from '@/features/settings/common';
import { Link } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import { filterList, filterText, type ApiQuery, type ListSpec } from '@/lib/list-state';
import { useSession } from '@/lib/session';
import { useListState } from '@/lib/use-list-state';
import { useCredits, useLedger } from './api';
import { BUCKETS, FILTER_ACTIONS, type Credits, type LedgerRow } from './contracts';
import { actionLabelKey, burnRate, creditsTone, isBookkeeping, levelOf, orderedRange, pricePerCredit, signedCredits } from './logic';

/** `GET /credits/ledger` parameters (api-contract §4 `LedgerQuery`). */
export const LEDGER_SPEC: ListSpec = { filters: { from: 'date', to: 'date', action: 'list', agentId: 'text', bucket: 'text' }, sorts: ['at'], defaultSort: '-at' };

export function CreditsPage() {
  const t = useT();
  const { can } = useSession();
  const q = useCredits();
  return (
    <SettingsPage title={t('nav.settings.credits')} description={t('credits.description')} permission="billing.read_credits">
      {q.data?.negative ? (
        <Banner tone="danger" className="border border-accent-alert/40">
          <span data-testid="credits-negative">{t('banner.negativeCredits')}</span>
        </Banner>
      ) : null}
      {q.isPending ? (
        <div role="status" aria-label={t('common.loading')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Balance credits={q.data} />
      )}
      {can('billing.read') ? (
        <Ledger />
      ) : (
        <Section title={t('credits.ledger.title')}>
          <p className="text-[13px] text-text-secondary" data-testid="ledger-forbidden">
            {t('credits.ledger.forbidden')}
          </p>
        </Section>
      )}
    </SettingsPage>
  );
}

/* ---------- tiles + meter ---------- */
function Balance({ credits: c }: { credits: Credits }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const { workspace } = useSession();
  const level = levelOf(c);
  const rate = burnRate(c.burnRatePerDay);
  const usedMeta = !rate ? t('credits.tile.used.idle') : c.exhaustedEta ? t('credits.tile.used.eta', { rate: formatNumber(rate), date: formatDate(c.exhaustedEta, locale) }) : t('credits.tile.used.rate', { rate: formatNumber(rate) });
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="credits-tiles">
        <KpiTile
          data-testid="tile-plan"
          value={formatNumber(c.plan.remaining)}
          label={t('credits.tile.plan')}
          meta={t('credits.tile.plan.meta', { limit: formatNumber(c.plan.limit), date: formatDate(c.plan.periodEnd, locale) })}
          tone={level === 'exhausted' ? 'danger' : level === 'warning' ? 'warning' : undefined}
        />
        <KpiTile data-testid="tile-packs" value={formatNumber(c.packs.remaining)} label={t('credits.tile.packs')} meta={t('credits.tile.packs.meta')} tone={c.packs.remaining < 0 ? 'danger' : undefined} />
        <KpiTile data-testid="tile-used" value={formatNumber(c.plan.used)} label={t('credits.tile.used')} meta={usedMeta} />
        <KpiTile
          data-testid="tile-price"
          value={pricePerCredit(c.pricePerCreditDzd, locale)}
          label={workspace?.plan?.name ? t('credits.tile.price.plan', { plan: workspace.plan.name }) : t('credits.tile.price')}
          meta={c.packPricePerCreditDzd !== null ? t('credits.tile.price.meta', { price: pricePerCredit(c.packPricePerCreditDzd, locale) }) : undefined}
        />
      </div>
      <Card className="flex flex-col gap-3 p-4">
        <CreditsMeter
          used={c.plan.used}
          limit={c.plan.limit}
          level={level}
          label={t('credits.meter.label', { from: formatDate(c.plan.periodStart, locale), to: formatDate(c.plan.periodEnd, locale) })}
          valueLabel={t('topbar.credits', { used: formatNumber(c.plan.used), limit: formatNumber(c.plan.limit) })}
        />
        <p className="ts-label-meta text-text-muted" data-testid="credits-state" data-level={level}>
          {level === 'exhausted' ? t('credits.meter.exhausted') : level === 'warning' ? t('credits.meter.warning') : t('credits.meter.ok')}
          {c.reserved > 0 ? ` · ${t('credits.meter.reserved', { count: formatNumber(c.reserved) })}` : ''}
        </p>
      </Card>
    </>
  );
}

/* ---------- ledger ---------- */
function Ledger() {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const { can } = useSession();
  const list = useListState(LEDGER_SPEC);
  const s = list.state;
  const from = filterText(s, 'from');
  const to = filterText(s, 'to');
  const actions = filterList(s, 'action');
  const agentId = filterText(s, 'agentId');
  const bucket = filterText(s, 'bucket');
  const agents = useAgents(undefined, can('agents.read'));

  const query = useMemo<ApiQuery>(() => {
    const q: ApiQuery = { page: s.page, pageSize: s.pageSize };
    const range = orderedRange(from, to);
    if (range.from) q.from = range.from;
    if (range.to) q.to = range.to;
    if (actions.length) q.action = actions;
    if (agentId) q.agentId = agentId;
    if (bucket) q.bucket = bucket;
    return q;
  }, [s.page, s.pageSize, from, to, actions, agentId, bucket]);
  const q = useLedger(query);
  const rows = q.data?.rows ?? [];

  const actionOptions = FILTER_ACTIONS.map((a) => ({ value: a, label: t(`enum.CreditLedger.action.${a}`) }));
  const agentOptions = (agents.data?.rows ?? []).map((a) => ({ value: a.id, label: a.name }));
  const bucketOptions = BUCKETS.map((b) => ({ value: b, label: t(`credits.bucket.${b}`) }));
  const day = (d: string) => formatDate(`${d}T12:00:00Z`, locale);
  const agentName = agentOptions.find((a) => a.value === agentId)?.label ?? '…';

  const chips: ActiveFilter[] = [];
  if (from || to) chips.push({ key: 'period', label: `${t('credits.filter.period')} : ${from ? day(from) : '…'} → ${to ? day(to) : '…'}`, onRemove: () => list.setFilters({ from: null, to: null }) });
  if (actions.length) chips.push({ key: 'action', label: `${t('credits.filter.action')} : ${actions.map((a) => actionOptions.find((o) => o.value === a)?.label ?? a).join(', ')}`, onRemove: () => list.setFilter('action', null) });
  if (agentId) chips.push({ key: 'agentId', label: `${t('credits.filter.agent')} : ${agentName}`, onRemove: () => list.setFilter('agentId', null) });
  if (bucket) chips.push({ key: 'bucket', label: `${t('credits.filter.bucket')} : ${t(`credits.bucket.${bucket === 'pack' ? 'pack' : 'plan'}`)}`, onRemove: () => list.setFilter('bucket', null) });

  return (
    <Section title={t('credits.ledger.title')}>
      <div className="flex flex-col gap-3" data-testid="credits-ledger">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('action.filters')}>
          <FilterDropdown label={from || to ? `${from ? day(from) : '…'} → ${to ? day(to) : '…'}` : t('credits.filter.period')} count={from || to ? 1 : undefined}>
            <FilterDateRange from={from} to={to} onChange={(r) => list.setFilters({ from: r.from || null, to: r.to || null })} labels={{ from: t('common.from'), to: t('common.to'), presets: t('credits.filter.period') }} />
          </FilterDropdown>
          <FilterDropdown label={t('credits.filter.action')} count={actions.length || undefined}>
            <FilterChips multiple label={t('credits.filter.action')} options={actionOptions} value={actions} onChange={(next) => list.setFilter('action', next.length ? next : null)} />
          </FilterDropdown>
          {agentOptions.length ? (
            <FilterDropdown label={t('credits.filter.agent')} count={agentId ? 1 : undefined}>
              <FilterChips label={t('credits.filter.agent')} allLabel={t('common.allM')} options={agentOptions} value={agentId ? [agentId] : []} onChange={(next) => list.setFilter('agentId', next[0] ?? null)} />
            </FilterDropdown>
          ) : null}
          <FilterDropdown label={t('credits.filter.bucket')} count={bucket ? 1 : undefined}>
            <FilterChips label={t('credits.filter.bucket')} allLabel={t('common.allM')} options={bucketOptions} value={bucket ? [bucket] : []} onChange={(next) => list.setFilter('bucket', next[0] ?? null)} />
          </FilterDropdown>
        </div>
        <ActiveFilters items={chips} label={t('action.filters')} clearLabel={t('action.clearAll')} onClear={list.clear} removeLabel={(label) => `${t('action.remove')} ${label}`} />

        {q.isPending ? (
          <ListLoading rows={5} columns={5} />
        ) : q.isError ? (
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          list.filtered ? (
            <ListFilteredEmpty entity={t('credits.ledger.entity')} filters={chips.map((c) => c.label).join(' · ')} onClear={list.clear} />
          ) : (
            <EmptyState icon={<Zap className="size-5" />} title={t('credits.ledger.empty.title')} description={t('credits.ledger.empty.description')} />
          )
        ) : (
          <div className={cn('overflow-hidden rounded-card border border-line-edge', q.isPlaceholderData && 'opacity-70')}>
            <Table aria-label={t('credits.ledger.title')}>
              <thead>
                <tr>
                  <Th>{t('credits.col.at')}</Th>
                  <Th>{t('credits.col.action')}</Th>
                  <Th>{t('credits.col.detail')}</Th>
                  <Th className="text-end">{t('credits.col.credits')}</Th>
                  <Th className="text-end">{t('credits.col.balance')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <LedgerLine key={r.id} row={r} locale={locale} />
                ))}
              </tbody>
            </Table>
            <ListPagination page={s.page} pageSize={s.pageSize} total={q.data?.total ?? rows.length} onChange={(p) => list.set(p)} />
          </div>
        )}
        <p className="ts-label-meta text-text-muted">{t('credits.ledger.note')}</p>
      </div>
    </Section>
  );
}

const CREDIT_REASONS = ['trial', 'renewal', 'dev'] as const;

function LedgerLine({ row: r, locale }: { row: LedgerRow; locale: AppLocale }) {
  const t = useT();
  const { can } = useSession();
  const key = actionLabelKey(r.action);
  const muted = isBookkeeping(r);
  // the API falls back to the action code when a row has no reason (`detail = reason ?? action`): the pill already says it
  const raw = r.detail && r.detail !== r.action ? r.detail : '';
  // reasons written by the server as codes (trial grant, plan renewal, dev adjustment) get their label
  const detail = raw && (CREDIT_REASONS as readonly string[]).includes(raw) ? t(`credits.reason.${raw as (typeof CREDIT_REASONS)[number]}`) : raw;
  return (
    <Tr data-testid="ledger-row" data-action={r.action} data-bucket={r.bucket} className={cn(muted && 'text-text-muted')}>
      <Td className="whitespace-nowrap">
        <Ltr>{formatDateTime(r.at, locale)}</Ltr>
      </Td>
      <Td>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusPill enumKey="Credit.action" value={r.action} className="!rounded-[4px]">
            {key ? t(key) : r.action}
          </StatusPill>
          {r.bucket === 'pack' ? <span className="ts-label-micro text-text-muted">{t('enum.Credits.pack')}</span> : null}
        </span>
      </Td>
      <Td className="max-w-[28rem]">
        <span dir="auto" className="break-words">
          {r.agent ? `${r.agent.name}${detail ? ' · ' : ''}` : ''}
          {detail || (r.agent ? '' : '—')}
        </span>
        {r.conversationId && can('inbox.read') ? (
          <Link href={`/inbox/${r.conversationId}`} className="ms-2 ts-label-meta uppercase text-accent-inbound hover:underline">
            {t('credits.ledger.conversation')}
          </Link>
        ) : null}
      </Td>
      <Td className={cn('whitespace-nowrap text-end tabular-nums', creditsTone(r.credits) === 'success' && !muted && 'text-accent-money')}>
        <Ltr>{signedCredits(r.credits, formatNumber)}</Ltr>
      </Td>
      <Td className="whitespace-nowrap text-end tabular-nums">
        <Ltr>{formatNumber(r.balanceAfter)}</Ltr>
      </Td>
    </Tr>
  );
}
