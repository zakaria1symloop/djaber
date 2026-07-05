'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  LineChart,
  DonutChart,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getPayments,
  REPORT_CATALOG,
  type PaymentsReport,
  type ReportPeriod,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'payments')!;

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

export default function PaymentsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<PaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getPayments(period));
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
            <StatTile label="Received" value={fmtDA(data.received)} />
            <StatTile label="Paid out" value={fmtDA(data.paidOut)} />
            <StatTile label="Net" value={fmtDA(data.net)} />
            <StatTile label="Payment methods" value={data.byMethod.length} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title="Received vs paid out">
              <LineChart
                points={data.series}
                series={[
                  { key: 'received', label: 'Received' },
                  { key: 'paidOut', label: 'Paid out' },
                ]}
                format={fmtDA}
              />
            </Panel>
            <Panel title="By payment method">
              <DonutChart
                slices={data.byMethod.map((r) => ({ label: r.label, value: r.value }))}
                centerValue={fmtDA(data.received)}
                centerLabel="Received"
              />
            </Panel>
          </div>

          <Panel title="By source">
            <BarList rows={data.bySource} valueFormat={fmtDA} emptyText="No payments yet" />
          </Panel>
        </>
      )}
    </ReportShell>
  );
}
