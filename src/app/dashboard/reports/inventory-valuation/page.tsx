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
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'inventory-valuation')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;

export default function InventoryValuationPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InventoryValuationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInventoryValuation());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.inv.valuation.loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <StatTile label={t('rep.inv.costValue')} value={money(data.costValue)} hint={t('rep.inv.valuation.costHint')} />
            <StatTile label={t('rep.inv.retailValue')} value={money(data.retailValue)} hint={t('rep.inv.valuation.retailHint')} />
            <StatTile label={t('rep.inv.valuation.potentialProfit')} value={money(data.potentialProfit)} hint={t('rep.inv.valuation.potentialHint')} />
            <StatTile
              label={t('rep.inv.unitsInStock')}
              value={data.totalUnits}
              hint={t('rep.inv.valuation.unitsHint').replace('{n}', data.productCount.toLocaleString())}
            />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('rep.inv.valuation.byCategory')}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.valuation.byCategoryHint')}</p>
              <DonutChart
                slices={data.byCategory.map((c) => ({ label: c.label, value: c.value }))}
                centerValue={fmtDA(data.costValue)}
                centerLabel={t('rep.inv.costValue')}
              />
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('rep.inv.valuation.topProducts')}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.valuation.topProductsHint')}</p>
              <BarList
                rows={data.byCategory.length === 0 && data.topByValue.length === 0 ? [] : data.topByValue}
                valueFormat={fmtDA}
                emptyText={t('rep.inv.noStockOnHand')}
              />
            </div>
          </div>

          {/* Categories detail */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('rep.c.categories')}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.valuation.categoriesHint')}</p>
            {data.byCategory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold text-white">{t('rep.inv.valuation.noCategories')}</p>
                <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.valuation.noCategoriesHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="text-start font-medium py-2 pe-4">{t('rep.c.category')}</th>
                      <th className="text-end font-medium py-2 pe-4">{t('rep.c.units')}</th>
                      <th className="text-end font-medium py-2">{t('rep.inv.costValue')}</th>
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
                      <td className="py-2.5 pe-4 text-[10px] uppercase tracking-[0.15em] text-zinc-500">{t('rep.c.total')}</td>
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
