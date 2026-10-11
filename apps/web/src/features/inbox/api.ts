// Inbox calls (06 §2 "Conversations", §8.3, §8.8) + TanStack Query hooks, cache keys and the WS → cache bridge.
// Cursor lists: `{ data, meta: { nextCursor, hasMore } }` (api-contract §1.4), 50 rows per page.
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, apiRaw } from '@/lib/api';
import type { UploadDto } from '@/lib/contracts';
import { useSession, useWorkspaceId } from '@/lib/session';
import { uploadWithProgress } from '@/lib/upload';
import { useWsEvent } from '@/lib/ws';
import type {
  BlockReason,
  Conversation,
  ConversationCounts,
  ConversationListItem,
  ConversationPatch,
  CreateReportBody,
  InboxBulkAction,
  Message,
  Note,
  SendMessageBody,
  WsConversationDeleted,
  WsConversationUpdated,
  WsMessageCreated,
  WsMessageUpdated,
} from './contracts';
import { applyMessageUpdate, isOptimistic, mergeIncoming, patchConversation, previewOf, type InboxApiQuery } from './logic';

export type CursorPage<T> = { rows: T[]; nextCursor: string | null; hasMore: boolean };
const cursorPage = async <T>(path: string, query: InboxApiQuery): Promise<CursorPage<T>> => {
  const r = await apiRaw<T[]>(path, { query });
  return { rows: r.data ?? [], nextCursor: r.meta?.nextCursor ?? null, hasMore: r.meta?.hasMore ?? !!r.meta?.nextCursor };
};
export const PAGE = 50;

export type BulkItem = { id: string; ok: boolean; error?: { code: string; message: string } };
export type BulkOutcome = { results: BulkItem[]; ok: number; failed: number };

export type ConversationPatchBody = { status?: Conversation['status']; aiPaused?: boolean; assigneeId?: string | null; version: number };

export const inboxApi = {
  conversations: (q: InboxApiQuery, cursor?: string | null) => cursorPage<ConversationListItem>('/conversations', { ...q, cursor: cursor ?? undefined }),
  counts: (channelId?: string | null) => api<ConversationCounts>('/conversations/counts', { query: { channelId: channelId ?? undefined } }),
  conversation: (id: string) => api<Conversation>(`/conversations/${id}`),
  /** versioned PATCH: `409 CONFLICT` carries `details.current` (api-contract §1.8) */
  patch: (id: string, b: ConversationPatchBody) => api<Conversation>(`/conversations/${id}`, { method: 'PATCH', body: b }),
  messages: (id: string, cursor?: string | null) => cursorPage<Message>(`/conversations/${id}/messages`, { cursor: cursor ?? undefined, limit: PAGE }),
  /** Idempotency-Key required (api-contract §1.7): the key of the optimistic bubble, reused by "Réessayer". */
  send: (id: string, b: SendMessageBody, key: string) => api<Message>(`/conversations/${id}/messages`, { method: 'POST', body: b, idempotent: key }),
  read: (id: string) => api<unknown>(`/conversations/${id}/read`, { method: 'POST', body: {} }),
  unread: (id: string) => api<unknown>(`/conversations/${id}/unread`, { method: 'POST', body: {} }),
  notes: (id: string) => api<Note[]>(`/conversations/${id}/notes`),
  addNote: (id: string, body: string) => api<Note>(`/conversations/${id}/notes`, { method: 'POST', body: { body } }),
  remove: (id: string) => api<null>(`/conversations/${id}`, { method: 'DELETE' }),
  restore: (id: string) => api<Conversation>(`/conversations/${id}/restore`, { method: 'POST', body: {} }),
  block: (id: string, b: { reason?: BlockReason; note?: string }) => api<unknown>(`/conversations/${id}/block`, { method: 'POST', body: b }),
  unblock: (id: string) => api<unknown>(`/conversations/${id}/unblock`, { method: 'POST', body: {} }),
  report: (b: CreateReportBody) => api<{ id: string; status: string }>('/safety/reports', { method: 'POST', body: b }),
  /** `POST /conversations/bulk/{resolve|archive|assign|resume-ai|block}` → one result per conversation (06 §8.8) */
  bulk: async (action: InboxBulkAction, body: { ids: string[]; assigneeId?: string | null }): Promise<BulkOutcome> => {
    const r = await apiRaw<{ results: BulkItem[] }>(`/conversations/bulk/${action}`, { method: 'POST', body });
    const results = r.data?.results ?? [];
    const m = r.meta as { ok?: number; failed?: number };
    return { results, ok: m?.ok ?? results.filter((x) => x.ok).length, failed: m?.failed ?? results.filter((x) => !x.ok).length };
  },
  /** shortcut of `POST /safety/reports { type: ai_message }` (06 §8.8) */
  reportMessage: (messageId: string, b: { details?: string }) => api<{ id: string; status: string }>(`/messages/${messageId}/report`, { method: 'POST', body: b }),
  /** one image ≤ 5 MB attached to a reply (`POST /uploads { kind: reply }`) */
  upload: (file: File, o: { onProgress?: (pct: number) => void; signal?: AbortSignal } = {}) => {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('kind', 'reply');
    return uploadWithProgress<UploadDto>('/uploads', formData, o).then((r) => r.data);
  },
};

/* ---------- cache keys: every key starts with the workspace id ---------- */
export const inboxKeys = {
  all: (ws: string) => [ws, 'conversations'] as const,
  lists: (ws: string) => [ws, 'conversations', 'list'] as const,
  list: (ws: string, q: InboxApiQuery) => [ws, 'conversations', 'list', q] as const,
  counts: (ws: string, channelId?: string | null) => [ws, 'conversations', 'counts', channelId ?? 'all'] as const,
  countsAll: (ws: string) => [ws, 'conversations', 'counts'] as const,
  detail: (ws: string, id: string) => [ws, 'conversation', id] as const,
  messages: (ws: string, id: string) => [ws, 'conversation', id, 'messages'] as const,
  notes: (ws: string, id: string) => [ws, 'conversation', id, 'notes'] as const,
};

type ListData = InfiniteData<CursorPage<ConversationListItem>, string | null>;
export type MessagesData = InfiniteData<CursorPage<Message>, string | null>;

/* ---------- hooks ---------- */
export const useConversations = (q: InboxApiQuery, enabled = true) => {
  const ws = useWorkspaceId();
  return useInfiniteQuery({
    queryKey: inboxKeys.list(ws, q),
    queryFn: ({ pageParam }) => inboxApi.conversations(q, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    enabled: !!ws && enabled,
  });
};
export const useConversationCounts = (channelId?: string | null, enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: inboxKeys.counts(ws, channelId), queryFn: () => inboxApi.counts(channelId), enabled: !!ws && enabled });
};
export const useConversation = (id: string | null | undefined) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: inboxKeys.detail(ws, id ?? ''), queryFn: () => inboxApi.conversation(id!), enabled: !!ws && !!id });
};
/** Thread pages: the first page holds the newest messages, `fetchNextPage` loads older ones (scroll up). */
export const useMessages = (id: string | null | undefined) => {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const key = inboxKeys.messages(ws, id ?? '');
  return useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam }) => {
      const page = await inboxApi.messages(id!, pageParam);
      if (pageParam !== null) return page;
      // a refetch (reconnect, focus) must not drop the replies still being sent from this tab
      const sending = (qc.getQueryData<MessagesData>(key)?.pages.flatMap((p) => p.rows) ?? []).filter(isOptimistic);
      return sending.length ? { ...page, rows: [...page.rows, ...sending] } : page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    enabled: !!ws && !!id,
  });
};
export const useNotes = (id: string | null | undefined, enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: inboxKeys.notes(ws, id ?? ''), queryFn: () => inboxApi.notes(id!), enabled: !!ws && !!id && enabled });
};

/* ---------- cache writers (shared by the screen and the WS bridge) ---------- */
/** Rewrites the cached messages of a thread (all loaded pages are treated as one list; new rows go to the newest page). */
export const writeMessages = (qc: QueryClient, ws: string, id: string, fn: (list: Message[]) => Message[]) => {
  qc.setQueryData<MessagesData>(inboxKeys.messages(ws, id), (old) => {
    if (!old) return old;
    const before = old.pages.flatMap((p) => p.rows);
    const after = fn(before);
    if (after === before) return old;
    const known = new Set(before.map((m) => m.id));
    const byId = new Map(after.map((m) => [m.id, m]));
    const added = after.filter((m) => !known.has(m.id));
    const pages = old.pages.map((p, i) => {
      const rows = p.rows.filter((m) => byId.has(m.id)).map((m) => byId.get(m.id)!);
      return { ...p, rows: i === 0 ? [...rows, ...added] : rows };
    });
    return { ...old, pages };
  });
};

const patchLists = (qc: QueryClient, ws: string, fn: (row: ConversationListItem) => ConversationListItem | null) => {
  qc.setQueriesData<ListData>({ queryKey: inboxKeys.lists(ws) }, (old) =>
    old ? { ...old, pages: old.pages.map((p) => ({ ...p, rows: p.rows.map(fn).filter((r): r is ConversationListItem => r !== null) })) } : old,
  );
};

/** Applies a partial change to the cached detail and to every cached list row of a conversation. */
export const writeConversation = (qc: QueryClient, ws: string, p: ConversationPatch | Conversation) => {
  qc.setQueryData<Conversation>(inboxKeys.detail(ws, p.id), (old) => (old ? ('channel' in p ? { ...old, ...p } : patchConversation(old, p)) : old));
  patchLists(qc, ws, (row) => (row.id !== p.id ? row : 'channel' in p ? { ...row, ...p } : patchConversation(row, p)));
};

/** Invalidation after an inbox write: lists and counters (and one conversation when given). */
export function useInboxRefresh() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  return useCallback(
    (o: { id?: string; messages?: boolean } = {}) => {
      const jobs = [qc.invalidateQueries({ queryKey: inboxKeys.lists(ws) }), qc.invalidateQueries({ queryKey: inboxKeys.countsAll(ws) })];
      if (o.id) jobs.push(qc.invalidateQueries({ queryKey: inboxKeys.detail(ws, o.id), exact: true }));
      if (o.id && o.messages) jobs.push(qc.invalidateQueries({ queryKey: inboxKeys.messages(ws, o.id) }));
      return Promise.all(jobs);
    },
    [ws, qc],
  );
}

/**
 * WS → cache (03-events §2), mounted once in the shell so that the sidebar badge and an open thread stay live on
 * every page: `message.created` / `message.updated` patch the thread, `conversation.updated` patches rows and the
 * detail, `conversation.deleted` removes the row. Tab membership, order and counters are derived by the server:
 * the visible lists and the counts are refetched after each event.
 */
export function useInboxEvents() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const { me } = useSession();
  const meId = me?.id ?? null;

  const refreshDerived = () => {
    void qc.invalidateQueries({ queryKey: inboxKeys.lists(ws) });
    void qc.invalidateQueries({ queryKey: inboxKeys.countsAll(ws) });
  };

  useWsEvent<WsMessageCreated>('message.created', (p) => {
    const m = p?.message;
    if (!p?.conversationId || !m?.id) return;
    writeMessages(qc, ws, p.conversationId, (list) => mergeIncoming(list, m, meId));
    const patch: ConversationPatch = { ...p.conversation, id: p.conversationId };
    if (patch.lastMessageAt === undefined) patch.lastMessageAt = m.sentAt;
    if (patch.lastMessagePreview === undefined) patch.lastMessagePreview = previewOf(m);
    writeConversation(qc, ws, patch);
    patchLists(qc, ws, (row) => (row.id === p.conversationId ? { ...row, lastMessageDirection: m.direction } : row));
    if (m.direction === 'in') {
      // the 24 h window restarts with every customer message
      qc.setQueryData<Conversation>(inboxKeys.detail(ws, p.conversationId), (old) => (old ? { ...old, within24h: true, lastCustomerMessageAt: m.sentAt, lastMessageDirection: 'in' } : old));
    }
    refreshDerived();
  });

  useWsEvent<WsMessageUpdated>('message.updated', (p) => {
    if (!p?.conversationId || !p.messageId) return;
    writeMessages(qc, ws, p.conversationId, (list) => applyMessageUpdate(list, p));
  });

  useWsEvent<WsConversationUpdated>('conversation.updated', (p) => {
    const c = p?.conversation;
    if (!c?.id) return;
    const known = qc.getQueryData<Conversation>(inboxKeys.detail(ws, c.id));
    writeConversation(qc, ws, c);
    // the event carries ids only: the assignee, the client and the banner fields are read again
    if (known && (c.assigneeId !== undefined || c.clientId !== undefined || c.blocked !== undefined || c.aiPaused !== undefined || c.status !== undefined)) {
      void qc.invalidateQueries({ queryKey: inboxKeys.detail(ws, c.id), exact: true });
    }
    refreshDerived();
  });

  useWsEvent<WsConversationDeleted>('conversation.deleted', (p) => {
    if (!p?.id) return;
    patchLists(qc, ws, (row) => (row.id === p.id ? null : row));
    qc.setQueryData<Conversation>(inboxKeys.detail(ws, p.id), (old) => (old ? { ...old, deletedAt: old.deletedAt ?? new Date().toISOString() } : old));
    refreshDerived();
  });

  // the composer and the banners of a thread depend on the status of its page (needs_reconnect, paused…)
  useWsEvent<{ channel?: { id: string } }>('channel.updated', (p) => {
    if (!p?.channel?.id) return;
    void qc.invalidateQueries({ queryKey: [ws, 'conversation'] });
    void qc.invalidateQueries({ queryKey: inboxKeys.lists(ws) });
  });

  // reconnect: the server answers `resync { conversations }` with the rows changed while the socket was down
  useWsEvent<{ conversations?: ConversationPatch[] }>('resync', (p) => {
    for (const c of p?.conversations ?? []) if (c?.id) writeConversation(qc, ws, c);
    void qc.invalidateQueries({ queryKey: [ws, 'conversation'] });
    refreshDerived();
  });
}

/** Sidebar badge "Boîte de réception": unread conversations of the workspace (server count). */
export function useInboxBadge(): number {
  const { can } = useSession();
  const q = useConversationCounts(null, can('inbox.read'));
  return q.data?.unread ?? 0;
}
