'use client';
// Platform admin — support (ADM-12), platform settings (ADM-13), jobs & health (ADM-14): calls of
// `.local`-contract-b / api-contract §3.13 + 02-next-route-map §3.5, TanStack Query hooks and cache keys.
// Admin routes are not workspace scoped (no X-Workspace-Id): keys start with `ADMIN_KEY`.
import type {
  AdminSettingsDto,
  AdminTicketDto,
  AdminTicketMessageInput,
  AdminCreateTicketInput,
  AppVersionDto,
  AppVersionUpdateInput,
  CannedReplyDto,
  CannedReplyInput,
  FailedJobDto,
  FeatureFlagCreateInput,
  FeatureFlagDto,
  FeatureFlagEvaluationDto,
  HealthDto,
  IncidentBannerDto,
  IncidentBannerInput,
  IncidentCreateInput,
  IncidentDto,
  IncidentUpdateInput,
  MaintenanceDto,
  MaintenanceInput,
  MetaAppDto,
  MetaPermissionDto,
  MetaPermissionPatchInput,
  PlatformProviderDto,
  PlatformSettingDto,
  PlatformSettingVersionDto,
  ProviderKey,
  ProviderTestResultDto,
  ProviderUpdateInput,
  SettingKey,
  SupportStatsDto,
} from '@djaber/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminList } from '@/features/admin/api';
import { ADMIN_KEY } from '@/features/admin/platform';
import { api, apiRaw, type Meta } from '@/lib/api';
import type { ApiQuery } from '@/lib/list-state';

export type Page<T> = { rows: T[]; meta: Meta };
const page = async <T>(path: string, query?: ApiQuery): Promise<Page<T>> => {
  const r = await apiRaw<T[]>(path, { query });
  return { rows: r.data, meta: r.meta };
};
const enc = encodeURIComponent;

export const opsApi = {
  /* ---------- ADM-12 support ---------- */
  tickets: (q: ApiQuery) => adminList<AdminTicketDto>('/admin/support/tickets', q),
  ticket: (id: string) => api<AdminTicketDto>(`/admin/support/tickets/${enc(id)}`),
  createTicket: (b: AdminCreateTicketInput) => api<AdminTicketDto>('/admin/support/tickets', { method: 'POST', body: b }),
  reply: (id: string, b: AdminTicketMessageInput) => api<AdminTicketDto>(`/admin/support/tickets/${enc(id)}/messages`, { method: 'POST', body: b }),
  assign: (id: string, assigneeId: string | null) => api<AdminTicketDto>(`/admin/support/tickets/${enc(id)}/assign`, { method: 'POST', body: { assigneeId } }),
  ticketAction: (id: string, action: 'resolve' | 'reopen' | 'wait-customer', note?: string) =>
    api<AdminTicketDto>(`/admin/support/tickets/${enc(id)}/${action}`, { method: 'POST', body: note ? { note } : {} }),
  escalate: (id: string, note: string) => api<AdminTicketDto>(`/admin/support/tickets/${enc(id)}/escalate`, { method: 'POST', body: { note } }),
  linkIncident: (id: string, incidentId: string | null) => api<AdminTicketDto>(`/admin/support/tickets/${enc(id)}/link-incident`, { method: 'POST', body: { incidentId } }),
  supportStats: (period = '30d') => api<SupportStatsDto>('/admin/support/stats', { query: { period } }),
  cannedReplies: () => api<CannedReplyDto[]>('/admin/support/canned-replies'),
  createCanned: (b: CannedReplyInput) => api<CannedReplyDto>('/admin/support/canned-replies', { method: 'POST', body: b }),
  updateCanned: (id: string, b: Partial<Omit<CannedReplyInput, 'key'>>) => api<CannedReplyDto>(`/admin/support/canned-replies/${enc(id)}`, { method: 'PATCH', body: b }),
  deleteCanned: (id: string) => api<null>(`/admin/support/canned-replies/${enc(id)}`, { method: 'DELETE' }),

  /* ---------- ADM-13 platform settings ---------- */
  settings: () => api<AdminSettingsDto>('/admin/settings'),
  putSetting: (key: SettingKey, value: unknown, reason?: string) => api<PlatformSettingDto>(`/admin/settings/${key}`, { method: 'PUT', body: { value, ...(reason ? { reason } : {}) } }),
  settingVersions: (key: SettingKey) => api<PlatformSettingVersionDto[]>(`/admin/settings/${key}/versions`),
  putAppVersion: (platform: AppVersionDto['platform'], b: AppVersionUpdateInput) => api<AppVersionDto>(`/admin/app-versions/${platform}`, { method: 'PUT', body: b }),
  createFlag: (b: FeatureFlagCreateInput) => api<FeatureFlagDto>('/admin/feature-flags', { method: 'POST', body: b }),
  patchFlag: (key: string, b: Partial<Omit<FeatureFlagCreateInput, 'key'>>) => api<FeatureFlagDto>(`/admin/feature-flags/${enc(key)}`, { method: 'PATCH', body: b }),
  deleteFlag: (key: string) => api<null>(`/admin/feature-flags/${enc(key)}`, { method: 'DELETE' }),
  evaluateFlag: (key: string, workspaceId: string, platform: 'web' | 'mobile') => api<FeatureFlagEvaluationDto>(`/admin/feature-flags/${enc(key)}/evaluate`, { query: { workspaceId, platform } }),
  patchMetaPermission: (scope: string, b: MetaPermissionPatchInput) => api<MetaPermissionDto>(`/admin/meta/permissions/${enc(scope)}`, { method: 'PATCH', body: b }),
  metaApp: () => api<MetaAppDto>('/admin/meta/app'),
  putMetaApp: (b: { appId: string; appSecret?: string }) => api<MetaAppDto>('/admin/meta/app', { method: 'PUT', body: b }),
  putProvider: (key: ProviderKey, b: ProviderUpdateInput) => api<PlatformProviderDto>(`/admin/providers/${key}`, { method: 'PUT', body: b }),
  testProvider: (key: ProviderKey) => api<ProviderTestResultDto>(`/admin/providers/${key}/test`, { method: 'POST', body: {} }),
  putMaintenance: (b: MaintenanceInput) => api<MaintenanceDto>('/admin/maintenance', { method: 'PUT', body: b }),
  putIncidentBanner: (b: IncidentBannerInput) => api<IncidentBannerDto>('/admin/incident-banner', { method: 'PUT', body: b }),

  /* ---------- ADM-14 jobs & health ---------- */
  health: () => api<HealthDto>('/admin/health'),
  queueAction: (name: string, action: 'pause' | 'resume' | 'drain-failed' | 'replay-failed' | 'run-now', cron?: string) =>
    api<unknown>(`/admin/queues/${enc(name)}/${action}`, { method: 'POST', body: cron ? { cron } : {} }),
  failedJobs: (queue: string) => api<FailedJobDto[]>(`/admin/queues/${enc(queue)}/failed`, { query: { page: 1 } }),
  failedJob: (jobId: string, queue: string) => api<FailedJobDto>(`/admin/queues/failed/${enc(jobId)}`, { query: { queue } }),
  replayJob: (jobId: string, queue: string) => api<{ jobId: string }>(`/admin/queues/failed/${enc(jobId)}/replay`, { method: 'POST', body: {}, query: { queue } }),
  incidents: (q: ApiQuery = {}) => page<IncidentDto>('/admin/incidents', q),
  createIncident: (b: IncidentCreateInput) => api<IncidentDto>('/admin/incidents', { method: 'POST', body: b }),
  incidentUpdate: (id: string, b: IncidentUpdateInput) => api<IncidentDto>(`/admin/incidents/${enc(id)}/updates`, { method: 'POST', body: b }),
  resolveIncident: (id: string, b: { postMortem?: string }) => api<IncidentDto>(`/admin/incidents/${enc(id)}/resolve`, { method: 'POST', body: b }),
};

export const opsKeys = {
  tickets: (q: ApiQuery) => [ADMIN_KEY, 'support', 'tickets', q] as const,
  ticketsRoot: [ADMIN_KEY, 'support', 'tickets'] as const,
  ticket: (id: string) => [ADMIN_KEY, 'support', 'ticket', id] as const,
  supportStats: [ADMIN_KEY, 'support', 'stats'] as const,
  canned: [ADMIN_KEY, 'support', 'canned'] as const,
  settings: [ADMIN_KEY, 'settings'] as const,
  settingVersions: (key: string) => [ADMIN_KEY, 'settings', 'versions', key] as const,
  metaApp: [ADMIN_KEY, 'settings', 'meta-app'] as const,
  health: [ADMIN_KEY, 'health'] as const,
  failed: (queue?: string) => [ADMIN_KEY, 'health', 'failed', queue ?? 'all'] as const,
  failedJob: (id: string, queue: string) => [ADMIN_KEY, 'health', 'failed-job', queue, id] as const,
  incidents: [ADMIN_KEY, 'health', 'incidents'] as const,
};

export const useTickets = (q: ApiQuery) => useQuery({ queryKey: opsKeys.tickets(q), queryFn: () => opsApi.tickets(q), placeholderData: keepPreviousData });
export const useTicket = (id: string | null) => useQuery({ queryKey: opsKeys.ticket(id ?? ''), queryFn: () => opsApi.ticket(id ?? ''), enabled: !!id });
export const useSupportStats = () => useQuery({ queryKey: opsKeys.supportStats, queryFn: () => opsApi.supportStats() });
export const useCannedReplies = (enabled = true) => useQuery({ queryKey: opsKeys.canned, queryFn: opsApi.cannedReplies, enabled });
export const useAdminSettings = () => useQuery({ queryKey: opsKeys.settings, queryFn: opsApi.settings });
export const useMetaApp = () => useQuery({ queryKey: opsKeys.metaApp, queryFn: opsApi.metaApp });
/** ADM-14 refreshes every 30 s (and on WS `health.updated` from the admin room). */
export const useHealth = () => useQuery({ queryKey: opsKeys.health, queryFn: opsApi.health, refetchInterval: 30_000 });
/** "Échecs récents (DLQ)": failed jobs of every queue that has failures (no cross-queue endpoint), newest first, 10 rows. */
export const useFailedJobs = (queues: string[]) =>
  useQuery({
    queryKey: [...opsKeys.failed(), queues.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(queues.map((q) => opsApi.failedJobs(q)));
      const at = (j: FailedJobDto) => Date.parse(j.finishedOn ?? j.timestamp) || 0;
      return lists.flat().sort((a, b) => at(b) - at(a)).slice(0, 10);
    },
    refetchInterval: 30_000,
  });
export const useIncidents = () => useQuery({ queryKey: opsKeys.incidents, queryFn: () => opsApi.incidents({ pageSize: 25 }) });
