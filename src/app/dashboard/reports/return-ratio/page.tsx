'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  LineChart,
  FunnelBars,
  fmtNum,
} from '@/components/charts';
import { getReturnRatio, type ReturnRatioReport, type ReportPeriodParam } from '@/lib/reports-api';

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

/** Percent tile props — value rounded to 1 decimal, '%' suffix, or an em dash when null. */
function pctTile(v: number | null): { value: string | number; suffix?: string } {
  if (v == null || !Number.isFinite(v)) return { value: '—' };
  return { value: Math.round(v * 10) / 10, suffix: '%' };
}

export default function ReturnRatioPage() {
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ReturnRatioReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getReturnRatio(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const trendPoints = data
    ? data.series.map((p) => ({
        ...p,
        failed: (Number(p.cancelled) || 0) + (Number(p.returned) || 0),
      }))
    : [];

  const wilayaRows = data
    ? data.byWilaya.map((w) => ({
        id: w.id,
        label: w.label,
        sublabel:
          w.secondary != null ? `${w.secondary.toLocaleString()} orders` : w.sublabel,
        value: w.value,
      }))
    : [];

  return (
    <ReportShell
      title="Return Ratio"
      description="Order return and cancellation rates — the COD cost."
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
            <StatTile label="Fulfilment rate" {...pctTile(data.fulfilmentRatePct)} />
            <StatTile label="Cancel rate" {...pctTile(data.cancelRatePct)} />
            <StatTile label="Return rate" {...pctTile(data.returnRatePct)} />
            <StatTile label="Lost revenue" value={data.lostRevenue} suffix=" DA" />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Fulfilment funnel" subtitle="Cancelled and returned drop out">
              <FunnelBars
                stages={[
                  { label: 'Created', value: data.created, tone: 'good' },
                  { label: 'Delivered', value: data.delivered, tone: 'good' },
                  { label: 'Cancelled', value: data.cancelled, tone: 'dead' },
                  { label: 'Returned', value: data.returned, tone: 'dead' },
                ]}
              />
            </Panel>

            <Panel title="Delivered vs failed" subtitle="Cancelled + returned combined">
              <LineChart
                points={trendPoints}
                series={[
                  { key: 'delivered', label: 'Delivered' },
                  { key: 'failed', label: 'Cancelled + returned' },
                ]}
                format={fmtNum}
              />
            </Panel>
          </div>

          <Panel title="Return rate by wilaya" subtitle="Where orders fail most">
            <BarList
              rows={wilayaRows}
              valueFormat={(n) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}
            />
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
