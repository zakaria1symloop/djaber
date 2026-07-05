'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  ColumnChart,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getDiscounts,
  REPORT_CATALOG,
  type DiscountSummaryReport,
  type ReportPeriod,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'discounts')!;

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

export default function DiscountsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<DiscountSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDiscounts(period));
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
            <StatTile label="Total discount" value={fmtDA(data.totalDiscount)} />
            <StatTile label="Discount rate" value={pctLabel(data.discountRatePct)} />
            <StatTile label="Discounted revenue" value={fmtDA(data.discountedRevenue)} />
            <StatTile label="Products discounted" value={data.topDiscountedProducts.length} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title="Discounts over time">
              <ColumnChart points={data.series} metric="discount" format={fmtDA} />
            </Panel>
            <Panel title="Most discounted products">
              <BarList
                rows={data.topDiscountedProducts}
                valueFormat={fmtDA}
                emptyText="No discounts yet"
              />
            </Panel>
          </div>
        </>
      )}
    </ReportShell>
  );
}
