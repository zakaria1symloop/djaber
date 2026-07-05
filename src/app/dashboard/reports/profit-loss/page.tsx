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
  REPORT_CATALOG,
  type ProfitLossReport,
  type ReportPeriod,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'profit-loss')!;

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
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getProfitLoss(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period]);

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
      title={META.title}
      description={META.description}
      period={period}
      onPeriodChange={setPeriod}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <>
          <StatTileRow>
            <StatTile label="Revenue" value={fmtDA(data.revenue)} />
            <StatTile label="Cost of goods" value={fmtDA(data.cogs)} />
            <StatTile
              label="Gross profit"
              value={fmtDA(data.grossProfit)}
              hint={`${pctLabel(data.grossMarginPct)} margin`}
            />
            <StatTile
              label="Net profit"
              value={fmtDA(data.netProfit)}
              hint={`${pctLabel(data.netMarginPct)} margin`}
            />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title="Revenue & profit">
              <LineChart
                points={data.series}
                series={[
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'profit', label: 'Profit' },
                ]}
                format={fmtDA}
              />
            </Panel>
            <Panel title="Where the money goes" hint="share of revenue">
              <FunnelBars stages={stages} />
            </Panel>
          </div>
        </>
      )}
    </ReportShell>
  );
}
