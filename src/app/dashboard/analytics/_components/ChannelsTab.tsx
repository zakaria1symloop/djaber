'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import {
  getChannelsAnalytics,
  type ChannelAnalytics,
  type ChannelsAnalyticsResponse,
} from '@/lib/analytics-api';

const SYNE = { fontFamily: 'Syne, sans-serif' } as const;

function formatPct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function LedgerCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0c0c0e] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-white" style={SYNE}>{value}</p>
    </div>
  );
}

function ChannelCard({ channel }: { channel: ChannelAnalytics }) {
  // potentialScore is contractually 0-100; clamp so the bar can never overflow the track.
  const score = Math.max(0, Math.min(100, channel.potentialScore));

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
      {/* Identity row */}
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="text-base font-bold text-white truncate" style={SYNE}>
          {channel.pageName}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 shrink-0">
          {channel.platform}
        </span>
      </div>

      {/* Potential meter */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Potential</span>
        <span className="text-sm font-bold text-white" style={SYNE}>
          {score.toLocaleString()}
          <span className="text-xs font-normal text-zinc-500">/100</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-white" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-sm text-zinc-400">{channel.potentialNote}</p>

      {/* Mini ledger — hairline band */}
      <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/10">
          <LedgerCell label="Conversations" value={channel.conversations.toLocaleString()} />
          <LedgerCell label="New" value={channel.newConversations.toLocaleString()} />
          <LedgerCell label="Messages in" value={channel.messagesIn.toLocaleString()} />
          <LedgerCell label="Messages out" value={channel.messagesOut.toLocaleString()} />
          <LedgerCell label="AI orders" value={channel.aiOrders.toLocaleString()} />
          <LedgerCell label="AI revenue" value={`${channel.aiRevenue.toLocaleString()} DA`} />
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {channel.conversionPct !== null && channel.conversionPct > 0
          ? `${formatPct(channel.conversionPct)}% of chats become orders`
          : 'no conversions yet'}
      </p>
    </div>
  );
}

export default function ChannelsTab() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<ChannelsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getChannelsAnalytics(period, period === 'custom' ? range : undefined);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel analytics');
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white" style={SYNE}>Channels</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Which pages have potential</p>
        </div>
        <PeriodSelector value={period} onChange={(p) => { setPeriod(p); setRange({}); }} startDate={range.startDate} endDate={range.endDate} onRangeChange={(s, e) => { setPeriod('custom'); setRange({ startDate: s, endDate: e }); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-40 bg-white/10 rounded mb-5" />
              <div className="h-1.5 w-full bg-white/10 rounded-full mb-5" />
              <div className="h-3 w-2/3 bg-white/10 rounded mb-5" />
              <div className="h-24 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="text-sm text-red-400 underline underline-offset-4 shrink-0"
          >
            Retry
          </button>
        </div>
      ) : !data || data.channels.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl px-6 py-12 text-center">
          <p className="text-white font-bold" style={SYNE}>No channels connected yet</p>
          <p className="text-sm text-zinc-500 mt-1.5">
            Connect a page to start measuring its potential.{' '}
            <Link
              href="/dashboard?section=pages"
              className="text-white underline underline-offset-4"
            >
              Connect a page
            </Link>
          </p>
        </div>
      ) : (
        // Rendered in API order: potentialScore desc (per contract).
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.channels.map((channel) => (
            <ChannelCard key={channel.pageId} channel={channel} />
          ))}
        </div>
      )}
    </div>
  );
}
