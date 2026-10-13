'use client';
// Typing indicators (M11 carry-over): "IA répond…" while the AI reply job runs, "Sara écrit…" while another member
// types in the same conversation. One store fed by the WS events (mounted with the inbox events in the shell); the
// composer emits `typing { conversationId }` at most every 3 s while the member types.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/lib/session';
import { useWsEmit, useWsEvent } from '@/lib/ws';
import type { WsMessageCreated } from './contracts';
import { applyTyping, clearTyping, nextExpiry, typingOf, TYPING_EMIT_EVERY_MS, type TypingEvent, type TypingState } from './typing-logic';

let state: TypingState = {};
const listeners = new Set<() => void>();
const set = (next: TypingState) => {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => state;

/** WS → typing store. Mount once (shell, with `useInboxEvents`). */
export function useTypingEvents() {
  const { me } = useSession();
  const meId = me?.id ?? null;
  useWsEvent<TypingEvent>('conversation.typing', (p) => set(applyTyping(state, p, Date.now(), meId)));
  // the reply itself ends the indicator at once
  useWsEvent<WsMessageCreated>('message.created', (p) => {
    const m = p?.message;
    if (!p?.conversationId || !m || m.direction !== 'out') return;
    set(clearTyping(state, p.conversationId, m.author === 'ai' ? { ai: true } : { userId: m.authorUser?.id ?? null }));
  });
}

/** Who is typing in a conversation now; re-renders when an indicator expires. */
export function useTyping(conversationId: string | null | undefined): { ai: boolean; userIds: string[] } {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const next = nextExpiry(s, Date.now());
    if (next === null) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(50, next - Date.now() + 20));
    return () => window.clearTimeout(id);
  }, [s, now]);
  // `now` is refreshed by the timer above and by every store change
  return typingOf(s, conversationId, Math.max(now, Date.now()));
}

/** Throttled `typing { conversationId }` for the composer (≤ 1 per 3 s per conversation; nothing while disconnected). */
export function useTypingSignal(conversationId: string) {
  const emit = useWsEmit();
  const last = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < TYPING_EMIT_EVERY_MS) return;
    last.current = now;
    emit('typing', { conversationId });
  }, [emit, conversationId]);
}
