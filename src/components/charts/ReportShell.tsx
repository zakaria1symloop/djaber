'use client';

import React from 'react';
import Link from 'next/link';
import { PeriodSelector, type PeriodValue } from '@/components/analytics/KpiCard';

export type ReportPeriod = 'today' | 'week' | 'month' | 'year';

export interface ReportShellProps {
  title: string;
  description: string;
  period?: PeriodValue;
  onPeriodChange?: (value: ReportPeriod) => void;
  /** Current custom range bounds (YYYY-MM-DD). Provide with onRangeChange to enable Custom. */
  startDate?: string;
  endDate?: string;
  onRangeChange?: (start: string, end: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The standard frame every report page uses: back link, Syne title, optional
 * period selector + actions, a pulse skeleton while loading, a muted-red error
 * banner with Retry, then the report body.
 */
export function ReportShell({
  title,
  description,
  period,
  onPeriodChange,
  startDate,
  endDate,
  onRangeChange,
  loading,
  error,
  onRetry,
  actions,
  children,
}: ReportShellProps) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-4"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="rtl:rotate-180"
          >
            <path
              d="M7.5 2.5 L4 6 L7.5 9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Reports
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-bold text-white"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {title}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">{description}</p>
          </div>
          <div className="flex items-center gap-3">
            {period && onPeriodChange && (
              <PeriodSelector
                value={period}
                onChange={onPeriodChange}
                startDate={startDate}
                endDate={endDate}
                onRangeChange={onRangeChange}
              />
            )}
            {actions}
          </div>
        </div>
      </div>

      {error && onRetry && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-xl overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[#0c0c0e]" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-zinc-900/60 rounded-xl" />
            <div className="h-80 bg-zinc-900/60 rounded-xl" />
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default ReportShell;
