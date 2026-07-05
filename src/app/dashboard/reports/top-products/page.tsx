'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  fmtDA,
} from '@/components/charts';
import { getTopProducts, type TopProductsReport, type ReportPeriodParam } from '@/lib/reports-api';
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

export default function TopProductsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<TopProductsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getTopProducts(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.com.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data
    ? data.products.reduce(
        (acc, p) => ({
          revenue: acc.revenue + p.extra.revenue,
          profit: acc.profit + p.extra.profit,
          units: acc.units + p.extra.units,
        }),
        { revenue: 0, profit: 0, units: 0 },
      )
    : { revenue: 0, profit: 0, units: 0 };

  const barRows = data
    ? data.products.map((p) => ({
        id: p.id,
        label: p.label,
        sublabel: p.sublabel,
        value: p.extra.revenue,
        secondary: p.extra.units,
      }))
    : [];

  return (
    <ReportShell
      title={t('rep.com.topProd.title')}
      description={t('rep.com.topProd.desc')}
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
            <StatTile label={t('rep.c.revenue')} value={totals.revenue} suffix=" DA" />
            <StatTile label={t('rep.c.profit')} value={totals.profit} suffix=" DA" />
            <StatTile label={t('rep.c.unitsSold')} value={totals.units} />
            <StatTile label={t('rep.c.products')} value={data.products.length} />
          </StatTileRow>

          <Panel title={t('rep.com.topProd.byRevenue')} subtitle={t('rep.com.topProd.byRevenue.sub')}>
            <BarList rows={barRows} valueFormat={fmtDA} showSecondary secondaryLabel={t('rep.c.units')} />
          </Panel>

          <Panel title={t('rep.com.topProd.detail')} subtitle={t('rep.com.topProd.detail.sub')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium py-2 pe-4">{t('rep.c.product')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.units')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.revenue')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.cogs')}</th>
                    <th className="text-end font-medium py-2 pe-4">{t('rep.c.profit')}</th>
                    <th className="text-end font-medium py-2">{t('rep.c.margin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => {
                    const profitDead = p.extra.profit <= 0;
                    const marginDead = p.extra.marginPct <= 0;
                    return (
                      <tr key={p.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4">
                          <span className="text-white">{p.label}</span>
                          {p.sublabel && (
                            <span className="text-[11px] text-zinc-500 ms-2">{p.sublabel}</span>
                          )}
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-300">
                          {p.extra.units.toLocaleString()}
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-white">
                          {p.extra.revenue.toLocaleString()} DA
                        </td>
                        <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-400">
                          {p.extra.cogs.toLocaleString()} DA
                        </td>
                        <td
                          className={`py-2.5 pe-4 text-end tabular-nums ${
                            profitDead ? 'text-zinc-500' : 'text-white'
                          }`}
                        >
                          {p.extra.profit.toLocaleString()} DA
                        </td>
                        <td
                          className={`py-2.5 text-end tabular-nums ${
                            marginDead ? 'text-zinc-500' : 'text-zinc-300'
                          }`}
                        >
                          {p.extra.marginPct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                        </td>
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
