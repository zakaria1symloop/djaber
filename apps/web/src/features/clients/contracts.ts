// Wire types of the M5 clients endpoints = the shared read models of `packages/shared/src/schemas/clients.ts`
// (api-contract §3.6, §4 `ClientsQuery`).
import type {
  BulkClientTagsInput,
  ClientAddressInput,
  ClientAddressView,
  ClientListItemView,
  ClientMergePreview,
  ClientMetricsView,
  ClientPill,
  ClientQuality,
  ClientRiskInput,
  ClientView,
  CreateClientInput,
  MergeClientsInput,
  UpdateClientInput,
} from '@djaber/shared';
import type { ConversationListItemView } from '@djaber/shared';

export type ClientListItem = ClientListItemView;
export type Client = ClientView;
export type ClientAddress = ClientAddressView;
export type ClientMetrics = ClientMetricsView;
export type ClientConversation = ConversationListItemView;
export type { BulkClientTagsInput, ClientAddressInput, ClientMergePreview, ClientPill, ClientQuality, ClientRiskInput, CreateClientInput, MergeClientsInput, UpdateClientInput };

/* ---------- local copies of the shared constants (same values) ---------- */
export const CLIENT_SORTS = ['lastOrderAt', 'name', 'totalSpent', 'createdAt'] as const;
export const CLIENT_QUALITY_FILTERS = ['placeholder', 'no_phone', 'no_address', 'duplicates'] as const;
export const CLIENT_LAST_ORDER_FILTERS = ['lt30', '30_90', 'gt90', 'never'] as const;
export const CLIENT_TAGS_MAX = 20;
export const CLIENT_TAG_MAX_CHARS = 40;
