// Channels calls (06 §2 "Channels", §8.7) + TanStack Query hooks and cache keys. The web never talks to Meta: the
// connect / reconnect endpoints return the URL the browser is sent to, and the API callback reports the outcome.
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ConversationListItem } from '@/features/inbox/contracts';
import { api, ApiError, apiRaw, type Meta } from '@/lib/api';
import type { JobRef } from '@/lib/jobs';
import type { ApiQuery } from '@/lib/list-state';
import { useWorkspaceId } from '@/lib/session';
import type { AppReviewStatus, ApprovalStatus, Channel, ChannelEvent, ChannelInsights, ChannelsList, ChannelSummary, ConnectReport, ConnectStart, Platform, PlanLimit, SyncDays } from './contracts';

export type CursorPage<T> = { rows: T[]; nextCursor: string | null; hasMore: boolean };
const cursorPage = async <T>(path: string, query: ApiQuery): Promise<CursorPage<T>> => {
  const r = await apiRaw<T[]>(path, { query });
  return { rows: r.data ?? [], nextCursor: r.meta?.nextCursor ?? null, hasMore: r.meta?.hasMore ?? false };
};

export const channelsApi = {
  list: async (q: ApiQuery = {}): Promise<ChannelsList> => {
    const r = await apiRaw<Channel[]>('/channels', { query: q });
    return { rows: r.data ?? [], planLimit: (r.meta as Meta & { planLimit?: PlanLimit })?.planLimit ?? null };
  },
  get: (id: string) => api<Channel>(`/channels/${id}`),
  /** `paused` = manual pause, `active` = resume; at the plan limit the resume needs `swapWithChannelId` (403 PLAN_LIMIT otherwise). */
  setStatus: (id: string, b: { status: 'active' | 'paused'; swapWithChannelId?: string }) => api<Channel>(`/channels/${id}`, { method: 'PATCH', body: b }),
  disable: (id: string) => api<Channel>(`/channels/${id}/disable`, { method: 'POST', body: {} }),
  enable: (id: string, b: { swapWithChannelId?: string } = {}) => api<Channel>(`/channels/${id}/enable`, { method: 'POST', body: b }),
  disconnect: (id: string) => api<null>(`/channels/${id}`, { method: 'DELETE' }),
  connect: (platform: Platform) => api<ConnectStart>(`/channels/connect/${platform}`),
  reconnect: (id: string) => api<ConnectStart>(`/channels/${id}/reconnect`, { method: 'POST', body: {} }),
  /** report of a finished connect, read by the same-tab return route (kept 10 min by the API) */
  connectReport: (id: string) => api<ConnectReport>(`/channels/connect/reports/${encodeURIComponent(id)}`),
  syncInfo: (id: string) => api<Channel>(`/channels/${id}/sync-info`, { method: 'POST', body: {} }),
  appReviewStatus: () => api<AppReviewStatus>('/channels/app-review-status'),
  approvalStatus: (id: string) => api<ApprovalStatus>(`/channels/${id}/approval-status`),
  insights: (id: string) => api<ChannelInsights>(`/channels/${id}/insights`),
  summary: (id: string) => api<ChannelSummary>(`/channels/${id}/summary`),
  events: (id: string, q: ApiQuery) => cursorPage<ChannelEvent>(`/channels/${id}/events`, q),
  sync: (id: string, days: SyncDays) => api<JobRef>(`/channels/${id}/sync`, { method: 'POST', body: { days } }),
  /** conversations of one page (the inbox list filtered on the channel) */
  conversations: (id: string, q: ApiQuery = {}) => cursorPage<ConversationListItem>('/conversations', { channelIds: [id], limit: 25, ...q }),
};

/* ---------- cache keys: every key starts with the workspace id ---------- */
export const channelKeys = {
  all: (ws: string) => [ws, 'channels'] as const,
  list: (ws: string, q?: ApiQuery) => (q ? ([ws, 'channels', 'list', q] as const) : ([ws, 'channels', 'list'] as const)),
  appReview: (ws: string) => [ws, 'channels', 'app-review'] as const,
  one: (ws: string, id: string) => [ws, 'channel', id] as const,
  insights: (ws: string, id: string) => [ws, 'channel', id, 'insights'] as const,
  summary: (ws: string, id: string) => [ws, 'channel', id, 'summary'] as const,
  events: (ws: string, id: string, q?: ApiQuery) => (q ? ([ws, 'channel', id, 'events', q] as const) : ([ws, 'channel', id, 'events'] as const)),
  conversations: (ws: string, id: string) => [ws, 'channel', id, 'conversations'] as const,
};

const NO_FILTER: ApiQuery = {};
/** The whole list (a workspace has a handful of pages): platform tabs and counts are derived on the client. */
export const useChannels = (enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: channelKeys.list(ws, NO_FILTER), queryFn: () => channelsApi.list(), enabled: !!ws && enabled, placeholderData: keepPreviousData });
};
export const useChannel = (id: string | null | undefined) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: channelKeys.one(ws, id ?? ''), queryFn: () => channelsApi.get(id!), enabled: !!ws && !!id });
};
export const useAppReviewStatus = (enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: channelKeys.appReview(ws), queryFn: channelsApi.appReviewStatus, enabled: !!ws && enabled, staleTime: 5 * 60_000, retry: false });
};
export const useChannelInsights = (id: string) => {
  const ws = useWorkspaceId();
  // 422 INBOX_INSIGHTS_UNAVAILABLE is a state of the card, not an error to retry
  return useQuery({ queryKey: channelKeys.insights(ws, id), queryFn: () => channelsApi.insights(id), enabled: !!ws && !!id, retry: false, staleTime: 5 * 60_000 });
};
export const useChannelSummary = (id: string) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: channelKeys.summary(ws, id), queryFn: () => channelsApi.summary(id), enabled: !!ws && !!id });
};
export const useChannelEventsList = (id: string, q: ApiQuery) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: channelKeys.events(ws, id, q), queryFn: () => channelsApi.events(id, q), enabled: !!ws && !!id, placeholderData: keepPreviousData });
};
export const useChannelConversations = (id: string) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: channelKeys.conversations(ws, id), queryFn: () => channelsApi.conversations(id), enabled: !!ws && !!id });
};

/** Invalidation after a channel write: the list (cards, counts, plan limit), one page when given, the workspace usage. */
export function useChannelsRefresh() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  return useCallback(
    (id?: string) => {
      const jobs = [qc.invalidateQueries({ queryKey: channelKeys.all(ws) }), qc.invalidateQueries({ queryKey: [ws, 'workspace'] }), qc.invalidateQueries({ queryKey: [ws, 'onboarding'] })];
      if (id) jobs.push(qc.invalidateQueries({ queryKey: channelKeys.one(ws, id) }));
      return Promise.all(jobs);
    },
    [ws, qc],
  );
}

export const isInsightsUnavailable = (e: unknown) => e instanceof ApiError && e.code === 'INBOX_INSIGHTS_UNAVAILABLE';
