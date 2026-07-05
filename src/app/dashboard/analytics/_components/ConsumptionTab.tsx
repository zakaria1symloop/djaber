'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import {
  StatTile,
  StatTileRow,
  BarList,
  ColumnChart,
  DonutChart,
  fmtNum,
} from '@/components/charts';
import {
  getConsumptionAnalytics,
  type AnalyticsPeriod,
  type ConsumptionAnalytics,
  type RankRow,
} from '@/lib/ai-analytics-api';

const SYNE = { fontFamily: 'Syne, sans-serif' } as const;

const num = (n: number) => n.toLocaleString();
const decimal = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
const usd = (n: number | null) =>
  n === null ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Clean up raw action keys like "text_message" -> "Text Message". */
const prettyAction = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
      <div className="h-40 bg-zinc-900/60 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
      </div>
      <div className="h-64 bg-zinc-900/60 rounded-xl" />
    </div>
  );
}

export default function ConsumptionTab() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [data, setData] = useState<ConsumptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getConsumptionAnalytics(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load consumption analytics');
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

  const { credits, windowUsed, costEstimateUSD, burn, byAction, byAgent, byPage, series, ledgerReady } =
    data;

  const meterPct = Math.min(100, Math.max(0, credits.percentage));
  // byAction credits share for the donut; counts ride along as the BarList secondary.
  const actionSlices = byAction.map((r) => ({ label: prettyAction(r.label), value: r.value }));
  const actionRows: RankRow[] = byAction.map((r) => ({ ...r, label: prettyAction(r.label) }));

  return (
    <div className="space-y-6">
      {/* Period row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white" style={SYNE}>
            Consumption
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Where your credits go and how long they last</p>
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

      {ledgerReady === false && (
        <p className="text-xs text-zinc-600">
          Estimated from message history — live tracking starts now.
        </p>
      )}

      {/* Runway block */}
      <Card>
        <SectionTitle title="Credit runway" sub="This billing period" />

        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
            {num(credits.used)}
            <span className="text-sm font-normal text-zinc-500"> / {num(credits.limit)} credits</span>
          </p>
          <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
            {decimal(credits.percentage)}
            <span className="text-sm font-normal text-zinc-500">%</span>
          </p>
        </div>

        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${meterPct}%` }} />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
          <span>{num(credits.remaining)} credits remaining</span>
          <span>Resets {dateLabel(credits.resetAt)}</span>
        </div>

        <p className="text-sm text-zinc-400 mt-4">
          At this pace you&apos;ll use ~{num(Math.round(burn.projectedMonth))} credits this month
          {burn.runwayDays != null && ` — about ${num(Math.round(burn.runwayDays))} days of runway left`}.
        </p>

        {burn.willExhaust && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <p className="text-sm text-white">
              Projected to exceed your {num(credits.limit)}-credit limit — upgrade or slow usage.
            </p>
          </div>
        )}
      </Card>

      {/* Headline ledger */}
      <StatTileRow>
        <StatTile
          label="Used this period"
          value={credits.used}
          hint={`${num(credits.remaining)} remaining`}
        />
        <StatTile
          label="Window used"
          value={windowUsed}
          hint={`${decimal(burn.perDayAvg)} / day avg`}
        />
        <StatTile
          label="Projected month"
          value={Math.round(burn.projectedMonth)}
          hint={burn.willExhaust ? 'Over limit' : 'Within limit'}
        />
        <StatTile label="Est. cost" value={usd(costEstimateUSD)} hint="Estimated USD" />
      </StatTileRow>

      {/* By action */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="By action" sub="Share of credits" />
          <DonutChart
            slices={actionSlices}
            centerValue={fmtNum(windowUsed)}
            centerLabel="Credits"
          />
        </Card>

        <Card>
          <SectionTitle title="By action" sub="Credits vs uses" />
          <BarList
            rows={actionRows}
            valueFormat={fmtNum}
            showSecondary
            secondaryLabel="Uses"
            emptyText="No usage yet"
          />
        </Card>
      </div>

      {/* Credits per day */}
      <Card>
        <SectionTitle title="Credits over time" sub="Per day" />
        <ColumnChart
          points={series}
          metric="credits"
          height={180}
          format={(n) => `${num(Math.round(n))} credits`}
        />
      </Card>

      {/* By agent + page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="By agent" sub="Credits consumed" />
          <BarList rows={byAgent} valueFormat={fmtNum} emptyText="No agent usage yet" />
        </Card>

        <Card>
          <SectionTitle title="By page" sub="Credits consumed" />
          <BarList rows={byPage} valueFormat={fmtNum} emptyText="No page usage yet" />
        </Card>
      </div>
    </div>
  );
}
