'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  ColumnChart,
  DonutChart,
  fmtDA,
} from '@/components/charts';
import {
  getExpenses,
  REPORT_CATALOG,
  type ExpensesReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'expenses')!;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function ExpensesPage() {
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ExpensesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getExpenses(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const top = data?.byCategory?.[0];

  return (
    <ReportShell
      title={META.title}
      description={META.description}
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
            <StatTile label="Total spent" value={fmtDA(data.total)} />
            <StatTile label="Categories" value={data.byCategory.length} />
            <StatTile label="Entries" value={data.rows.length} />
            <StatTile
              label="Largest category"
              value={top ? top.label : '—'}
              hint={top ? fmtDA(top.value) : undefined}
            />
          </StatTileRow>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel className="lg:col-span-2" title="Spending over time">
              <ColumnChart points={data.series} metric="amount" format={fmtDA} />
            </Panel>
            <Panel title="By category">
              <DonutChart
                slices={data.byCategory.map((r) => ({ label: r.label, value: r.value }))}
                centerValue={fmtDA(data.total)}
                centerLabel="Total"
              />
            </Panel>
          </div>

          <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02]">
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium px-4 py-3 whitespace-nowrap">Date</th>
                    <th className="text-start font-medium px-4 py-3">Category</th>
                    <th className="text-start font-medium px-4 py-3">Description</th>
                    <th className="text-start font-medium px-4 py-3">Source</th>
                    <th className="text-end font-medium px-4 py-3 whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center">
                        <p className="text-sm font-bold text-white">No expenses</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Recorded expenses will appear here.
                        </p>
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-t border-white/[0.06]">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap tabular-nums">
                        {fmtDate(r.date)}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{r.category}</td>
                      <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                        {r.description ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 border border-white/10 rounded px-1.5 py-0.5">
                          {r.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end text-white tabular-nums whitespace-nowrap">
                        {r.amount.toLocaleString()} DA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
}
