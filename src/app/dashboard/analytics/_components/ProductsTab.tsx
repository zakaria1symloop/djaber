'use client';

import { useCallback, useEffect, useState } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  getProductsAnalytics,
  type ProductsAnalyticsResponse,
} from '@/lib/analytics-api';

const num = (n: number) => n.toLocaleString();
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
        {value}
      </p>
    </div>
  );
}

export default function ProductsTab() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ProductsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getProductsAnalytics(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('an.tab.err.products'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-9 w-64 bg-zinc-900/60 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900/60 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-zinc-900/60 rounded-xl" />
          <div className="h-96 bg-zinc-900/60 rounded-xl" />
        </div>
        <div className="h-64 bg-zinc-900/60 rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            {t('rep.c.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, products, categories, deadStock } = data;
  const visibleProducts = showAll ? products : products.slice(0, 20);
  // Bars are scaled to the max revenue in the list (top item = full width).
  const maxProductRevenue = Math.max(...products.map((p) => p.revenue), 1);
  const maxCategoryRevenue = Math.max(...categories.map((c) => c.revenue), 1);
  const deadQtyTotal = deadStock.reduce((s, d) => s + d.stockQty, 0);
  const deadValueTotal = deadStock.reduce((s, d) => s + d.stockValue, 0);

  return (
    <div className="space-y-6">
      {/* Period row */}
      <div className="flex items-center justify-between gap-4">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
        {loading && <span className="text-xs text-zinc-500">{t('an.tab.updating')}</span>}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            {t('rep.c.retry')}
          </button>
        </div>
      )}

      {/* Headline stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('rep.c.revenue')} value={money(totals.revenue)} />
        <StatTile label={t('rep.c.unitsSold')} value={num(totals.unitsSold)} />
        <StatTile label={t('rep.c.grossProfit')} value={money(totals.grossProfit)} />
        <StatTile label={t('rep.c.stockValue')} value={money(totals.stockValue)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top products */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t('an.tab.prod.topProducts')}
          </h2>
          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-3">{t('an.tab.prod.byRevenue')}</p>

          {products.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-white">{t('an.tab.prod.empty.title')}</p>
              <p className="text-xs text-zinc-500 mt-1">{t('an.tab.prod.empty.desc')}</p>
            </div>
          ) : (
            <>
              <div>
                {visibleProducts.map((p) => (
                  <div key={p.id} className="py-3 border-t border-white/[0.06] first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                        <span className="text-sm font-medium text-white truncate">{p.name}</span>
                        <span className="text-[11px] text-zinc-500 shrink-0">{p.sku}</span>
                      </div>
                      <span className="text-sm font-semibold text-white whitespace-nowrap">{money(p.revenue)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${Math.min(100, (p.revenue / maxProductRevenue) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {num(p.unitsSold)} {t('an.tab.prod.unitsWord')}
                      {' · '}
                      {p.marginPct === null ? t('an.tab.prod.noMargin') : t('an.tab.prod.margin').replace('{n}', String(Math.round(p.marginPct)))}
                      {' · '}
                      {p.stockCoverDays === null ? t('an.tab.prod.noCover') : t('an.tab.prod.cover').replace('{n}', String(Math.round(p.stockCoverDays)))}
                    </p>
                  </div>
                ))}
              </div>

              {products.length > 20 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-3 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  {showAll ? t('an.tab.prod.showTop20') : t('an.tab.prod.showAllN').replace('{n}', String(products.length))}
                </button>
              )}

              {/* Totals row under the products list (period totals across all products) */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-baseline justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {t('rep.c.total')} &middot; {num(products.length)} {t('an.tab.prod.productsWord')} &middot; {num(totals.unitsSold)} {t('an.tab.prod.unitsWord')}
                </span>
                <span className="text-sm font-semibold text-white whitespace-nowrap">{money(totals.revenue)}</span>
              </div>
            </>
          )}
        </div>

        {/* Categories */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t('rep.c.categories')}
          </h2>
          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-3">{t('an.tab.prod.byRevenue')}</p>

          {categories.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-white">{t('an.tab.prod.noCatData')}</p>
              <p className="text-xs text-zinc-500 mt-1">{t('an.tab.prod.noCatDesc')}</p>
            </div>
          ) : (
            <div>
              {categories.map((c) => (
                <div key={c.name} className="py-2.5 border-t border-white/[0.06] first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-white truncate min-w-0">{c.name}</span>
                    <span className="text-sm font-semibold text-white whitespace-nowrap">{money(c.revenue)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${Math.min(100, (c.revenue / maxCategoryRevenue) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {num(c.unitsSold)} {t('an.tab.prod.unitsWord')} &middot; {num(c.productCount)} {t('an.tab.prod.productsWord')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dead stock */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          {t('an.tab.prod.deadStock')}
        </h2>
        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('an.tab.prod.deadStockSub')}</p>

        {deadStock.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-bold text-white">{t('an.tab.prod.deadEmpty.title')}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('an.tab.prod.deadEmpty.desc')}</p>
          </div>
        ) : (
          <>
            {/* Attention strip */}
            <div className="mb-4">
              <p className="text-sm font-bold text-white">
                {t('an.tab.prod.notSelling').replace('{n}', num(deadStock.length))}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('an.tab.prod.tiedUp').replace('{v}', money(deadValueTotal))}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                    <th className="text-start font-medium py-2 pe-4">{t('rep.c.sku')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('an.tab.prod.qty')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.stockValue')}</th>
                    <th className="text-end font-medium py-2">{t('rep.c.lastSold')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStock.map((d) => (
                    <tr key={d.id} className="border-t border-white/[0.06]">
                      <td className="py-2.5 pe-4 text-white whitespace-nowrap">{d.name}</td>
                      <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap">{d.sku}</td>
                      <td className="py-2.5 pe-4 text-end text-zinc-400">{num(d.stockQty)}</td>
                      <td className="py-2.5 pe-4 text-end text-white">{money(d.stockValue)}</td>
                      <td className="py-2.5 text-end text-zinc-500 whitespace-nowrap">{dateLabel(d.lastSoldAt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Totals row under the products table */}
                  <tr className="border-t border-white/10">
                    <td className="py-2.5 pe-4 text-[10px] uppercase tracking-[0.15em] text-zinc-500" colSpan={2}>
                      {t('rep.c.total')}
                    </td>
                    <td className="py-2.5 pe-4 text-end font-semibold text-white">{num(deadQtyTotal)}</td>
                    <td className="py-2.5 pe-4 text-end font-semibold text-white">{money(deadValueTotal)}</td>
                    <td className="py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
