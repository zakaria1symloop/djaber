'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getStockAging,
  REPORT_CATALOG,
  type StockAgingReport,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'stock-aging')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function StockAgingPage() {
  const [data, setData] = useState<StockAgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStockAging());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock aging');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalValue = data?.buckets.reduce((s, b) => s + b.value, 0) ?? 0;
  const totalUnits = data?.buckets.reduce((s, b) => s + (b.secondary ?? 0), 0) ?? 0;
  const oldValue = data?.buckets.find((b) => b.label.includes('90'))?.value ?? 0;

  return (
    <ReportShell
      title={META.title}
      description={META.description}
      loading={loading && !data}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label="Stock value" value={money(totalValue)} hint="On hand at cost" />
            <StatTile label="Units in stock" value={totalUnits} hint="Across all buckets" />
            <StatTile label="Aged 90d+" value={money(oldValue)} hint="Sitting over 90 days" />
            <StatTile label="Items tracked" value={data.items.length} hint="With movement history" />
          </StatTileRow>

          {/* Aging buckets */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Stock value by age
            </h2>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">Days since last movement</p>
            <BarList
              rows={data.buckets.map((b) => ({
                id: b.id,
                label: b.label,
                sublabel: `${(b.secondary ?? 0).toLocaleString()} units`,
                value: b.value,
              }))}
              valueFormat={fmtDA}
              emptyText="No stock on hand"
            />
          </div>

          {/* Oldest items */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Oldest items
            </h2>
            <p className="text-xs text-zinc-500 mb-4">Longest sitting stock — the first candidates to clear.</p>
            {data.items.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold text-white">No aging data yet</p>
                <p className="text-xs text-zinc-500 mt-1">Movement history will populate this list over time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="text-start font-medium py-2 pe-4">Product</th>
                      <th className="text-start font-medium py-2 pe-4">SKU</th>
                      <th className="text-end font-medium py-2 pe-4">Qty</th>
                      <th className="text-end font-medium py-2 pe-4">Stock value</th>
                      <th className="text-end font-medium py-2 pe-4">Last moved</th>
                      <th className="text-end font-medium py-2">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((i) => (
                      <tr key={i.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4 text-white">{i.name}</td>
                        <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap">{i.sku}</td>
                        <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">
                          {i.quantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 pe-4 text-end text-white tabular-nums">{money(i.stockValue)}</td>
                        <td className="py-2.5 pe-4 text-end text-zinc-500 whitespace-nowrap tabular-nums">
                          {dateLabel(i.lastMovedAt)}
                        </td>
                        <td className="py-2.5 text-end text-zinc-400 whitespace-nowrap tabular-nums">
                          {i.ageDays === null ? '—' : `${i.ageDays.toLocaleString()}d`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </ReportShell>
  );
}
