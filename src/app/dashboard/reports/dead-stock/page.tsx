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
  getDeadStock,
  REPORT_CATALOG,
  type DeadStockReport,
  type ReportPeriod,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'dead-stock')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'Never');
const PERIOD_WORD: Record<ReportPeriod, string> = {
  today: 'today',
  week: '7 days',
  month: '30 days',
  year: 'year',
};

export default function DeadStockPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<DeadStockReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDeadStock(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dead stock');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const deadValueTotal = data?.items.reduce((s, i) => s + i.stockValue, 0) ?? 0;

  return (
    <ReportShell
      title={META.title}
      description={META.description}
      period={period}
      onPeriodChange={setPeriod}
      loading={loading && !data}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile
              label="Dead stock value"
              value={money(data.deadStockValue)}
              hint={`Cash tied up · no sales in ${PERIOD_WORD[period]}`}
            />
            <StatTile label="Dead items" value={data.items.length} hint="In stock, not moving" />
            <StatTile label="Never sold" value={data.zeroSales.length} hint="No sale ever recorded" />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dead items table */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                Dead items
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                In stock with no sales in the last {PERIOD_WORD[period]} — discount, bundle or return to free up cash.
              </p>
              {data.items.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">All stock is moving</p>
                  <p className="text-xs text-zinc-500 mt-1">Every product in stock sold within this window.</p>
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
                        <th className="text-end font-medium py-2">Last sold</th>
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
                          <td className="py-2.5 text-end text-zinc-500 whitespace-nowrap tabular-nums">
                            {dateLabel(i.lastSoldAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10">
                        <td className="py-2.5 pe-4 text-[10px] uppercase tracking-[0.15em] text-zinc-500" colSpan={3}>
                          Total
                        </td>
                        <td className="py-2.5 pe-4 text-end font-semibold text-white tabular-nums">
                          {money(deadValueTotal)}
                        </td>
                        <td className="py-2.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Never-sold products */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                Never sold
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">Units held, zero lifetime sales</p>
              <BarList
                rows={data.zeroSales.map((p) => ({
                  id: p.id,
                  label: p.name,
                  sublabel: p.sku,
                  value: p.quantity,
                }))}
                valueFormat={(n) => `${fmtNum(n)} units`}
                emptyText="Everything has sold at least once"
              />
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
