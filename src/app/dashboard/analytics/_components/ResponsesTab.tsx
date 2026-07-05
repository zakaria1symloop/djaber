'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import {
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  fmtNum,
} from '@/components/charts';
import {
  getResponsesAnalytics,
  type AnalyticsPeriod,
  type ResponsesAnalytics,
} from '@/lib/ai-analytics-api';

const SYNE = { fontFamily: 'Syne, sans-serif' } as const;

const num = (n: number) => n.toLocaleString();
const pct = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

/** Human response time: 'Ns' under a minute, mm:ss otherwise, 'N min' when exact. */
function fmtSeconds(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

const clampPct = (n: number | null) => (n === null ? 0 : Math.min(100, Math.max(0, n)));

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

function InsightPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
      {label}
      <span className="font-semibold text-white" style={SYNE}>
        {count.toLocaleString()}
      </span>
    </span>
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
      <div className="h-32 bg-zinc-900/60 rounded-xl" />
      <div className="h-72 bg-zinc-900/60 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
      </div>
    </div>
  );
}

export default function ResponsesTab() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [data, setData] = useState<ResponsesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getResponsesAnalytics(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load response analytics');
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

  const { totals, responseTime, insights, series, byPage, byAgent } = data;
  const within1Min = clampPct(responseTime.within1MinPct);

  return (
    <div className="space-y-6">
      {/* Period row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white" style={SYNE}>
            Responses
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">How fast and how far the AI replies</p>
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
          label="AI replies"
          value={totals.aiReplies}
          hint={`${num(totals.humanReplies)} sent by a human`}
        />
        <StatTile
          label="Reply rate"
          value={pct(totals.replyRatePct)}
          hint={`${num(totals.incoming)} incoming`}
        />
        <StatTile
          label="Avg first response"
          value={fmtSeconds(responseTime.avgFirstResponseSec)}
          hint={
            responseTime.within1MinPct != null
              ? `${pct(responseTime.within1MinPct)} within 1 min`
              : undefined
          }
        />
        <StatTile
          label="Handoff rate"
          value={pct(totals.handoffRatePct)}
          hint={`${num(totals.handoffs)} handed to a human`}
        />
      </StatTileRow>

      {/* Response speed */}
      <Card>
        <SectionTitle title="Response speed" sub="Customer message &rarr; first AI reply" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">Average</p>
            <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
              {fmtSeconds(responseTime.avgFirstResponseSec)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">Median</p>
            <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
              {fmtSeconds(responseTime.medianFirstResponseSec)}
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Within 1 minute</span>
              <span className="text-sm font-bold text-white" style={SYNE}>
                {pct(responseTime.within1MinPct)}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${within1Min}%` }} />
            </div>
            <p className="text-xs text-zinc-500 mt-2">Replies sent inside a minute</p>
          </div>
        </div>
      </Card>

      {/* Reply mix over time */}
      <Card>
        <SectionTitle title="Reply mix" sub="AI vs human replies over time" />
        <LineChart
          points={series}
          series={[
            { key: 'aiReplies', label: 'AI replies' },
            { key: 'humanReplies', label: 'Human replies' },
          ]}
          format={fmtNum}
        />
      </Card>

      {/* Insights */}
      <Card>
        <SectionTitle title="Conversation insights" sub="How threads resolved" />
        <div className="flex flex-wrap gap-2">
          <InsightPill label="Unclear" count={insights.unclear} />
          <InsightPill label="Unknown" count={insights.unknown} />
          <InsightPill label="Handoff" count={insights.handoff} />
          <InsightPill label="Resolved" count={insights.resolved} />
          <InsightPill label="Pending" count={insights.pending} />
        </div>
      </Card>

      {/* Pages + agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="By page" sub="AI replies" />
          <BarList rows={byPage} valueFormat={fmtNum} emptyText="No page activity yet" />
        </Card>

        <Card>
          <SectionTitle title="By agent" sub="AI replies vs handoffs" />
          <BarList
            rows={byAgent}
            valueFormat={fmtNum}
            showSecondary
            secondaryLabel="Handoffs"
            emptyText="No agent activity yet"
          />
        </Card>
      </div>
    </div>
  );
}
