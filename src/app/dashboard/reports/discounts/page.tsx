'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  ColumnChart,
  BarList,
  fmtDA,
} from '@/components/charts';
import {
  getDiscounts,
  type DiscountSummaryReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

function pctLabel(p: number | null): string {
  return p == null || !Number.isFinite(p) ? '—' : `${p.toFixed(1)}%`;
}

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

export default function DiscountsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<DiscountSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getDiscounts(period, period === 'custom' ? range : undefined));
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
      title={t('rep.fin.discounts.title')}
      description={t('rep.fin.discounts.desc')}
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
            <StatTile label={t('rep.fin.disc.total')} value={fmtDA(data.totalDiscount)} />
            <StatTile label={t('rep.fin.disc.rate')} value={pctLabel(data.discountRatePct)} />
            <StatTile label={t('rep.fin.disc.discountedRevenue')} value={fmtDA(data.discountedRevenue)} />
            <StatTile label={t('rep.fin.disc.productsDiscounted')} value={data.topDiscountedProducts.length} />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title={t('rep.fin.disc.overTime')}>
              <ColumnChart points={data.series} metric="discount" format={fmtDA} />
            </Panel>
            <Panel title={t('rep.fin.disc.mostDiscounted')}>
              <BarList
                rows={data.topDiscountedProducts}
                valueFormat={fmtDA}
                emptyText={t('rep.fin.disc.noDiscounts')}
              />
            </Panel>
          </div>
        </>
      )}
    </ReportShell>
  );
}
