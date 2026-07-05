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
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'stock-alerts')!;

export default function StockAlertsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<StockAlertsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStockAlerts());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.inv.alerts.loadError'));
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
            <StatTile label={t('rep.inv.alerts.lowStock')} value={data.counts.low} hint={t('rep.inv.alerts.lowHint')} />
            <StatTile label={t('rep.inv.alerts.negativeStock')} value={data.counts.negative} hint={t('rep.inv.alerts.negativeHint')} />
            <StatTile label={t('rep.inv.alerts.outOfStock')} value={data.counts.out} hint={t('rep.inv.alerts.outHint')} />
          </StatTileRow>

          {/* Low stock — qty vs min */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('rep.inv.alerts.lowStock')}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              {data.lowStock.length > 0
                ? t('rep.inv.alerts.lowDesc').replace('{n}', data.lowStock.length.toLocaleString())
                : t('rep.inv.alerts.lowDescEmpty')}
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
              secondaryLabel={t('rep.inv.alerts.minLevel')}
              emptyText={t('rep.inv.alerts.noLowStock')}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Negative stock */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('rep.inv.alerts.negativeStock')}
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                {data.negativeStock.length > 0
                  ? t('rep.inv.alerts.negativeDesc')
                  : t('rep.inv.alerts.negativeDescEmpty')}
              </p>
              {data.negativeStock.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">{t('rep.inv.alerts.negativeEmptyTitle')}</p>
                  <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.alerts.negativeEmptyDesc')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.sku')}</th>
                        <th className="text-end font-medium py-2">{t('rep.inv.alerts.onHand')}</th>
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
                {t('rep.inv.alerts.outOfStock')}
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                {data.outOfStock.length > 0
                  ? t('rep.inv.alerts.outDesc').replace('{n}', data.outOfStock.length.toLocaleString())
                  : t('rep.inv.alerts.outDescEmpty')}
              </p>
              {data.outOfStock.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">{t('rep.inv.alerts.outEmptyTitle')}</p>
                  <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.alerts.outEmptyDesc')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.sku')}</th>
                        <th className="text-end font-medium py-2">{t('rep.inv.alerts.minLevel')}</th>
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
