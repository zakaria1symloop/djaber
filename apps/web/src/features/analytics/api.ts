'use client';
// Analytics calls (06 "Notifications, home, analytics"; `.local/m8-notes/contract-ready.md`): `GET /analytics/overview`
// and the 8 tab endpoints with the URL period (`period` | `from`/`to`, `compare=previous`). The period lives in the
// URL (`usePeriod`); a range refused by the API (`REPORT_*`, `INVALID_DATE_RANGE`) is shown inside the picker.
import type { AnalyticsTab, AnalyticsViewOf } from '@djaber/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { api, ApiError } from '@/lib/api';
import { useWorkspaceId } from '@/lib/session';
import { parsePeriod, periodQuery, periodSearch, type PeriodState } from './period';

export const analyticsKeys = {
  all: (ws: string) => [ws, 'analytics'] as const,
  tab: (ws: string, tab: string, q: Record<string, string>) => [ws, 'analytics', tab, q] as const,
};

export const RANGE_CODES = ['REPORT_RANGE_TOO_LONG', 'REPORT_CUSTOM_RANGE_REQUIRED', 'INVALID_DATE_RANGE'] as const;
export const isRangeError = (e: unknown): e is ApiError => e instanceof ApiError && (RANGE_CODES as readonly string[]).includes(e.code);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `?channelId=` of the page (one connected page; counter sales then leave Revenue). */
export function useChannelFilter() {
  const params = useSearchParams();
  const raw = params.get('channelId') ?? '';
  return UUID.test(raw) ? raw : null;
}

export function useAnalytics<T extends AnalyticsTab>(tab: T, period: PeriodState) {
  const ws = useWorkspaceId();
  const channelId = useChannelFilter();
  const q = useMemo(() => ({ ...periodQuery(period), ...(channelId ? { channelId } : {}) }), [period, channelId]);
  // an incomplete custom range is never sent: the picker explains what is missing
  const ready = period.period !== 'custom' || (!!period.from && !!period.to);
  return useQuery({
    queryKey: analyticsKeys.tab(ws, tab, q),
    queryFn: () => api<AnalyticsViewOf[T]>(`/analytics/${tab}`, { query: q }),
    enabled: !!ws && ready,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: (n, e) => n < 2 && !(e instanceof ApiError && e.status < 500),
  });
}

/** Period of the page from the URL + a setter that keeps every other query parameter. */
export function usePeriod() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const period = useMemo(() => parsePeriod(params), [params]);
  const setPeriod = useCallback(
    (next: PeriodState) => {
      const keep = [...params.entries()].filter(([k]) => !['period', 'from', 'to', 'compare', 'page'].includes(k));
      const qs = new URLSearchParams([...periodSearch(next), ...keep]).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { period, setPeriod };
}
