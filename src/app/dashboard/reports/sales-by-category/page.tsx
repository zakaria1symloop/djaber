'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  DonutChart,
  fmtDA,
} from '@/components/charts';
import {
  getSalesByCategory,
  type SalesByCategoryReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

function Panel({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bg-zinc-900/50 border border-white/10 rounded-xl p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SalesByCategoryPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<SalesByCategoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSalesByCategory(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.com.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const totalUnits = data ? data.categories.reduce((s, c) => s + (c.secondary ?? 0), 0) : 0;

  return (
    <ReportShell
      title={t('rep.com.cat.title')}
      description={t('rep.com.cat.desc')}
      period={period}
      onPeriodChange={(p) => {
        setPeriod(p);
        setRange({});
      }}
      startDate={range.startDate}
      endDate={range.endDate}
      onRangeChange={(s, e) => {
        setPeriod('custom');
        setRange({ startDate: s, endDate: e });
      }}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label={t('rep.com.totalRevenue')} value={data.total} suffix=" DA" />
            <StatTile label={t('rep.c.categories')} value={data.categories.length} />
            <StatTile label={t('rep.c.unitsSold')} value={totalUnits} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title={t('rep.com.cat.revShare')} subtitle={t('rep.com.cat.revShare.sub')}>
              <DonutChart
                slices={data.categories.map((c) => ({ label: c.label, value: c.value }))}
                centerValue={fmtDA(data.total)}
                centerLabel={t('rep.c.revenue')}
              />
            </Panel>

            <Panel title={t('rep.com.cat.ranked')} subtitle={t('rep.com.cat.ranked.sub')}>
              <BarList
                rows={data.categories}
                valueFormat={fmtDA}
                showSecondary
                secondaryLabel={t('rep.c.units')}
              />
            </Panel>
          </div>

          <Panel title={t('rep.com.cat.detail')} subtitle={t('rep.com.cat.detail.sub')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium py-2 pe-4">{t('rep.c.category')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.units')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.revenue')}</th>
                    <th className="text-end font-medium py-2">{t('rep.c.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((c) => {
                    const share = data.total > 0 ? Math.round((c.value / data.total) * 100) : 0;
                    return (
                      <tr key={c.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4 text-white">{c.label}</td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-300">
                          {(c.secondary ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-white">
                          {c.value.toLocaleString()} DA
                        </td>
                        <td className="py-2.5 text-end tabular-nums text-zinc-400">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
