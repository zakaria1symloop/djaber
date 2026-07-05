'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  fmtDA,
} from '@/components/charts';
import { getPurchasesReport, type PurchasesReport, type ReportPeriod } from '@/lib/reports-api';

function Panel({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bg-zinc-900/50 border border-white/10 rounded-xl p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function PurchasesReportPage() {
  const [period, setPeriod] = useState<ReportPeriod | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<PurchasesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPurchasesReport(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ReportShell
      title="Purchases Report"
      description="Purchase orders: committed vs paid, by status and over time."
      period={period}
      onPeriodChange={(p) => { setPeriod(p); setRange({}); }}
      startDate={range.startDate}
      endDate={range.endDate}
      onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label="Committed" value={data.committed} suffix=" DA" />
            <StatTile label="Paid" value={data.paid} suffix=" DA" />
            <StatTile
              label="Outstanding"
              value={data.outstanding}
              suffix=" DA"
              hint="Committed minus paid"
            />
            <StatTile label="Purchase orders" value={data.count} />
          </StatTileRow>

          <Panel title="Committed vs paid" subtitle="Spend commitment against settlement">
            <LineChart
              points={data.series}
              series={[
                { key: 'committed', label: 'Committed' },
                { key: 'paid', label: 'Paid' },
              ]}
              format={fmtDA}
            />
          </Panel>

          <Panel title="By status" subtitle="Committed value by purchase status">
            <BarList rows={data.byStatus} valueFormat={fmtDA} />
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
