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
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'dead-stock')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;

export default function DeadStockPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<DeadStockReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : t('rep.c.never'));
  const PERIOD_WORD: Record<ReportPeriod | 'custom', string> = {
    today: t('rep.inv.dead.period.today'),
    week: t('rep.inv.dead.period.week'),
    month: t('rep.inv.dead.period.month'),
    year: t('rep.inv.dead.period.year'),
    custom: t('rep.inv.dead.period.custom'),
  };

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getDeadStock(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.inv.dead.loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const deadValueTotal = data?.items.reduce((s, i) => s + i.stockValue, 0) ?? 0;

  return (
    <ReportShell
      title={META.title}
      description={META.description}
      period={period}
      onPeriodChange={(p) => { setPeriod(p); setRange({}); }}
      startDate={range.startDate}
      endDate={range.endDate}
      onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }}
      loading={loading && !data}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile
              label={t('rep.inv.dead.deadStockValue')}
              value={money(data.deadStockValue)}
              hint={t('rep.inv.dead.deadValueHint').replace('{period}', PERIOD_WORD[period])}
            />
            <StatTile label={t('rep.inv.dead.deadItems')} value={data.items.length} hint={t('rep.inv.dead.deadItemsHint')} />
            <StatTile label={t('rep.inv.dead.neverSold')} value={data.zeroSales.length} hint={t('rep.inv.dead.neverSoldHint')} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dead items table */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('rep.inv.dead.deadItems')}
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                {t('rep.inv.dead.deadItemsDesc').replace('{period}', PERIOD_WORD[period])}
              </p>
              {data.items.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">{t('rep.inv.dead.itemsEmptyTitle')}</p>
                  <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.dead.itemsEmptyDesc')}</p>
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
                        <th className="text-end font-medium py-2">{t('rep.c.lastSold')}</th>
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
                          {t('rep.c.total')}
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
                {t('rep.inv.dead.neverSold')}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.dead.neverSoldSubhead')}</p>
              <BarList
                rows={data.zeroSales.map((p) => ({
                  id: p.id,
                  label: p.name,
                  sublabel: p.sku,
                  value: p.quantity,
                }))}
                valueFormat={(n) => `${fmtNum(n)} ${t('rep.inv.unitsWord')}`}
                emptyText={t('rep.inv.dead.neverSoldEmpty')}
              />
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
