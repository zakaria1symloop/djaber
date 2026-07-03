'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PeriodSelector } from '@/components/analytics/KpiCard';
import {
  getAgentsAnalytics,
  type AnalyticsPeriod,
  type AgentAnalytics,
  type AgentsAnalyticsResponse,
} from '@/lib/analytics-api';

const SYNE = { fontFamily: 'Syne, sans-serif' } as const;

function formatPct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-white" style={SYNE}>{value}</p>
    </div>
  );
}

function InsightPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
      {label}
      <span className="font-semibold text-white" style={SYNE}>{count.toLocaleString()}</span>
    </span>
  );
}

function AgentCard({ agent }: { agent: AgentAnalytics }) {
  const lowConversion =
    agent.conversionPct !== null && agent.conversionPct < 5 && agent.conversations >= 10;

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
      {/* Identity row */}
      <div className="flex items-center gap-2.5 mb-5">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            agent.isActive ? 'bg-white' : 'border border-zinc-600'
          }`}
          aria-hidden
        />
        <h3 className="text-base font-bold text-white truncate" style={SYNE}>
          {agent.name}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 truncate">
          {agent.aiModel}
        </span>
      </div>

      {/* Headline income */}
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">Income</p>
        <p className="text-2xl font-bold text-white" style={SYNE}>
          {agent.aiRevenue.toLocaleString()}{' '}
          <span className="text-sm font-normal text-zinc-500">DA</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-8 gap-y-4 mb-5">
        <StatItem label="AI orders" value={agent.aiOrders.toLocaleString()} />
        <StatItem
          label="Avg order value"
          value={
            agent.avgOrderValue !== null
              ? `${Math.round(agent.avgOrderValue).toLocaleString()} DA`
              : '—'
          }
        />
        <StatItem label="Conversations" value={agent.conversations.toLocaleString()} />
        <StatItem label="Messages handled" value={agent.messagesHandled.toLocaleString()} />
        <StatItem
          label="Conversion"
          value={agent.conversionPct !== null ? `${formatPct(agent.conversionPct)}%` : '—'}
        />
      </div>

      {/* Insights strip */}
      <div className="flex flex-wrap gap-2">
        <InsightPill label="Unclear" count={agent.insights.unclear} />
        <InsightPill label="Unknown" count={agent.insights.unknown} />
        <InsightPill label="Handoff" count={agent.insights.handoff} />
        <InsightPill label="Resolved" count={agent.insights.resolved} />
      </div>

      {/* Attention strip */}
      {lowConversion && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            Low conversion — review the agent&apos;s instructions
          </p>
          <Link
            href={`/dashboard/agents/${agent.id}/edit`}
            className="text-sm font-medium text-white underline underline-offset-4 shrink-0"
          >
            Edit
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AgentsTab() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [data, setData] = useState<AgentsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAgentsAnalytics(period);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white" style={SYNE}>Agents</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Which AI generates more income</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-40 bg-white/10 rounded mb-5" />
              <div className="h-8 w-32 bg-white/10 rounded mb-5" />
              <div className="h-10 w-full bg-white/5 rounded mb-5" />
              <div className="h-6 w-2/3 bg-white/5 rounded-full" />
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
      ) : !data || data.agents.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl px-6 py-12 text-center">
          <p className="text-white font-bold" style={SYNE}>No agents yet</p>
          <p className="text-sm text-zinc-500 mt-1.5">
            Create an AI agent to start generating income from your conversations.{' '}
            <Link href="/dashboard/agents" className="text-white underline underline-offset-4">
              Go to agents
            </Link>
          </p>
        </div>
      ) : (
        // Rendered in API order: aiRevenue desc (per contract).
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
