// Settings › Intégrations calls (contract-ready M11 §1, 02-next-route-map `/settings/integrations/[tab]`) + TanStack
// Query hooks and cache keys. Permission `integrations.manage` (Owner + Admin); every key starts with the workspace id.
import type {
  ApiKeyCreatedDto,
  ApiKeyDto,
  ApiKeysOverviewDto,
  CreateApiKeyInput,
  CreateWebhookInput,
  PutSheetsInput,
  SheetsBackfillInput,
  SheetsIntegrationDto,
  SheetsPickerTokenDto,
  SheetsStatusDto,
  UpdateWebhookInput,
  WebhookCreatedDto,
  WebhookDeliveryDto,
  WebhookEndpointDto,
  WebhooksOverviewDto,
} from '@djaber/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, apiRaw } from '@/lib/api';
import type { ApiQuery } from '@/lib/list-state';
import { useWorkspaceId } from '@/lib/session';

export type DeliveriesPage = { rows: WebhookDeliveryDto[]; total: number; page: number; pageSize: number };

export const integrationsApi = {
  // Google Sheets (GSH-01…08)
  sheets: () => api<SheetsIntegrationDto>('/integrations/google-sheets'),
  sheetsStatus: () => api<SheetsStatusDto>('/integrations/google-sheets/status'),
  sheetsConnect: (returnTo: string) => api<{ url: string }>('/integrations/google-sheets/connect', { query: { returnTo } }),
  sheetsPicker: () => api<SheetsPickerTokenDto>('/integrations/google-sheets/picker-token', { method: 'POST', body: {} }),
  sheetsPut: (b: Partial<PutSheetsInput>) => api<SheetsIntegrationDto>('/integrations/google-sheets', { method: 'PUT', body: b }),
  sheetsBackfill: (b: SheetsBackfillInput, key: string) => api<{ jobId: string }>('/integrations/google-sheets/backfill', { method: 'POST', body: b, idempotent: key }),
  sheetsDisconnect: () => api<SheetsIntegrationDto>('/integrations/google-sheets', { method: 'DELETE' }),
  // API keys (API-01 / API-02)
  apiKeys: () => api<ApiKeysOverviewDto>('/api-keys'),
  createApiKey: (b: CreateApiKeyInput) => api<ApiKeyCreatedDto>('/api-keys', { method: 'POST', body: b }),
  revokeApiKey: (id: string) => api<ApiKeyDto>(`/api-keys/${id}/revoke`, { method: 'POST', body: {} }),
  // Outbound webhooks (API-03)
  webhooks: () => api<WebhooksOverviewDto>('/webhooks'),
  createWebhook: (b: CreateWebhookInput) => api<WebhookCreatedDto>('/webhooks', { method: 'POST', body: b }),
  updateWebhook: (id: string, b: UpdateWebhookInput) => api<WebhookEndpointDto>(`/webhooks/${id}`, { method: 'PATCH', body: b }),
  deleteWebhook: (id: string) => api<null>(`/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id: string, key: string) => api<WebhookDeliveryDto>(`/webhooks/${id}/test`, { method: 'POST', body: {}, idempotent: key }),
  enableWebhook: (id: string) => api<WebhookEndpointDto>(`/webhooks/${id}/enable`, { method: 'POST', body: {} }),
  rotateWebhookSecret: (id: string) => api<WebhookCreatedDto>(`/webhooks/${id}/rotate-secret`, { method: 'POST', body: {} }),
  deliveries: async (q: ApiQuery): Promise<DeliveriesPage> => {
    const r = await apiRaw<WebhookDeliveryDto[]>('/webhooks/deliveries', { query: q });
    const rows = Array.isArray(r.data) ? r.data : [];
    return { rows, total: r.meta?.total ?? rows.length, page: r.meta?.page ?? 1, pageSize: r.meta?.pageSize ?? 25 };
  },
  replayDelivery: (id: string, key: string) => api<WebhookDeliveryDto>(`/webhooks/deliveries/${id}/replay`, { method: 'POST', body: {}, idempotent: key }),
};

export const integrationKeys = {
  all: (ws: string) => [ws, 'integrations'] as const,
  sheets: (ws: string) => [ws, 'integrations', 'sheets'] as const,
  sheetsStatus: (ws: string) => [ws, 'integrations', 'sheets', 'status'] as const,
  apiKeys: (ws: string) => [ws, 'integrations', 'api-keys'] as const,
  webhooks: (ws: string) => [ws, 'integrations', 'webhooks'] as const,
  deliveries: (ws: string, q?: ApiQuery) => (q ? ([ws, 'integrations', 'deliveries', q] as const) : ([ws, 'integrations', 'deliveries'] as const)),
};

export const useSheets = () => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: integrationKeys.sheets(ws), queryFn: integrationsApi.sheets, enabled: !!ws });
};

/** Light poll of the sync health (GSH-07) while a sheet is chosen. */
export const useSheetsStatus = (enabled: boolean) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: integrationKeys.sheetsStatus(ws), queryFn: integrationsApi.sheetsStatus, enabled: !!ws && enabled, refetchInterval: 15_000 });
};

export const useApiKeys = () => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: integrationKeys.apiKeys(ws), queryFn: integrationsApi.apiKeys, enabled: !!ws });
};

export const useWebhooks = () => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: integrationKeys.webhooks(ws), queryFn: integrationsApi.webhooks, enabled: !!ws });
};

/** Journal of every endpoint; refreshed every 10 s while a delivery is pending (worker retries). */
export const useDeliveries = (q: ApiQuery, enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: integrationKeys.deliveries(ws, q),
    queryFn: () => integrationsApi.deliveries(q),
    enabled: !!ws && enabled,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.rows.some((r) => r.status === 'pending') ? 5_000 : 30_000),
  });
};
