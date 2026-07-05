'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  fmtNum,
} from '@/components/charts';
import {
  getResponsesAnalytics,
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
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ResponsesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getResponsesAnalytics(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('an.tab.err.responses'));
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

  const { totals, responseTime, insights, series, byPage, byAgent } = data;
  const within1Min = clampPct(responseTime.within1MinPct);

  return (
    <div className="space-y-6">
      {/* Period row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white" style={SYNE}>
            {t('an.tab.resp.title')}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t('an.tab.resp.subtitle')}</p>
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
          label={t('an.tab.resp.aiReplies')}
          value={totals.aiReplies}
          hint={t('an.tab.resp.sentByHuman').replace('{n}', num(totals.humanReplies))}
        />
        <StatTile
          label={t('an.tab.resp.replyRate')}
          value={pct(totals.replyRatePct)}
          hint={t('an.tab.resp.incoming').replace('{n}', num(totals.incoming))}
        />
        <StatTile
          label={t('an.tab.resp.avgFirstResponse')}
          value={fmtSeconds(responseTime.avgFirstResponseSec)}
          hint={
            responseTime.within1MinPct != null
              ? t('an.tab.resp.withinMin').replace('{p}', pct(responseTime.within1MinPct))
              : undefined
          }
        />
        <StatTile
          label={t('an.tab.resp.handoffRate')}
          value={pct(totals.handoffRatePct)}
          hint={t('an.tab.resp.handedToHuman').replace('{n}', num(totals.handoffs))}
        />
      </StatTileRow>

      {/* Response speed */}
      <Card>
        <SectionTitle title={t('an.tab.resp.responseSpeed')} sub={t('an.tab.resp.responseSpeedSub')} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">{t('an.tab.resp.average')}</p>
            <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
              {fmtSeconds(responseTime.avgFirstResponseSec)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">{t('an.tab.resp.median')}</p>
            <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
              {fmtSeconds(responseTime.medianFirstResponseSec)}
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{t('an.tab.resp.within1Min')}</span>
              <span className="text-sm font-bold text-white" style={SYNE}>
                {pct(responseTime.within1MinPct)}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${within1Min}%` }} />
            </div>
            <p className="text-xs text-zinc-500 mt-2">{t('an.tab.resp.insideMinute')}</p>
          </div>
        </div>
      </Card>

      {/* Reply mix over time */}
      <Card>
        <SectionTitle title={t('an.tab.resp.replyMix')} sub={t('an.tab.resp.replyMixSub')} />
        <LineChart
          points={series}
          series={[
            { key: 'aiReplies', label: t('an.tab.resp.aiReplies') },
            { key: 'humanReplies', label: t('an.tab.resp.humanReplies') },
          ]}
          format={fmtNum}
        />
      </Card>

      {/* Insights */}
      <Card>
        <SectionTitle title={t('an.tab.resp.insights')} sub={t('an.tab.resp.insightsSub')} />
        <div className="flex flex-wrap gap-2">
          <InsightPill label={t('an.tab.insight.unclear')} count={insights.unclear} />
          <InsightPill label={t('an.tab.insight.unknown')} count={insights.unknown} />
          <InsightPill label={t('an.tab.insight.handoff')} count={insights.handoff} />
          <InsightPill label={t('an.tab.insight.resolved')} count={insights.resolved} />
          <InsightPill label={t('an.tab.insight.pending')} count={insights.pending} />
        </div>
      </Card>

      {/* Pages + agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title={t('an.tab.byPage')} sub={t('an.tab.resp.aiReplies')} />
          <BarList rows={byPage} valueFormat={fmtNum} emptyText={t('an.tab.noPageActivity')} />
        </Card>

        <Card>
          <SectionTitle title={t('an.tab.byAgent')} sub={t('an.tab.resp.byAgentSub')} />
          <BarList
            rows={byAgent}
            valueFormat={fmtNum}
            showSecondary
            secondaryLabel={t('an.tab.resp.handoffs')}
            emptyText={t('an.tab.noAgentActivity')}
          />
        </Card>
      </div>
    </div>
  );
}
