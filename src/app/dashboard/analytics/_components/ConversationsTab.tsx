'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
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
  type AnalyticsPeriod,
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
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [data, setData] = useState<ConversationsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getConversationsAnalytics(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <TabSkeleton />;

  if (error && !data) {
    return (
      <div className="space-y-4">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            Retry
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
            Conversations
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Who writes, when, and from where</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-zinc-500">Updating&hellip;</span>}
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Headline ledger */}
      <StatTileRow>
        <StatTile
          label="Conversations"
          value={totals.conversations}
          hint={
            avgMessagesPerConversation != null
              ? `${decimal(avgMessagesPerConversation)} messages / conversation`
              : undefined
          }
        />
        <StatTile label="New" value={totals.newConversations} hint="Started in this period" />
        <StatTile label="Unread" value={totals.unread} hint="Awaiting a reply" />
        <StatTile
          label="Unique customers"
          value={totals.uniqueCustomers}
          hint={`${num(totals.returningCustomers)} returning`}
        />
      </StatTileRow>

      {/* Volume trend */}
      <Card>
        <SectionTitle title="Volume" sub="Conversations & messages over time" />
        <LineChart
          points={series}
          series={[
            { key: 'conversations', label: 'Conversations' },
            { key: 'messages', label: 'Messages' },
          ]}
          format={fmtNum}
        />
      </Card>

      {/* Activity clock */}
      <Card>
        <SectionTitle title="Activity clock" sub="When customers write &middot; by hour of day" />
        <ColumnChart
          points={hourly}
          metric="messages"
          height={180}
          format={(n) => `${num(n)} messages`}
        />
        <p className="text-xs text-zinc-500 mt-3">
          {peak
            ? `Customers write most around ${peak.label} — staff or prime the AI for that window.`
            : 'No messages in this period yet.'}
        </p>
      </Card>

      {/* Status + pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="By status" sub="Share of conversations" />
          <DonutChart
            slices={byStatus.map((r) => ({ label: r.label, value: r.value }))}
            centerValue={fmtNum(statusTotal)}
            centerLabel="Conversations"
          />
        </Card>

        <Card>
          <SectionTitle title="By page" sub="Conversations vs messages" />
          <BarList
            rows={byPage}
            valueFormat={fmtNum}
            showSecondary
            secondaryLabel="Messages"
            emptyText="No page activity yet"
          />
        </Card>
      </div>

      {/* Top customers */}
      <Card>
        <SectionTitle title="Top customers" sub="By messages sent" />
        <BarList rows={topCustomers} valueFormat={fmtNum} emptyText="No customers yet" />
      </Card>
    </div>
  );
}
