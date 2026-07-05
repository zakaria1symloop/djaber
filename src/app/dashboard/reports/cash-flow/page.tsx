'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  LineChart,
  ColumnChart,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getCashFlow,
  REPORT_CATALOG,
  type CashFlowReport,
  type ReportPeriod,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'cash-flow')!;

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

export default function CashFlowPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCashFlow(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

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
            <StatTile label="Money in" value={fmtDA(data.totalIn)} />
            <StatTile label="Money out" value={fmtDA(data.totalOut)} />
            <StatTile label="Net movement" value={fmtDA(data.net)} />
            <StatTile
              label="Closing balance"
              value={fmtDA(data.closingBalance)}
              hint={`opened at ${fmtDA(data.openingBalance)}`}
            />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title="Running balance">
              <LineChart
                points={data.series}
                series={[{ key: 'balance', label: 'Balance' }]}
                format={fmtDA}
              />
            </Panel>
            <Panel title="By category">
              <BarList
                rows={data.byCategory}
                valueFormat={fmtDA}
                emptyText="No categories yet"
              />
            </Panel>
          </div>

          <Panel title="Money in vs money out">
            <ColumnChart points={data.series} metric="in" metric2="out" format={fmtDA} />
          </Panel>
        </>
      )}
    </ReportShell>
  );
}
