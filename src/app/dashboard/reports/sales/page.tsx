'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  DonutChart,
  fmtDA,
  fmtNum,
} from '@/components/charts';
import { getSalesReport, type SalesReport, type ReportPeriodParam } from '@/lib/reports-api';
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

export default function SalesReportPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSalesReport(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.com.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ReportShell
      title={t('rep.com.sales.title')}
      description={t('rep.com.sales.desc')}
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
            <StatTile label={t('rep.c.revenue')} value={data.revenue} suffix=" DA" />
            <StatTile label={t('rep.c.orders')} value={data.orders} />
            {data.avgOrderValue != null ? (
              <StatTile label={t('rep.c.avgOrderValue')} value={data.avgOrderValue} suffix=" DA" />
            ) : (
              <StatTile label={t('rep.c.avgOrderValue')} value="—" />
            )}
            <StatTile label={t('rep.com.itemsSold')} value={data.itemsSold} />
          </StatTileRow>

          <Panel title={t('rep.com.sales.revenueOrders')} subtitle={t('rep.com.sales.revenueOrders.sub')}>
            <LineChart
              points={data.series}
              series={[
                { key: 'revenue', label: t('rep.c.revenue') },
                { key: 'orders', label: t('rep.c.orders') },
              ]}
              format={fmtNum}
            />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title={t('rep.com.sales.byChannel')} subtitle={t('rep.com.sales.byChannel.sub')}>
              <DonutChart
                slices={data.byChannel.map((c) => ({ label: c.label, value: c.value }))}
                centerValue={fmtDA(data.revenue)}
                centerLabel={t('rep.c.revenue')}
              />
            </Panel>

            <Panel title={t('rep.com.sales.byPaymentStatus')} subtitle={t('rep.com.sales.byPaymentStatus.sub')}>
              <BarList rows={data.byPaymentStatus} valueFormat={fmtDA} />
            </Panel>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
