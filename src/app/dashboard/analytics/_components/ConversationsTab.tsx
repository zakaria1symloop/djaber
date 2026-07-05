'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  StatTile,
  StatTileRow,
  BarList,
  ColumnChart,
  LineChart,
  DonutChart,
  fmtNum,
} from '@/components/charts';
import {
  getConversationsAnalytics,
  type ConversationsAnalytics,
} from '@/lib/ai-analytics-api';

const SYNE = { fontFamily: 'Syne, sans-serif' } as const;

const num = (n: number) => n.toLocaleString();
const decimal = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-white" style={SYNE}>
        {title}
      </h2>
      {sub && <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-zinc-900/50 border border-white/10 rounded-xl p-5 ${className}`}>{children}</div>
  );
}

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-64 bg-zinc-900/60 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900/60" />
        ))}
      </div>
      <div className="h-72 bg-zinc-900/60 rounded-xl" />
      <div className="h-64 bg-zinc-900/60 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
      </div>
    </div>
  );
}

export default function ConversationsTab() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ConversationsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getConversationsAnalytics(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('an.tab.err.conversations'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <TabSkeleton />;

  if (error && !data) {
    return (
      <div className="space-y-4">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            {t('rep.c.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, avgMessagesPerConversation, series, byStatus, byPage, byHour, topCustomers } = data;

  // 24-hour activity clock — normalize to a dense 0..23 array so every column and
  // its "every 3h" axis label lands on the right hour even if the API omits quiet hours.
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const match = byHour.find((b) => b.hour === h);
    return { label: `${h}h`, messages: match ? match.count : 0 };
  });
  const hasHourly = hourly.some((h) => h.messages > 0);
  const peak = hasHourly
    ? hourly.reduce((best, cur) => (cur.messages > best.messages ? cur : best), hourly[0])
    : null;

  const statusTotal = byStatus.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-6">
      {/* Period row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white" style={SYNE}>
            {t('an.tab.conv.title')}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t('an.tab.conv.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-zinc-500">{t('an.tab.updating')}</span>}
          <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            {t('rep.c.retry')}
          </button>
        </div>
      )}

      {/* Headline ledger */}
      <StatTileRow>
        <StatTile
          label={t('an.tab.conversations')}
          value={totals.conversations}
          hint={
            avgMessagesPerConversation != null
              ? t('an.tab.conv.msgsPerConv').replace('{n}', decimal(avgMessagesPerConversation))
              : undefined
          }
        />
        <StatTile label={t('an.tab.new')} value={totals.newConversations} hint={t('an.tab.conv.startedInPeriod')} />
        <StatTile label={t('an.tab.conv.unread')} value={totals.unread} hint={t('an.tab.conv.awaitingReply')} />
        <StatTile
          label={t('an.tab.conv.uniqueCustomers')}
          value={totals.uniqueCustomers}
          hint={t('an.tab.conv.returning').replace('{n}', num(totals.returningCustomers))}
        />
      </StatTileRow>

      {/* Volume trend */}
      <Card>
        <SectionTitle title={t('an.tab.conv.volume')} sub={t('an.tab.conv.volumeSub')} />
        <LineChart
          points={series}
          series={[
            { key: 'conversations', label: t('an.tab.conversations') },
            { key: 'messages', label: t('an.tab.messages') },
          ]}
          format={fmtNum}
        />
      </Card>

      {/* Activity clock */}
      <Card>
        <SectionTitle title={t('an.tab.conv.activityClock')} sub={t('an.tab.conv.activityClockSub')} />
        <ColumnChart
          points={hourly}
          metric="messages"
          height={180}
          format={(n) => t('an.tab.messagesCount').replace('{n}', num(n))}
        />
        <p className="text-xs text-zinc-500 mt-3">
          {peak
            ? t('an.tab.conv.peak').replace('{h}', peak.label)
            : t('an.tab.conv.noMessages')}
        </p>
      </Card>

      {/* Status + pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title={t('an.tab.conv.byStatus')} sub={t('an.tab.conv.shareOfConv')} />
          <DonutChart
            slices={byStatus.map((r) => ({ label: r.label, value: r.value }))}
            centerValue={fmtNum(statusTotal)}
            centerLabel={t('an.tab.conversations')}
          />
        </Card>

        <Card>
          <SectionTitle title={t('an.tab.byPage')} sub={t('an.tab.conv.convVsMsgs')} />
          <BarList
            rows={byPage}
            valueFormat={fmtNum}
            showSecondary
            secondaryLabel={t('an.tab.messages')}
            emptyText={t('an.tab.noPageActivity')}
          />
        </Card>
      </div>

      {/* Top customers */}
      <Card>
        <SectionTitle title={t('an.tab.conv.topCustomers')} sub={t('an.tab.conv.byMessagesSent')} />
        <BarList rows={topCustomers} valueFormat={fmtNum} emptyText={t('an.tab.conv.noCustomers')} />
      </Card>
    </div>
  );
}
