'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ReportShell,
  StatTile,
  StatTileRow,
  BarList,
  fmtDA,
} from '@/components/charts';
import { getTopSuppliers, type SuppliersReport, type ReportPeriod } from '@/lib/reports-api';

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

export default function TopSuppliersPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [data, setData] = useState<SuppliersReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTopSuppliers(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const outstanding = data ? data.suppliers.reduce((s, x) => s + x.extra.outstanding, 0) : 0;

  const barRows = data
    ? data.suppliers.map((s) => ({
        id: s.id,
        label: s.label,
        sublabel: s.sublabel,
        value: s.extra.spend,
      }))
    : [];

  return (
    <ReportShell
      title="Top Suppliers"
      description="Your biggest suppliers by total spend."
      period={period}
      onPeriodChange={setPeriod}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <div className="space-y-6">
          <StatTileRow>
            <StatTile label="Total spend" value={data.total} suffix=" DA" />
            <StatTile label="Suppliers" value={data.suppliers.length} />
            <StatTile label="Outstanding" value={outstanding} suffix=" DA" />
          </StatTileRow>

          <Panel title="Top suppliers by spend" subtitle="Your biggest commitments">
            <BarList rows={barRows} valueFormat={fmtDA} />
          </Panel>

          <Panel title="Supplier detail" subtitle="Purchases, spend and outstanding balance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium py-2 pe-4">Supplier</th>
                    <th className="text-end font-medium py-2 pe-4">Purchases</th>
                    <th className="text-end font-medium py-2 pe-4">Spend</th>
                    <th className="text-end font-medium py-2">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suppliers.map((s) => (
                    <tr key={s.id} className="border-t border-white/[0.06]">
                      <td className="py-2.5 pe-4">
                        <span className="text-white">{s.label}</span>
                        {s.sublabel && (
                          <span className="text-[11px] text-zinc-500 ms-2">{s.sublabel}</span>
                        )}
                      </td>
                      <td className="py-2.5 pe-4 text-end tabular-nums text-zinc-300">
                        {s.extra.purchases.toLocaleString()}
                      </td>
                      <td className="py-2.5 pe-4 text-end tabular-nums text-white">
                        {s.extra.spend.toLocaleString()} DA
                      </td>
                      <td
                        className={`py-2.5 text-end tabular-nums ${
                          s.extra.outstanding > 0 ? 'text-white' : 'text-zinc-500'
                        }`}
                      >
                        {s.extra.outstanding.toLocaleString()} DA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </ReportShell>
  );
}
