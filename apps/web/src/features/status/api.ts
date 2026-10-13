// Public status data (03 §27 OPS-06, api-contract §3.14 `StatusPageDto` + `maintenance`): `GET /status` (public, also read
// by the merchant shell every 60 s for the maintenance banner and by the help center widget), `POST /status/subscribe`,
// `GET /status/confirm/:token` (double opt-in), `GET /status/unsubscribe/:token`.
import type { StatusPageDto, StatusSubscribeInput } from '@djaber/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type StatusPage = StatusPageDto;

export const statusApi = {
  get: () => api<StatusPage>('/status', { noRefresh: true }),
  subscribe: (b: StatusSubscribeInput) => api<unknown>('/status/subscribe', { method: 'POST', body: b, noRefresh: true }),
  confirm: (token: string) => api<unknown>(`/status/confirm/${encodeURIComponent(token)}`, { noRefresh: true }),
  unsubscribe: (token: string) => api<unknown>(`/status/unsubscribe/${encodeURIComponent(token)}`, { noRefresh: true }),
};

export const statusKey = ['public', 'status'] as const;

/** `GET /status`, refreshed every 60 s (maintenance banner, help widget, public page). */
export const useStatus = (o: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: statusKey, queryFn: statusApi.get, refetchInterval: 60_000, staleTime: 30_000, retry: 1, enabled: o.enabled ?? true });
