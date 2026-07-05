'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
} from '@/components/charts';
import {
  getInactiveCustomers,
  REPORT_CATALOG,
  type InactiveCustomersReport,
} from '@/lib/reports-api';

const META = REPORT_CATALOG.find((r) => r.key === 'inactive-customers')!;
const money = (n: number) => `${Math.round(n).toLocaleString()} DA`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

const THRESHOLDS = [30, 60, 90] as const;

export default function InactiveCustomersPage() {
  const [days, setDays] = useState<number>(60);
  const [data, setData] = useState<InactiveCustomersReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInactiveCustomers(days));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inactive customers');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const avg = data && data.count > 0 ? data.lostValue / data.count : 0;

  const thresholdSelector = (
    <div className="inline-flex items-center bg-zinc-900/60 border border-white/10 rounded-lg p-1">
      {THRESHOLDS.map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            days === d ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {d}d+
        </button>
      ))}
    </div>
  );

  return (
    <ReportShell
      title={META.title}
      description={META.description}
      actions={thresholdSelector}
      loading={loading && !data}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile
              label="Inactive customers"
              value={data.count}
              hint={`No order in ${days}+ days`}
            />
            <StatTile label="Lost value" value={money(data.lostValue)} hint="Lifetime spend at risk" />
            <StatTile label="Avg lifetime value" value={money(avg)} hint="Per inactive customer" />
          </StatTileRow>

          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Win them back
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              {data.count > 0
                ? `${data.count.toLocaleString()} customers haven't ordered in ${days}+ days — ${money(
                    data.lostValue,
                  )} of lifetime spend to re-engage.`
                : `No customer has gone quiet for ${days}+ days.`}
            </p>
            {data.customers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-bold text-white">Everyone is active</p>
                <p className="text-xs text-zinc-500 mt-1">No customer crossed the {days}-day threshold.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="text-start font-medium py-2 pe-4">Customer</th>
                      <th className="text-start font-medium py-2 pe-4">Phone</th>
                      <th className="text-end font-medium py-2 pe-4">Orders</th>
                      <th className="text-end font-medium py-2 pe-4">Spent</th>
                      <th className="text-end font-medium py-2">Days since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((c) => (
                      <tr key={c.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 pe-4 text-white">{c.name}</td>
                        <td className="py-2.5 pe-4 text-zinc-400 whitespace-nowrap tabular-nums">
                          {c.phone ?? '—'}
                        </td>
                        <td className="py-2.5 pe-4 text-end text-zinc-400 tabular-nums">
                          {c.totalOrders.toLocaleString()}
                        </td>
                        <td className="py-2.5 pe-4 text-end text-white tabular-nums">{money(c.totalSpent)}</td>
                        <td className="py-2.5 text-end text-zinc-500 whitespace-nowrap tabular-nums">
                          {c.daysSince === null ? '—' : `${c.daysSince.toLocaleString()}d`}
                        </td>
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
