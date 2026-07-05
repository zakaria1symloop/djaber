'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  LineChart,
  DonutChart,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getPayments,
  type PaymentsReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bg-zinc-900/50 border border-white/10 rounded-xl p-5 ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{title}</h2>
        {hint && <span className="text-[11px] text-zinc-500 tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<PaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPayments(period, period === 'custom' ? range : undefined));
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
      title={t('rep.fin.payments.title')}
      description={t('rep.fin.payments.desc')}
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
        <>
          <StatTileRow>
            <StatTile label={t('rep.fin.pay.received')} value={fmtDA(data.received)} />
            <StatTile label={t('rep.fin.pay.paidOut')} value={fmtDA(data.paidOut)} />
            <StatTile label={t('rep.c.net')} value={fmtDA(data.net)} />
            <StatTile label={t('rep.fin.pay.paymentMethods')} value={data.byMethod.length} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title={t('rep.fin.pay.receivedVsPaid')}>
              <LineChart
                points={data.series}
                series={[
                  { key: 'received', label: t('rep.fin.pay.received') },
                  { key: 'paidOut', label: t('rep.fin.pay.paidOut') },
                ]}
                format={fmtDA}
              />
            </Panel>
            <Panel title={t('rep.fin.pay.byMethod')}>
              <DonutChart
                slices={data.byMethod.map((r) => ({ label: r.label, value: r.value }))}
                centerValue={fmtDA(data.received)}
                centerLabel={t('rep.fin.pay.received')}
              />
            </Panel>
          </div>

          <Panel title={t('rep.fin.bySource')}>
            <BarList rows={data.bySource} valueFormat={fmtDA} emptyText={t('rep.fin.pay.noPayments')} />
          </Panel>
        </>
      )}
    </ReportShell>
  );
}
