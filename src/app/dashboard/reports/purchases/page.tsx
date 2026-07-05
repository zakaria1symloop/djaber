'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  fmtDA,
} from '@/components/charts';
import { getPurchasesReport, type PurchasesReport, type ReportPeriod } from '@/lib/reports-api';
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

export default function PurchasesReportPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<PurchasesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPurchasesReport(period, period === 'custom' ? range : undefined));
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
      title={t('rep.com.purch.title')}
      description={t('rep.com.purch.desc')}
      period={period}
      onPeriodChange={(p) => { setPeriod(p); setRange({}); }}
      startDate={range.startDate}
      endDate={range.endDate}
      onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label={t('rep.com.committed')} value={data.committed} suffix=" DA" />
            <StatTile label={t('rep.c.paid')} value={data.paid} suffix=" DA" />
            <StatTile
              label={t('rep.c.outstanding')}
              value={data.outstanding}
              suffix=" DA"
              hint={t('rep.com.purch.outstandingHint')}
            />
            <StatTile label={t('rep.com.purchaseOrders')} value={data.count} />
          </StatTileRow>

          <Panel title={t('rep.com.purch.committedVsPaid')} subtitle={t('rep.com.purch.committedVsPaid.sub')}>
            <LineChart
              points={data.series}
              series={[
                { key: 'committed', label: t('rep.com.committed') },
                { key: 'paid', label: t('rep.c.paid') },
              ]}
              format={fmtDA}
            />
          </Panel>

          <Panel title={t('rep.com.purch.byStatus')} subtitle={t('rep.com.purch.byStatus.sub')}>
            <BarList rows={data.byStatus} valueFormat={fmtDA} />
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
