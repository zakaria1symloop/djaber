'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  LineChart,
  FunnelBars,
  fmtDA,
  type FunnelStage,
} from '@/components/charts';
import {
  getProfitLoss,
  type ProfitLossReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

function pctLabel(p: number | null): string {
  return p == null || !Number.isFinite(p) ? '—' : `${p.toFixed(1)}%`;
}

function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bg-zinc-900/50 border border-white/10 rounded-xl p-5 ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{title}</h2>
        {hint && <span className="text-[11px] text-zinc-500 tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function ProfitLossPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getProfitLoss(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.com.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const stages: FunnelStage[] = (data?.breakdown ?? []).map((r) => ({
    label: r.label,
    value: r.value,
    tone: r.value <= 0 ? 'dead' : /net|gross/i.test(r.label) ? 'good' : undefined,
  }));

  return (
    <ReportShell
      title={t('rep.fin.profitLoss.title')}
      description={t('rep.fin.profitLoss.desc')}
      period={period}
      onPeriodChange={(p) => {
        setPeriod(p);
        setRange({});
      }}
      startDate={range.startDate}
      endDate={range.endDate}
      onRangeChange={(s, e) => {
        setPeriod('custom');
        setRange({ startDate: s, endDate: e });
      }}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <>
          <StatTileRow>
            <StatTile label={t('rep.c.revenue')} value={fmtDA(data.revenue)} />
            <StatTile label={t('rep.c.cogs')} value={fmtDA(data.cogs)} />
            <StatTile
              label={t('rep.c.grossProfit')}
              value={fmtDA(data.grossProfit)}
              hint={`${pctLabel(data.grossMarginPct)} ${t('rep.fin.marginWord')}`}
            />
            <StatTile
              label={t('rep.c.netProfit')}
              value={fmtDA(data.netProfit)}
              hint={`${pctLabel(data.netMarginPct)} ${t('rep.fin.marginWord')}`}
            />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title={t('rep.fin.pl.revProfit')}>
              <LineChart
                points={data.series}
                series={[
                  { key: 'revenue', label: t('rep.c.revenue') },
                  { key: 'profit', label: t('rep.c.profit') },
                ]}
                format={fmtDA}
              />
            </Panel>
            <Panel title={t('rep.fin.pl.moneyGoes')} hint={t('rep.fin.pl.shareOfRevenue')}>
              <FunnelBars stages={stages} />
            </Panel>
          </div>
        </>
      )}
    </ReportShell>
  );
}
