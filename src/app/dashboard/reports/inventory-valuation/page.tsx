'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  DonutChart,
  fmtDA,
  fmtNum,
} from '@/components/charts';
import {
  getInventoryValuation,
  REPORT_CATALOG,
  type InventoryValuationReport,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'inventory-valuation')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;

export default function InventoryValuationPage() {
  const [data, setData] = useState<InventoryValuationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInventoryValuation());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory valuation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
            <StatTile label="Cost value" value={money(data.costValue)} hint="What your stock cost you" />
            <StatTile label="Retail value" value={money(data.retailValue)} hint="At current selling prices" />
            <StatTile label="Potential profit" value={money(data.potentialProfit)} hint="Retail minus cost" />
            <StatTile
              label="Units in stock"
              value={data.totalUnits}
              hint={`Across ${data.productCount.toLocaleString()} products`}
            />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                Stock value by category
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">Share of cost value</p>
              <DonutChart
                slices={data.byCategory.map((c) => ({ label: c.label, value: c.value }))}
                centerValue={fmtDA(data.costValue)}
                centerLabel="Cost value"
              />
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                Top products by value
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">Cash tied up per product</p>
              <BarList
                rows={data.byCategory.length === 0 && data.topByValue.length === 0 ? [] : data.topByValue}
                valueFormat={fmtDA}
                emptyText="No stock on hand"
              />
            </div>
          </div>

          {/* Categories detail */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Categories
            </h2>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">Cost value and units per category</p>
            {data.byCategory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold text-white">No categories yet</p>
                <p className="text-xs text-zinc-500 mt-1">Assign categories to your products to break value down.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="text-start font-medium py-2 pe-4">Category</th>
                      <th className="text-end font-medium py-2 pe-4">Units</th>
                      <th className="text-end font-medium py-2">Cost value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.map((c) => (
                      <tr key={c.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4 text-white">{c.label}</td>
                        <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">
                          {fmtNum(c.secondary ?? 0)}
                        </td>
                        <td className="py-2.5 text-end text-white tabular-nums">{money(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10">
                      <td className="py-2.5 pe-4 text-[10px] uppercase tracking-[0.15em] text-zinc-500">Total</td>
                      <td className="py-2.5 pe-4 text-end font-semibold text-white tabular-nums">
                        {data.totalUnits.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-end font-semibold text-white tabular-nums">{money(data.costValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </ReportShell>
  );
}
