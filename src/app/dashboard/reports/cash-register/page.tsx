'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReportShell, StatTile, StatTileRow, fmtDA } from '@/components/charts';
import {
  getCashRegister,
  REPORT_CATALOG,
  type CashRegisterReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'cash-register')!;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CashRegisterPage() {
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<CashRegisterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getCashRegister(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

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
            <StatTile label="Income" value={fmtDA(data.income)} />
            <StatTile label="Expense" value={fmtDA(data.expense)} />
            <StatTile label="Balance" value={fmtDA(data.balance)} />
            <StatTile label="Transactions" value={data.count} />
          </StatTileRow>

          <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02]">
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium px-4 py-3 whitespace-nowrap">Date</th>
                    <th className="text-start font-medium px-4 py-3">Type</th>
                    <th className="text-start font-medium px-4 py-3">Category</th>
                    <th className="text-start font-medium px-4 py-3">Reference</th>
                    <th className="text-end font-medium px-4 py-3 whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center">
                        <p className="text-sm font-bold text-white">No transactions</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Cash movements will appear here as they are recorded.
                        </p>
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => {
                    const income = r.type === 'income';
                    return (
                      <tr key={r.id} className="border-t border-white/[0.06]">
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap tabular-nums">
                          {fmtDate(r.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-zinc-300">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                income ? 'bg-white' : 'bg-zinc-600'
                              }`}
                            />
                            {income ? 'Income' : 'Expense'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <span className="truncate">{r.category}</span>
                            {r.isAutomatic && (
                              <span className="shrink-0 text-[9px] uppercase tracking-wider text-zinc-500 border border-white/10 rounded px-1 py-0.5">
                                Auto
                              </span>
                            )}
                          </span>
                          {r.description && (
                            <span className="block text-[11px] text-zinc-500 truncate mt-0.5">
                              {r.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                          {r.reference ?? '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-end tabular-nums whitespace-nowrap ${
                            income ? 'text-white' : 'text-zinc-500'
                          }`}
                        >
                          {income ? '+' : '−'}
                          {r.amount.toLocaleString()} DA
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
}
