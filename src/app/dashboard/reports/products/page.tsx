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
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'products')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;

const PAGE = 50;

export default function ProductsReportPage() {
  const { t } = useTranslation();
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
      setError(e instanceof Error ? e.message : t('rep.inv.products.loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              label={t('rep.c.products')}
              value={data.productCount}
              hint={t('rep.inv.products.activeHint').replace('{n}', data.activeCount.toLocaleString())}
            />
            <StatTile label={t('rep.inv.unitsInStock')} value={data.totalUnits} hint={t('rep.inv.products.totalOnHand')} />
            <StatTile label={t('rep.inv.costValue')} value={money(data.costValue)} hint={t('rep.inv.products.atCost')} />
            <StatTile label={t('rep.inv.retailValue')} value={money(data.retailValue)} hint={t('rep.inv.products.atSelling')} />
          </StatTileRow>

          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('rep.inv.products.catalog')}
                </h2>
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {t('rep.inv.products.countLabel').replace('{n}', filtered.length.toLocaleString())}
                </p>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowAll(false);
                }}
                placeholder={t('rep.inv.products.searchPlaceholder')}
                className="w-full sm:w-64 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-white">
                  {data.rows.length === 0 ? t('rep.inv.products.noProducts') : t('rep.inv.products.noMatches')}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {data.rows.length === 0
                    ? t('rep.inv.products.noProductsHint')
                    : t('rep.inv.products.noMatchesHint')}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.sku')}</th>
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.category')}</th>
                        <th className="text-end font-medium py-2 pe-4">{t('rep.inv.qty')}</th>
                        <th className="text-end font-medium py-2 pe-4">{t('rep.c.cost')}</th>
                        <th className="text-end font-medium py-2 pe-4">{t('rep.c.price')}</th>
                        <th className="text-end font-medium py-2 pe-4">{t('rep.c.stockValue')}</th>
                        <th className="text-start font-medium py-2">{t('rep.c.status')}</th>
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
                                  {t('rep.inv.variants')}
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
                              {r.isActive ? t('rep.c.active') : t('rep.c.inactive')}
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
                    {showAll
                      ? t('rep.inv.products.showFirst').replace('{n}', String(PAGE))
                      : t('rep.inv.products.showAllCount').replace('{n}', filtered.length.toLocaleString())}
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
