'use client';
// ADM-10 data layer (02-next-route-map `/admin/moderation`, api-contract §3.13 + §4 AdminModerationQuery, contract-b):
// queue, item detail, decisions (single + bulk), assignment, appeals, rules, KPIs, sample. Query keys start with
// `'admin'` (web-a `adminKey`); every write invalidates the moderation queries (WS `moderation.queue` does too).
import type {
  AppealDecideInput,
  AssignInput,
  BulkItemResult,
  ModerationAppealDto,
  ModerationBulkInput,
  ModerationDecisionInput,
  ModerationItemDetailDto,
  ModerationItemDto,
  ModerationRuleDto,
  ModerationRuleInput,
  ModerationStatsDto,
  PlatformTeamDto,
} from '@djaber/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminKey, adminList, adminWrite, useAdminInvalidate } from '@/features/admin/api';
import { api } from '@/lib/api';
import type { ApiQuery } from '@/lib/list-state';
import { useWsEvent } from '@/lib/ws';

export const MOD_PATH = '/admin/moderation';
export type DecisionKind = 'approve' | 'reject' | 'request-changes';
export type BulkKind = 'approve' | 'reject' | 'assign';
/** A platform member who can be assigned (moderators and super admins of `GET /admin/platform-members`). */
export type Assignee = { id: string; name: string; role: string };
/** `GET /admin/moderation/categories` row (contract-b answer 6). */
export type ModerationCategoryFacet = { id: string; name: string; workspaceName: string; pending: number };

export const modApi = {
  items: (q: ApiQuery) => adminList<ModerationItemDto>(`${MOD_PATH}/items`, q),
  sample: (q: ApiQuery) => adminList<ModerationItemDto>(`${MOD_PATH}/sample`, q),
  item: (id: string) => api<ModerationItemDetailDto>(`${MOD_PATH}/items/${id}`),
  decide: (id: string, kind: DecisionKind, body: ModerationDecisionInput) => adminWrite<ModerationItemDto>(`${MOD_PATH}/items/${id}/${kind}`, 'POST', body),
  /** bulk envelope `{ data: { results }, meta: { ok, failed } }` — one result per item, never all or nothing */
  bulk: async (kind: BulkKind, body: ModerationBulkInput): Promise<BulkItemResult[]> => (await adminWrite<{ results: BulkItemResult[] }>(`${MOD_PATH}/items/bulk/${kind}`, 'POST', body)).results ?? [],
  assign: (id: string, body: AssignInput) => adminWrite<ModerationItemDto>(`${MOD_PATH}/items/${id}/assign`, 'POST', body),
  appeals: (q: ApiQuery) => adminList<ModerationAppealDto>(`${MOD_PATH}/appeals`, q),
  decideAppeal: (id: string, body: AppealDecideInput) => adminWrite<ModerationAppealDto>(`${MOD_PATH}/appeals/${id}/decide`, 'POST', body),
  /** categories present in the pending queue (facet of the "Catégorie ⌄" filter) */
  categories: () => api<ModerationCategoryFacet[]>(`${MOD_PATH}/categories`),
  stats: (period = '7d') => api<ModerationStatsDto>(`${MOD_PATH}/stats`, { query: { period } }),
  rules: (q: ApiQuery = {}) => api<ModerationRuleDto[]>(`${MOD_PATH}/rules`, { query: q }),
  createRule: (body: ModerationRuleInput) => adminWrite<ModerationRuleDto>(`${MOD_PATH}/rules`, 'POST', body, true),
  patchRule: (id: string, body: Partial<ModerationRuleInput>) => adminWrite<ModerationRuleDto>(`${MOD_PATH}/rules/${id}`, 'PATCH', body),
  deleteRule: (id: string) => adminWrite<null>(`${MOD_PATH}/rules/${id}`, 'DELETE'),
  /** `GET /admin/platform-members` → `PlatformTeamDto { members, invitations }` (contract-a) */
  members: async (): Promise<Assignee[]> => toAssignees(await api<PlatformTeamDto>('/admin/platform-members')),
};

type MemberLike = { id?: string; userId?: string; user?: { id?: string; firstName?: string; lastName?: string }; firstName?: string; lastName?: string; name?: string; platformRole?: string; role?: string };
/** Tolerant reader of the platform members list (contract-a owns its shape): keeps the roles that may decide. */
export function toAssignees(raw: unknown): Assignee[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { members?: unknown[] }).members) ? (raw as { members: unknown[] }).members : [];
  const out: Assignee[] = [];
  for (const r of list as MemberLike[]) {
    const id = r.userId ?? r.user?.id ?? r.id;
    const role = r.platformRole ?? r.role ?? '';
    if (!id || (role !== 'moderator' && role !== 'super_admin')) continue;
    const name = r.name ?? `${r.firstName ?? r.user?.firstName ?? ''} ${r.lastName ?? r.user?.lastName ?? ''}`.trim();
    out.push({ id, name: name || id.slice(0, 8), role });
  }
  return out;
}

export const useModerationItems = (q: ApiQuery, enabled = true) =>
  useQuery({ queryKey: adminKey(`${MOD_PATH}/items`, q), queryFn: () => modApi.items(q), placeholderData: keepPreviousData, enabled });
export const useModerationSample = (q: ApiQuery, enabled = true) =>
  useQuery({ queryKey: adminKey(`${MOD_PATH}/sample`, q), queryFn: () => modApi.sample(q), placeholderData: keepPreviousData, enabled });
export const useModerationItem = (id: string | null) =>
  useQuery({ queryKey: adminKey(`${MOD_PATH}/items/${id}`), queryFn: () => modApi.item(id!), enabled: !!id, retry: (n, e) => n < 2 && !((e as { status?: number }).status === 404) });
export const useAppeals = (q: ApiQuery, enabled = true) =>
  useQuery({ queryKey: adminKey(`${MOD_PATH}/appeals`, q), queryFn: () => modApi.appeals(q), placeholderData: keepPreviousData, enabled });
export const useModerationStats = () => useQuery({ queryKey: adminKey(`${MOD_PATH}/stats`), queryFn: () => modApi.stats('7d'), staleTime: 15_000 });
export const useModerationCategories = () => useQuery({ queryKey: adminKey(`${MOD_PATH}/categories`), queryFn: modApi.categories, staleTime: 30_000 });
export const useModerationRules = (enabled = true) => useQuery({ queryKey: adminKey(`${MOD_PATH}/rules`), queryFn: () => modApi.rules(), enabled });
export const useAssignees = (enabled = true) => useQuery({ queryKey: adminKey('/admin/platform-members', 'assignees'), queryFn: modApi.members, enabled, staleTime: 60_000, retry: false });

/** Refetches every moderation query (queue, detail, appeals, stats). */
export function useModerationRefresh() {
  const invalidate = useAdminInvalidate();
  return () => invalidate(MOD_PATH);
}

/** Live queue: the admin room pushes `moderation.queue { pending, urgent }` and `moderation.updated` on every change. */
export function useModerationEvents() {
  const refresh = useModerationRefresh();
  useWsEvent('moderation.queue', () => void refresh());
  useWsEvent('moderation.updated', () => void refresh());
}
