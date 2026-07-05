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
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'stock-aging')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function StockAgingPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<StockAgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStockAging());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.inv.aging.loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <StatTile label={t('rep.c.stockValue')} value={money(totalValue)} hint={t('rep.inv.aging.stockValueHint')} />
            <StatTile label={t('rep.inv.unitsInStock')} value={totalUnits} hint={t('rep.inv.aging.unitsHint')} />
            <StatTile label={t('rep.inv.aging.aged90')} value={money(oldValue)} hint={t('rep.inv.aging.aged90Hint')} />
            <StatTile label={t('rep.inv.aging.itemsTracked')} value={data.items.length} hint={t('rep.inv.aging.itemsTrackedHint')} />
          </StatTileRow>

          {/* Aging buckets */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('rep.inv.aging.byAge')}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.aging.byAgeHint')}</p>
            <BarList
              rows={data.buckets.map((b) => ({
                id: b.id,
                label: b.label,
                sublabel: `${(b.secondary ?? 0).toLocaleString()} ${t('rep.inv.unitsWord')}`,
                value: b.value,
              }))}
              valueFormat={fmtDA}
              emptyText={t('rep.inv.noStockOnHand')}
            />
          </div>

          {/* Oldest items */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('rep.inv.aging.oldestItems')}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">{t('rep.inv.aging.oldestItemsHint')}</p>
            {data.items.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold text-white">{t('rep.inv.aging.emptyTitle')}</p>
                <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.aging.emptyDesc')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                      <th className="text-start font-medium py-2 pe-4">{t('rep.c.sku')}</th>
                      <th className="text-end font-medium py-2 pe-4">{t('rep.inv.qty')}</th>
                      <th className="text-end font-medium py-2 pe-4">{t('rep.c.stockValue')}</th>
                      <th className="text-end font-medium py-2 pe-4">{t('rep.inv.aging.lastMoved')}</th>
                      <th className="text-end font-medium py-2">{t('rep.inv.aging.age')}</th>
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
                          {i.ageDays === null ? '—' : `${i.ageDays.toLocaleString()}${t('rep.inv.dayShort')}`}
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
