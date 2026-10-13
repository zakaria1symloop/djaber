// Help center & support tickets, merchant side (03 §25 HELP-01…04, 02-next-route-map `/help*`, api-contract §3.11,
// `packages/shared/src/schemas/support.ts`). Guides = `CmsEntry(type=help)` in the user's locale (FR fallback).
import type { CreateTicketInput, CreateTicketResultDto, HelpArticleDto, HelpCategory, SupportTicketDto, TicketRateInput, TicketReplyInput } from '@djaber/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, apiRaw } from '@/lib/api';
import type { ApiQuery } from '@/lib/list-state';
import { useLocaleCode } from '@/lib/i18n';
import { uploadWithProgress } from '@/lib/upload';
import { useWorkspaceId } from '@/lib/session';

export type HelpArticle = HelpArticleDto;
export type Ticket = SupportTicketDto;
export type TicketPage = { rows: Ticket[]; total: number; page: number; pageSize: number };
export type UploadedFile = { id: string; name: string; size: number };

export const helpApi = {
  articles: (q: { q?: string; category?: HelpCategory; lang?: string; context?: string }) => api<HelpArticle[]>('/help/articles', { query: q }),
  article: (key: string, lang?: string) => api<HelpArticle>(`/help/articles/${encodeURIComponent(key)}`, { query: { lang } }),
  tickets: async (q: ApiQuery): Promise<TicketPage> => {
    const r = await apiRaw<Ticket[]>('/support/tickets', { query: q });
    return { rows: r.data, total: r.meta.total ?? r.data.length, page: r.meta.page ?? 1, pageSize: r.meta.pageSize ?? 25 };
  },
  ticket: (id: string) => api<Ticket>(`/support/tickets/${encodeURIComponent(id)}`),
  create: (b: CreateTicketInput) => api<CreateTicketResultDto>('/support/tickets', { method: 'POST', body: b }),
  reply: (id: string, b: TicketReplyInput) => api<Ticket>(`/support/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', body: b }),
  rate: (id: string, b: TicketRateInput) => api<Ticket>(`/support/tickets/${encodeURIComponent(id)}/rate`, { method: 'POST', body: b }),
  close: (id: string) => api<Ticket>(`/support/tickets/${encodeURIComponent(id)}/close`, { method: 'POST', body: {} }),
  /** screenshot / CSV attached to a ticket (`POST /uploads { kind: ticket_attachment }`) */
  upload: async (file: File, onProgress?: (pct: number) => void): Promise<UploadedFile> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'ticket_attachment');
    const r = await uploadWithProgress<{ id: string }>('/uploads', fd, { onProgress });
    return { id: r.data.id, name: file.name, size: file.size };
  },
};

export const helpKeys = {
  articles: (lang: string, q: object) => ['help', 'articles', lang, q] as const,
  article: (lang: string, key: string) => ['help', 'article', lang, key] as const,
  tickets: (ws: string, q: object) => [ws, 'support-tickets', q] as const,
  ticket: (ws: string, id: string) => [ws, 'support-ticket', id] as const,
};

export function useHelpArticles(q: { q?: string; category?: HelpCategory; context?: string }, o: { enabled?: boolean } = {}) {
  const lang = useLocaleCode();
  return useQuery({ queryKey: helpKeys.articles(lang, q), queryFn: () => helpApi.articles({ ...q, lang }), placeholderData: keepPreviousData, staleTime: 5 * 60_000, enabled: o.enabled ?? true });
}

export function useHelpArticle(key: string | null) {
  const lang = useLocaleCode();
  return useQuery({ queryKey: helpKeys.article(lang, key ?? ''), queryFn: () => helpApi.article(key as string, lang), enabled: !!key, staleTime: 5 * 60_000 });
}

export function useTickets(q: ApiQuery, o: { enabled?: boolean } = {}) {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: helpKeys.tickets(ws, q), queryFn: () => helpApi.tickets(q), placeholderData: keepPreviousData, enabled: (o.enabled ?? true) && !!ws });
}

export function useTicket(id: string) {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: helpKeys.ticket(ws, id), queryFn: () => helpApi.ticket(id), enabled: !!ws && !!id });
}
