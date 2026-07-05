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
  getTopCustomers,
  REPORT_CATALOG,
  type TopCustomersReport,
  type ReportPeriod,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

const META = REPORT_CATALOG.find((r) => r.key === 'top-customers')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function TopCustomersPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<TopCustomersReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getTopCustomers(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.inv.topCustomers.loadError'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const count = data?.customers.length ?? 0;
  const avg = count > 0 ? (data as TopCustomersReport).total / count : 0;

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
            <StatTile label={t('rep.c.totalSpent')} value={money(data.total)} hint={t('rep.inv.topCustomers.totalHint')} />
            <StatTile label={t('rep.c.customers')} value={count} hint={t('rep.inv.topCustomers.customersHint')} />
            <StatTile label={t('rep.inv.topCustomers.avgPerCustomer')} value={money(avg)} hint={t('rep.inv.topCustomers.avgHint')} />
          </StatTileRow>

          {/* Ranked spend */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('rep.inv.topCustomers.bySpend')}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-4">{t('rep.inv.topCustomers.bySpendHint')}</p>
            <BarList
              rows={data.customers.map((c) => ({
                id: c.id,
                label: c.label,
                sublabel: c.sublabel,
                value: c.value,
              }))}
              valueFormat={fmtDA}
              emptyText={t('rep.inv.topCustomers.noSales')}
            />
          </div>

          {/* Detail table */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('rep.inv.topCustomers.detail')}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">{t('rep.inv.topCustomers.detailHint')}</p>
            {data.customers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold text-white">{t('rep.inv.topCustomers.emptyTitle')}</p>
                <p className="text-xs text-zinc-500 mt-1">{t('rep.inv.topCustomers.emptyDesc')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="text-start font-medium py-2 pe-4">{t('rep.c.customer')}</th>
                      <th className="text-end font-medium py-2 pe-4">{t('rep.c.orders')}</th>
                      <th className="text-end font-medium py-2 pe-4">{t('rep.inv.lastOrder')}</th>
                      <th className="text-start font-medium py-2 pe-4">{t('rep.inv.source')}</th>
                      <th className="text-end font-medium py-2">{t('rep.inv.spent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((c) => (
                      <tr key={c.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4 text-white">
                          {c.label}
                          {c.sublabel && (
                            <span className="text-[11px] text-zinc-500 ms-2">{c.sublabel}</span>
                          )}
                        </td>
                        <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">
                          {c.extra.orders.toLocaleString()}
                        </td>
                        <td className="py-2.5 pe-4 text-end text-zinc-500 whitespace-nowrap tabular-nums">
                          {dateLabel(c.extra.lastOrderDate)}
                        </td>
                        <td className="py-2.5 pe-4 text-zinc-400">{c.extra.source}</td>
                        <td className="py-2.5 text-end text-white tabular-nums">{money(c.extra.spent)}</td>
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
