'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
} from '@/components/charts';
import {
  getProductsReport,
  REPORT_CATALOG,
  type ProductsReport,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'products')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;

const PAGE = 50;

export default function ProductsReportPage() {
  const [data, setData] = useState<ProductsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getProductsReport());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE);

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
            <StatTile
              label="Products"
              value={data.productCount}
              hint={`${data.activeCount.toLocaleString()} active`}
            />
            <StatTile label="Units in stock" value={data.totalUnits} hint="Total on hand" />
            <StatTile label="Cost value" value={money(data.costValue)} hint="At cost price" />
            <StatTile label="Retail value" value={money(data.retailValue)} hint="At selling price" />
          </StatTileRow>

          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Catalog
                </h2>
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {filtered.length.toLocaleString()} products
                </p>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowAll(false);
                }}
                placeholder="Search name, SKU or category"
                className="w-full sm:w-64 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-white">
                  {data.rows.length === 0 ? 'No products yet' : 'No matches'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {data.rows.length === 0
                    ? 'Add products to your catalog to see them here.'
                    : 'Try a different search term.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">Product</th>
                        <th className="text-start font-medium py-2 pe-4">SKU</th>
                        <th className="text-start font-medium py-2 pe-4">Category</th>
                        <th className="text-end font-medium py-2 pe-4">Qty</th>
                        <th className="text-end font-medium py-2 pe-4">Cost</th>
                        <th className="text-end font-medium py-2 pe-4">Price</th>
                        <th className="text-end font-medium py-2 pe-4">Stock value</th>
                        <th className="text-start font-medium py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
                        <tr key={r.id} className="border-t border-white/[0.06]">
                          <td className="py-2.5 pe-4 text-white">
                            <span className="flex items-center gap-2">
                              {r.name}
                              {r.hasVariants && (
                                <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-500 border border-white/10 rounded px-1 py-0.5">
                                  Variants
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap">{r.sku}</td>
                          <td className="py-2.5 pe-4 text-zinc-400">{r.category ?? '—'}</td>
                          <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">
                            {r.quantity.toLocaleString()}
                          </td>
                          <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">{money(r.costPrice)}</td>
                          <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">{money(r.sellingPrice)}</td>
                          <td className="py-2.5 pe-4 text-end text-white tabular-nums">{money(r.stockValue)}</td>
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  r.isActive ? 'bg-white' : 'bg-zinc-600'
                                }`}
                              />
                              {r.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filtered.length > PAGE && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-3 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    {showAll ? `Show first ${PAGE}` : `Show all (${filtered.length.toLocaleString()})`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </ReportShell>
  );
}
