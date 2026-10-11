// Trust & safety, merchant side (06 §8.3, api-contract §3.11): blocked customers, reports, automatic rules, blocked words.
import type { BlockConversationInput, CreateBlockInput, CreateReportInput, CustomerBlockView, SafetyRules } from '@djaber/shared';
import { api, apiRaw } from '@/lib/api';

export type BlocksPage = { rows: CustomerBlockView[]; total: number; page: number; pageSize: number };
export type BlocksQuery = { q?: string; source?: string; page?: number };
/** `GET /safety/blocked-words` → the workspace list (the platform list is never sent to the merchant). */
export type BlockedWords = { words: string[] };
const readWords = (data: unknown): BlockedWords => ({ words: Array.isArray(data) ? (data as string[]) : Array.isArray((data as BlockedWords | null)?.words) ? (data as BlockedWords).words : [] });

export const safetyApi = {
  blocks: async (q: BlocksQuery): Promise<BlocksPage> => {
    const r = await apiRaw<CustomerBlockView[]>('/safety/blocks', { query: { q: q.q && q.q.trim().length >= 2 ? q.q.trim() : undefined, source: q.source, page: q.page ?? 1, pageSize: 25 } });
    const rows = r.data ?? [];
    return { rows, total: r.meta?.total ?? rows.length, page: r.meta?.page ?? 1, pageSize: r.meta?.pageSize ?? 25 };
  },
  createBlock: (b: CreateBlockInput) => api<CustomerBlockView>('/safety/blocks', { method: 'POST', body: b }),
  unblock: (id: string) => api<null>(`/safety/blocks/${id}`, { method: 'DELETE' }),
  blockConversation: (conversationId: string, b: BlockConversationInput) => api<unknown>(`/conversations/${conversationId}/block`, { method: 'POST', body: b }),
  report: (b: CreateReportInput) => api<{ id: string; status: string }>('/safety/reports', { method: 'POST', body: b }),
  rules: () => api<SafetyRules>('/safety/rules'),
  saveRules: (b: SafetyRules) => api<SafetyRules>('/safety/rules', { method: 'PUT', body: b }),
  blockedWords: async () => readWords(await api<unknown>('/safety/blocked-words')),
  saveBlockedWords: async (words: string[]) => readWords(await api<unknown>('/safety/blocked-words', { method: 'PUT', body: { words } })),
};

export const safetyKeys = {
  all: (ws: string) => [ws, 'safety'] as const,
  blocks: (ws: string, q?: BlocksQuery) => (q ? ([ws, 'safety', 'blocks', q] as const) : ([ws, 'safety', 'blocks'] as const)),
  rules: (ws: string) => [ws, 'safety', 'rules'] as const,
  words: (ws: string) => [ws, 'safety', 'blocked-words'] as const,
};
