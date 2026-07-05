'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import { useTranslation } from '@/contexts/LanguageContext';
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
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ConsumptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getConsumptionAnalytics(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('an.tab.err.consumption'));
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
            {t('an.tab.cons.title')}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t('an.tab.cons.subtitle')}</p>
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

      {ledgerReady === false && (
        <p className="text-xs text-zinc-600">
          {t('an.tab.cons.estimatedNote')}
        </p>
      )}

      {/* Runway block */}
      <Card>
        <SectionTitle title={t('an.tab.cons.runway')} sub={t('an.tab.cons.billingPeriod')} />

        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="text-2xl font-bold text-white leading-none" style={SYNE}>
            {num(credits.used)}
            <span className="text-sm font-normal text-zinc-500"> / {num(credits.limit)} {t('an.tab.cons.creditsWord')}</span>
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
          <span>{t('an.tab.cons.creditsRemaining').replace('{n}', num(credits.remaining))}</span>
          <span>{t('an.tab.cons.resets').replace('{d}', dateLabel(credits.resetAt))}</span>
        </div>

        <p className="text-sm text-zinc-400 mt-4">
          {t('an.tab.cons.pace').replace('{n}', num(Math.round(burn.projectedMonth)))}
          {burn.runwayDays != null ? t('an.tab.cons.runwayLeft').replace('{n}', num(Math.round(burn.runwayDays))) : ''}.
        </p>

        {burn.willExhaust && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <p className="text-sm text-white">
              {t('an.tab.cons.willExhaust').replace('{n}', num(credits.limit))}
            </p>
          </div>
        )}
      </Card>

      {/* Headline ledger */}
      <StatTileRow>
        <StatTile
          label={t('an.tab.cons.usedThisPeriod')}
          value={credits.used}
          hint={t('an.tab.cons.remaining').replace('{n}', num(credits.remaining))}
        />
        <StatTile
          label={t('an.tab.cons.windowUsed')}
          value={windowUsed}
          hint={t('an.tab.cons.perDayAvg').replace('{n}', decimal(burn.perDayAvg))}
        />
        <StatTile
          label={t('an.tab.cons.projectedMonth')}
          value={Math.round(burn.projectedMonth)}
          hint={burn.willExhaust ? t('an.tab.cons.overLimit') : t('an.tab.cons.withinLimit')}
        />
        <StatTile label={t('an.tab.cons.estCost')} value={usd(costEstimateUSD)} hint={t('an.tab.cons.estimatedUSD')} />
      </StatTileRow>

      {/* By action */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title={t('an.tab.cons.byAction')} sub={t('an.tab.cons.shareOfCredits')} />
          <DonutChart
            slices={actionSlices}
            centerValue={fmtNum(windowUsed)}
            centerLabel={t('an.tab.cons.credits')}
          />
        </Card>

        <Card>
          <SectionTitle title={t('an.tab.cons.byAction')} sub={t('an.tab.cons.creditsVsUses')} />
          <BarList
            rows={actionRows}
            valueFormat={fmtNum}
            showSecondary
            secondaryLabel={t('an.tab.cons.uses')}
            emptyText={t('an.tab.cons.noUsage')}
          />
        </Card>
      </div>

      {/* Credits per day */}
      <Card>
        <SectionTitle title={t('an.tab.cons.creditsOverTime')} sub={t('an.tab.cons.perDay')} />
        <ColumnChart
          points={series}
          metric="credits"
          height={180}
          format={(n) => t('an.tab.cons.creditsCount').replace('{n}', num(Math.round(n)))}
        />
      </Card>

      {/* By agent + page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title={t('an.tab.byAgent')} sub={t('an.tab.cons.creditsConsumed')} />
          <BarList rows={byAgent} valueFormat={fmtNum} emptyText={t('an.tab.cons.noAgentUsage')} />
        </Card>

        <Card>
          <SectionTitle title={t('an.tab.byPage')} sub={t('an.tab.cons.creditsConsumed')} />
          <BarList rows={byPage} valueFormat={fmtNum} emptyText={t('an.tab.cons.noPageUsage')} />
        </Card>
      </div>
    </div>
  );
}
