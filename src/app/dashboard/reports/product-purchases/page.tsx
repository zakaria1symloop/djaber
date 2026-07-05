'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getProductPurchases,
  type ProductPurchasesReport,
  type ReportPeriod,
} from '@/lib/reports-api';

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

export default function ProductPurchasesPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<ProductPurchasesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getProductPurchases(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const totalUnits = data ? data.products.reduce((s, p) => s + (p.secondary ?? 0), 0) : 0;

  return (
    <ReportShell
      title="Product Purchases"
      description="What you restock most, by quantity and cost."
      period={period}
      onPeriodChange={setPeriod}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label="Total cost" value={data.total} suffix=" DA" />
            <StatTile label="Products" value={data.products.length} />
            <StatTile label="Units purchased" value={totalUnits} />
          </StatTileRow>

          <Panel title="Most purchased products" subtitle="Bar length is cost; marker is units">
            <BarList
              rows={data.products}
              valueFormat={fmtDA}
              showSecondary
              secondaryLabel="Units"
            />
          </Panel>

          <Panel title="Purchase detail" subtitle="Units and cost per product">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium py-2 pe-4">Product</th>
                    <th className="text-end font-medium py-2 pe-4">Units</th>
                    <th className="text-end font-medium py-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className="border-t border-white/[0.06]">
                      <td className="py-2.5 pe-4">
                        <span className="text-white">{p.label}</span>
                        {p.sublabel && (
                          <span className="text-[11px] text-zinc-500 ms-2">{p.sublabel}</span>
                        )}
                      </td>
                      <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-300">
                        {(p.secondary ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-end tabular-nums text-white">
                        {p.value.toLocaleString()} DA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
