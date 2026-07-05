'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  ColumnChart,
  fmtNum,
} from '@/components/charts';
import {
  getStockAdjustments,
  REPORT_CATALOG,
  type StockAdjustmentsReport,
  type ReportPeriod,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'stock-adjustments')!;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString()}`;

export default function StockAdjustmentsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<StockAdjustmentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getStockAdjustments(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.inv.adjustments.loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

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
            <StatTile label={t('rep.inv.adjustments.unitsAdded')} value={data.totalIn} hint={t('rep.inv.adjustments.unitsAddedHint')} />
            <StatTile label={t('rep.inv.adjustments.unitsRemoved')} value={data.totalOut} hint={t('rep.inv.adjustments.unitsRemovedHint')} />
            <StatTile label={t('rep.inv.adjustments.adjustments')} value={data.count} hint={t('rep.inv.adjustments.adjustmentsHint')} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* In vs Out */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('rep.inv.adjustments.inVsOut')}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.adjustments.unitsAdjusted')}</p>
              <ColumnChart
                points={[
                  { label: t('rep.inv.adjustments.added'), qty: data.totalIn },
                  { label: t('rep.inv.adjustments.removed'), qty: data.totalOut },
                ]}
                metric="qty"
                format={fmtNum}
                height={200}
              />
            </div>

            {/* Adjustments log */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('rep.inv.adjustments.log')}
              </h2>
              <p className="text-xs text-zinc-500 mb-4">{t('rep.inv.adjustments.logHint')}</p>
              {data.rows.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-white">{t('rep.inv.adjustments.emptyTitle')}</p>
                  <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.adjustments.emptyDesc')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.date')}</th>
                        <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                        <th className="text-start font-medium py-2 pe-4">{t('rep.inv.variant')}</th>
                        <th className="text-end font-medium py-2 pe-4">{t('rep.inv.qty')}</th>
                        <th className="text-start font-medium py-2">{t('rep.inv.reason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.id} className="border-t border-white/[0.06]">
                          <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap tabular-nums">
                            {dateLabel(r.date)}
                          </td>
                          <td className="py-2.5 pe-4 text-white">{r.productName}</td>
                          <td className="py-2.5 pe-4 text-zinc-400">{r.variantName ?? '—'}</td>
                          <td
                            className={`py-2.5 pe-4 text-end tabular-nums ${
                              r.quantity < 0 ? 'text-zinc-500' : 'text-white'
                            }`}
                          >
                            {signed(r.quantity)}
                          </td>
                          <td className="py-2.5 text-zinc-400">{r.reason ?? '—'}</td>
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
