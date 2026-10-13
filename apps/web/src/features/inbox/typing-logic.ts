// Typing indicators of the inbox (M11 carry-over, 03-events §2): WS `conversation.typing` —
// a member typing `{ conversationId, userId, at }` (relayed by the server, the sender excluded) and the AI reply job
// `{ conversationId, ai: true, active, at }`. Pure state so that expiry and filtering are unit-tested.

/** A member's signal is shown this long after the last one (the composer sends one every 3 s while typing). */
export const MEMBER_TYPING_TTL_MS = 6_000;
/** Safety net for an AI "active" signal whose "inactive" was lost (the reply job lasts a few seconds). */
export const AI_TYPING_TTL_MS = 60_000;
/** The composer sends at most one `typing` per conversation in this window (the server relays ≤ 1 per 2 s). */
export const TYPING_EMIT_EVERY_MS = 3_000;

export type TypingEvent = { conversationId?: string; userId?: string | null; ai?: boolean; active?: boolean; at?: string };
/** conversationId → { ai: until (ms), members: userId → until (ms) } */
export type TypingState = Record<string, { ai: number; members: Record<string, number> }>;

/** Applies one WS event (own signals and malformed payloads are ignored); returns the same object when nothing changes. */
export function applyTyping(state: TypingState, e: TypingEvent | null | undefined, now: number, meId: string | null): TypingState {
  const id = e?.conversationId;
  if (!id) return state;
  const cur = state[id] ?? { ai: 0, members: {} };
  if (e.ai) {
    const ai = e.active === false ? 0 : now + AI_TYPING_TTL_MS;
    if (ai === cur.ai) return state;
    return { ...state, [id]: { ...cur, ai } };
  }
  const user = e.userId;
  if (!user || user === meId) return state;
  const members = { ...cur.members };
  if (e.active === false) delete members[user];
  else members[user] = now + MEMBER_TYPING_TTL_MS;
  return { ...state, [id]: { ...cur, members } };
}

/** A reply arrived: the AI (or that member) is no longer typing on this conversation. */
export function clearTyping(state: TypingState, conversationId: string, who: { ai?: boolean; userId?: string | null }): TypingState {
  const cur = state[conversationId];
  if (!cur) return state;
  if (who.ai) return cur.ai ? { ...state, [conversationId]: { ...cur, ai: 0 } } : state;
  if (who.userId && cur.members[who.userId]) {
    const members = { ...cur.members };
    delete members[who.userId];
    return { ...state, [conversationId]: { ...cur, members } };
  }
  return state;
}

/** What to show for one conversation at `now`: the AI replying, and the members typing (oldest signal first). */
export function typingOf(state: TypingState, conversationId: string | null | undefined, now: number): { ai: boolean; userIds: string[] } {
  const cur = conversationId ? state[conversationId] : undefined;
  if (!cur) return { ai: false, userIds: [] };
  return {
    ai: cur.ai > now,
    userIds: Object.entries(cur.members)
      .filter(([, until]) => until > now)
      .sort((a, b) => a[1] - b[1])
      .map(([u]) => u),
  };
}

/** The earliest future expiry (to re-render when an indicator must disappear), or null. */
export function nextExpiry(state: TypingState, now: number): number | null {
  let next: number | null = null;
  for (const c of Object.values(state)) for (const until of [c.ai, ...Object.values(c.members)]) if (until > now && (next === null || until < next)) next = until;
  return next;
}
