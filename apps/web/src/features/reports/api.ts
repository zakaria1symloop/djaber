'use client';
// Reports calls (06 "GDS operations" `GET /reports`, §8.6 schedules; `.local/m8-notes/contract-ready.md`): hub, one
// report page (`format=json`), exports (CSV immediate ≤ 5 000 rows else job · XLSX job · PDF immediate), monthly
// e-mails, favourites (`PATCH /me/prefs { reportFavorites }`) and the "Exports récents" jobs (`GET /jobs?kind=export`).
import type { ReportDataView, ReportFileView, ReportKey, ReportScheduleInput, ReportScheduleView, ReportsHubView } from '@djaber/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, apiRaw, ApiError } from '@/lib/api';
import { isJobRunning, type JobDto, type JobRef } from '@/lib/jobs';
import { useWorkspaceId } from '@/lib/session';
import { useWsEvent } from '@/lib/ws';

export type ReportApiQuery = Record<string, string | number | undefined>;
export type ReportPage = { view: ReportDataView; total: number; page: number; pageSize: number };
export type ExportStart = { kind: 'file'; file: ReportFileView } | { kind: 'job'; jobId: string };

export const reportsApi = {
  hub: () => api<ReportsHubView>('/reports'),
  schedules: () => api<ReportScheduleView[]>('/reports/schedules'),
  report: async (key: string, q: ReportApiQuery): Promise<ReportPage> => {
    const r = await apiRaw<ReportDataView>(`/reports/${key}`, { query: { ...q, format: 'json' } });
    return { view: r.data, total: r.meta?.total ?? r.data.totalRows, page: r.meta?.page ?? 1, pageSize: r.meta?.pageSize ?? 25 };
  },
  /** CSV: 200 file (≤ 5 000 rows) or 202 job · XLSX: 202 job · PDF: 200 file */
  export: async (key: string, format: 'csv' | 'xlsx' | 'pdf', q: ReportApiQuery): Promise<ExportStart> => {
    const r = await apiRaw<ReportFileView | JobRef>(`/reports/${key}`, { query: { ...q, format } });
    return 'jobId' in r.data ? { kind: 'job', jobId: r.data.jobId } : { kind: 'file', file: r.data };
  },
  schedule: (key: ReportKey, b: ReportScheduleInput) => api<ReportScheduleView>(`/reports/${key}/schedule`, { method: 'POST', body: b }),
  unschedule: (key: ReportKey, email: string) => api<null>(`/reports/${key}/schedule`, { method: 'DELETE', body: { email } }),
  setFavorites: (reportFavorites: ReportKey[]) => api<unknown>('/me/prefs', { method: 'PATCH', body: { reportFavorites } }),
  exportJobs: async (): Promise<JobDto[]> => (await apiRaw<JobDto[]>('/jobs', { query: { kind: 'export', pageSize: 25 } })).data ?? [],
  cancelJob: (id: string) => api<JobDto>(`/jobs/${id}/cancel`, { method: 'POST', body: {} }),
  retryJob: (id: string) => api<JobRef>(`/jobs/${id}/retry`, { method: 'POST', body: {} }),
};

export const reportsKeys = {
  all: (ws: string) => [ws, 'reports'] as const,
  hub: (ws: string) => [ws, 'reports', 'hub'] as const,
  schedules: (ws: string) => [ws, 'reports', 'schedules'] as const,
  report: (ws: string, key: string, q: ReportApiQuery) => [ws, 'reports', 'one', key, q] as const,
  exports: (ws: string) => [ws, 'reports', 'exports'] as const,
};

const noRetry4xx = (n: number, e: unknown) => n < 2 && !(e instanceof ApiError && e.status < 500);

export const useReportsHub = (enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: reportsKeys.hub(ws), queryFn: reportsApi.hub, enabled: !!ws && enabled, retry: noRetry4xx });
};
export const useReport = (key: string, q: ReportApiQuery, enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: reportsKeys.report(ws, key, q), queryFn: () => reportsApi.report(key, q), enabled: !!ws && enabled, placeholderData: keepPreviousData, retry: noRetry4xx, staleTime: 30_000 });
};
/** "Exports récents": refreshed every 3 s while one runs (and on `job.updated`). */
export const useExportJobs = (enabled = true) => {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  useWsEvent('job.updated', () => void qc.invalidateQueries({ queryKey: reportsKeys.exports(ws) }));
  return useQuery({
    queryKey: reportsKeys.exports(ws),
    queryFn: reportsApi.exportJobs,
    enabled: !!ws && enabled,
    retry: noRetry4xx,
    refetchInterval: (q) => ((q.state.data ?? []).some((j) => isJobRunning(j)) ? 3_000 : false),
  });
};

export function useReportsRefresh() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: reportsKeys.all(ws) }), [ws, qc]);
}
