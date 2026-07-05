'use client';

import { useCallback, useEffect, useState } from 'react';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import {
  getOrdersAnalytics,
  type OrdersAnalyticsResponse,
} from '@/lib/analytics-api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) => n.toLocaleString();
const money = (n: number) => `${n.toLocaleString()} DA`;
const pct = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

/** Percent of `part` over `whole`, capped at 100 for bar widths. */
const barPct = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, (part / whole) * 100) : 0;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{children}</div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-white text-base font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
      {children}
    </h3>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
      <MicroLabel>{label}</MicroLabel>
      <div className="text-2xl font-bold text-white mt-2" style={{ fontFamily: 'Syne, sans-serif' }}>
        {value}
      </div>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-white font-bold">{title}</p>
      <p className="text-sm text-zinc-500 mt-1">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function OrdersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="h-2 bg-white/10 rounded-full" style={{ width: `${100 - i * 14}%` }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="h-3 w-20 bg-white/10 rounded" />
            <div className="h-6 w-24 bg-white/10 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-4">
        <div className="h-4 w-36 bg-white/10 rounded" />
        <div className="h-2 bg-white/10 rounded-full" />
        <div className="h-2 w-2/3 bg-white/10 rounded-full" />
      </div>
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-3">
        <div className="h-4 w-40 bg-white/10 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-white/5 rounded" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

export default function OrdersTab() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<OrdersAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersAnalytics(period, period === 'custom' ? range : undefined);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders analytics');
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersAnalytics(period, period === 'custom' ? range : undefined);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load orders analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, range.startDate, range.endDate]);

  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
        </div>
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm">{error}</p>
          <button
            onClick={load}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
        </div>
        <OrdersSkeleton />
      </div>
    );
  }

  const { funnel, confirmation, cod, cancelRatePct, returnRatePct, bySource, byWilaya, series } = data;

  // Funnel stages — all bars scaled to `created` (the widest stage).
  const funnelStages: Array<{ label: string; value: number; fill: string; muted: boolean }> = [
    { label: 'Created', value: funnel.created, fill: 'bg-white', muted: false },
    { label: 'Confirmed', value: funnel.confirmed, fill: 'bg-zinc-500', muted: false },
    { label: 'Shipped', value: funnel.shipped, fill: 'bg-zinc-500', muted: false },
    { label: 'Delivered', value: funnel.delivered, fill: 'bg-white', muted: false },
    { label: 'Cancelled', value: funnel.cancelled, fill: 'bg-zinc-500', muted: true },
    { label: 'Returned', value: funnel.returned, fill: 'bg-zinc-500', muted: true },
  ];

  // AI vs Manual — bars scaled to the larger of the two revenues.
  const maxSourceRevenue = Math.max(bySource.ai.revenue, bySource.manual.revenue);
  const sourceRows = [
    { label: 'AI', orders: bySource.ai.orders, revenue: bySource.ai.revenue, fill: 'bg-white' },
    { label: 'Manual', orders: bySource.manual.orders, revenue: bySource.manual.revenue, fill: 'bg-zinc-500' },
  ];

  const confirmationPills = [
    { label: 'Not called', value: confirmation.notCalled },
    { label: 'No answer', value: confirmation.noAnswer },
    { label: 'Confirmed', value: confirmation.confirmed },
    { label: 'Rejected', value: confirmation.rejected },
  ];

  // Wilaya table — orders-cell bars scaled to the max orders in the list.
  const maxWilayaOrders = Math.max(1, ...byWilaya.map((w) => w.orders));

  // Trend — bar heights scaled to the max orders bucket in the series.
  const maxSeriesOrders = Math.max(...series.map((s) => s.orders), 0);
  const hasTrend = maxSeriesOrders > 0;
  // Show roughly every 5th date label (wider steps for long series) to avoid collisions.
  const labelStep = Math.max(5, Math.ceil(series.length / 12));

  return (
    <div className="space-y-6">
      {/* 1. Period selector */}
      <div className="flex justify-end">
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
      </div>

      {/* 2. Funnel */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <SectionTitle>Order funnel</SectionTitle>
        {funnel.created === 0 ? (
          <EmptyState title="No orders in this period" hint="Orders will appear here as they come in." />
        ) : (
          <div className="space-y-4">
            {funnelStages.map((stage) => {
              const share = funnel.created > 0 ? (stage.value / funnel.created) * 100 : 0;
              return (
                <div key={stage.label}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="text-sm text-zinc-400">{stage.label}</span>
                    <span className={`text-sm font-semibold ${stage.muted ? 'text-zinc-500' : 'text-white'}`}>
                      {fmt(stage.value)}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${stage.fill} rounded-full h-2`}
                      style={{ width: `${barPct(stage.value, funnel.created)}%` }}
                    />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-1">
                    {share.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of created
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="COD collected"
          value={money(cod.collectedValue)}
          sub={cod.collectionPct === null ? 'No delivered orders yet' : `${pct(cod.collectionPct)} of ${money(cod.deliveredValue)} delivered`}
        />
        <StatTile label="Cancel rate" value={pct(cancelRatePct)} sub={`${fmt(funnel.cancelled)} cancelled`} />
        <StatTile label="Return rate" value={pct(returnRatePct)} sub={`${fmt(funnel.returned)} returned`} />
        <StatTile
          label="Avg call attempts"
          value={confirmation.avgCallAttempts.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          sub="Per order confirmation"
        />
      </div>

      {/* 4. AI vs Manual */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <SectionTitle>AI vs Manual</SectionTitle>
        {bySource.ai.orders === 0 && bySource.manual.orders === 0 ? (
          <EmptyState title="No orders to compare" hint="AI and manual order sources will show up here." />
        ) : (
          <div className="space-y-5">
            {sourceRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="text-sm text-zinc-400">
                    {row.label}
                    <span className="text-zinc-500"> · {fmt(row.orders)} orders</span>
                  </span>
                  <span className="text-sm font-semibold text-white">{money(row.revenue)}</span>
                </div>
                <div className="bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${row.fill} rounded-full h-2`}
                    style={{ width: `${barPct(row.revenue, maxSourceRevenue)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Confirmation breakdown */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <SectionTitle>Confirmation breakdown</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {confirmationPills.map((pill) => (
            <div
              key={pill.label}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
            >
              <span className="text-xs text-zinc-400">{pill.label}</span>
              <span className="text-xs font-semibold text-white">{fmt(pill.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Orders by wilaya */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <SectionTitle>Orders by wilaya</SectionTitle>
        {byWilaya.length === 0 ? (
          <EmptyState title="No wilaya data yet" hint="Delivered orders will break down by wilaya here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  <th className="text-start font-medium py-2 pe-3">#</th>
                  <th className="text-start font-medium py-2 pe-3">Wilaya</th>
                  <th className="text-start font-medium py-2 pe-3">Orders</th>
                  <th className="text-end font-medium py-2 pe-3">Revenue</th>
                  <th className="text-end font-medium py-2 pe-3">Delivered</th>
                  <th className="text-end font-medium py-2 pe-3">Returned</th>
                  <th className="text-end font-medium py-2">Delivery fees</th>
                </tr>
              </thead>
              <tbody>
                {byWilaya.map((w, i) => (
                  <tr key={w.wilayaId} className="border-t border-white/[0.06]">
                    <td className="py-2.5 pe-3 text-zinc-500">{i + 1}</td>
                    <td className="py-2.5 pe-3 text-zinc-400 whitespace-nowrap">{w.name}</td>
                    <td className="py-2.5 pe-3">
                      <div className="text-white font-medium">{fmt(w.orders)}</div>
                      <div className="bg-white/10 rounded-full h-1.5 w-24 mt-1">
                        <div
                          className="bg-white rounded-full h-1.5"
                          style={{ width: `${barPct(w.orders, maxWilayaOrders)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pe-3 text-end text-white whitespace-nowrap">{money(w.revenue)}</td>
                    <td className="py-2.5 pe-3 text-end text-zinc-400">{fmt(w.delivered)}</td>
                    <td className="py-2.5 pe-3 text-end text-zinc-500">{fmt(w.returned)}</td>
                    <td className="py-2.5 text-end text-zinc-400 whitespace-nowrap">{money(w.deliveryFees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Trend */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <SectionTitle>Orders trend</SectionTitle>
        {!hasTrend ? (
          <EmptyState title="No activity in this period" hint="Daily order volumes will chart here." />
        ) : (
          <div>
            <div className="flex items-end gap-px h-24">
              {series.map((bucket) => (
                <div
                  key={bucket.date}
                  title={`${bucket.date} · ${fmt(bucket.orders)} orders · ${money(bucket.revenue)}`}
                  className="flex-1 bg-white/70 hover:bg-white rounded-sm transition-colors min-w-0"
                  style={{
                    height: bucket.orders > 0 ? `${Math.max(4, barPct(bucket.orders, maxSeriesOrders))}%` : '2px',
                  }}
                />
              ))}
            </div>
            <div className="flex gap-px mt-1.5">
              {series.map((bucket, i) => (
                <div key={bucket.date} className="flex-1 min-w-0 text-center">
                  {i % labelStep === 0 && (
                    <span className="text-[9px] text-zinc-600 whitespace-nowrap">{bucket.date.slice(5)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
