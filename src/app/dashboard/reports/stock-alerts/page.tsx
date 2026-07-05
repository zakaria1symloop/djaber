'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  fmtNum,
} from '@/components/charts';
import {
  getStockAlerts,
  REPORT_CATALOG,
  type StockAlertsReport,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'stock-alerts')!;

export default function StockAlertsPage() {
  const [data, setData] = useState<StockAlertsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStockAlerts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock alerts');
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
            <StatTile label="Low stock" value={data.counts.low} hint="At or below minimum" />
            <StatTile label="Negative stock" value={data.counts.negative} hint="On-hand below zero" />
            <StatTile label="Out of stock" value={data.counts.out} hint="Nothing on hand" />
          </StatTileRow>

          {/* Low stock — qty vs min */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Low stock
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              {data.lowStock.length > 0
                ? `${data.lowStock.length.toLocaleString()} products are at or below their minimum level — reorder before they run out.`
                : 'Every product is above its minimum level.'}
            </p>
            <BarList
              rows={data.lowStock.map((p) => ({
                id: p.id,
                label: p.name,
                sublabel: p.sku,
                value: p.quantity,
                secondary: p.minQuantity,
              }))}
              valueFormat={fmtNum}
              showSecondary
              secondaryLabel="Min level"
              emptyText="No low-stock products"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Negative stock */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                Negative stock
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                {data.negativeStock.length > 0
                  ? 'On-hand fell below zero — usually an unrecorded purchase or a miscount to fix.'
                  : 'No product is showing negative on-hand.'}
              </p>
              {data.negativeStock.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">All counts look clean</p>
                  <p className="text-xs text-zinc-500 mt-1">Nothing is recorded below zero.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">Product</th>
                        <th className="text-start font-medium py-2 pe-4">SKU</th>
                        <th className="text-end font-medium py-2">On hand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.negativeStock.map((p) => (
                        <tr key={p.id} className="border-t border-white/[0.06]">
                          <td className="py-2.5 pe-4 text-white">{p.name}</td>
                          <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap">{p.sku}</td>
                          <td className="py-2.5 text-end text-zinc-500 tabular-nums">
                            {p.quantity.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Out of stock */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                Out of stock
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                {data.outOfStock.length > 0
                  ? `${data.outOfStock.length.toLocaleString()} products have nothing on hand right now.`
                  : 'Nothing is fully out of stock.'}
              </p>
              {data.outOfStock.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">Shelves are stocked</p>
                  <p className="text-xs text-zinc-500 mt-1">Every product has at least one unit on hand.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">Product</th>
                        <th className="text-start font-medium py-2 pe-4">SKU</th>
                        <th className="text-end font-medium py-2">Min level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.outOfStock.map((p) => (
                        <tr key={p.id} className="border-t border-white/[0.06]">
                          <td className="py-2.5 pe-4 text-white">{p.name}</td>
                          <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap">{p.sku}</td>
                          <td className="py-2.5 text-end text-zinc-400 tabular-nums">
                            {p.minQuantity.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
