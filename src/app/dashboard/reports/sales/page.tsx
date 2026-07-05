'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  DonutChart,
  fmtDA,
  fmtNum,
} from '@/components/charts';
import { getSalesReport, type SalesReport, type ReportPeriod } from '@/lib/reports-api';

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

export default function SalesReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getSalesReport(period));
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
      title="Sales Report"
      description="Sales and delivered orders: revenue, volume and trend."
      period={period}
      onPeriodChange={setPeriod}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label="Revenue" value={data.revenue} suffix=" DA" />
            <StatTile label="Orders" value={data.orders} />
            {data.avgOrderValue != null ? (
              <StatTile label="Avg order value" value={data.avgOrderValue} suffix=" DA" />
            ) : (
              <StatTile label="Avg order value" value="—" />
            )}
            <StatTile label="Items sold" value={data.itemsSold} />
          </StatTileRow>

          <Panel title="Revenue & orders" subtitle="Over the selected period">
            <LineChart
              points={data.series}
              series={[
                { key: 'revenue', label: 'Revenue' },
                { key: 'orders', label: 'Orders' },
              ]}
              format={fmtNum}
            />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="By channel" subtitle="Where revenue comes from">
              <DonutChart
                slices={data.byChannel.map((c) => ({ label: c.label, value: c.value }))}
                centerValue={fmtDA(data.revenue)}
                centerLabel="Revenue"
              />
            </Panel>

            <Panel title="By payment status" subtitle="Revenue by settlement state">
              <BarList rows={data.byPaymentStatus} valueFormat={fmtDA} />
            </Panel>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
