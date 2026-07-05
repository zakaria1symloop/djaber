'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  fmtDA,
} from '@/components/charts';
import { getTopProducts, type TopProductsReport, type ReportPeriod } from '@/lib/reports-api';

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

export default function TopProductsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<TopProductsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTopProducts(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data
    ? data.products.reduce(
        (acc, p) => ({
          revenue: acc.revenue + p.extra.revenue,
          profit: acc.profit + p.extra.profit,
          units: acc.units + p.extra.units,
        }),
        { revenue: 0, profit: 0, units: 0 },
      )
    : { revenue: 0, profit: 0, units: 0 };

  const barRows = data
    ? data.products.map((p) => ({
        id: p.id,
        label: p.label,
        sublabel: p.sublabel,
        value: p.extra.revenue,
        secondary: p.extra.units,
      }))
    : [];

  return (
    <ReportShell
      title="Top Selling Products"
      description="Best sellers by revenue and units, with margin."
      period={period}
      onPeriodChange={setPeriod}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label="Revenue" value={totals.revenue} suffix=" DA" />
            <StatTile label="Profit" value={totals.profit} suffix=" DA" />
            <StatTile label="Units sold" value={totals.units} />
            <StatTile label="Products" value={data.products.length} />
          </StatTileRow>

          <Panel title="Top products by revenue" subtitle="Bar length is revenue; marker is units">
            <BarList rows={barRows} valueFormat={fmtDA} showSecondary secondaryLabel="Units" />
          </Panel>

          <Panel title="Product detail" subtitle="Units, cost of goods, profit and margin">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium py-2 pe-4">Product</th>
                    <th className="text-end font-medium py-2 pe-4">Units</th>
                    <th className="text-end font-medium py-2 pe-4">Revenue</th>
                    <th className="text-end font-medium py-2 pe-4">COGS</th>
                    <th className="text-end font-medium py-2 pe-4">Profit</th>
                    <th className="text-end font-medium py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => {
                    const profitDead = p.extra.profit <= 0;
                    const marginDead = p.extra.marginPct <= 0;
                    return (
                      <tr key={p.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4">
                          <span className="text-white">{p.label}</span>
                          {p.sublabel && (
                            <span className="text-[11px] text-zinc-500 ms-2">{p.sublabel}</span>
                          )}
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-300">
                          {p.extra.units.toLocaleString()}
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-white">
                          {p.extra.revenue.toLocaleString()} DA
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-400">
                          {p.extra.cogs.toLocaleString()} DA
                        </td>
                        <td
                          className={`py-2.5 pe-4 text-end tabular-nums ${
                            profitDead ? 'text-zinc-500' : 'text-white'
                          }`}
                        >
                          {p.extra.profit.toLocaleString()} DA
                        </td>
                        <td
                          className={`py-2.5 text-end tabular-nums ${
                            marginDead ? 'text-zinc-500' : 'text-zinc-300'
                          }`}
                        >
                          {p.extra.marginPct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
