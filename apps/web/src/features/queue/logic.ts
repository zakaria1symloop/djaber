// Queue card rules (frame "QUEUE — File d'attente — items"): the label line of a needs-human card is derived from
// `Conversation.handoffReason`. Pure functions.

export type QueueReasonKind = 'transfer' | 'human_request' | 'credits' | 'ai_error' | 'risk' | 'blocked_word' | 'abuse' | 'manual' | 'window';
export type QueueReason = { kind: QueueReasonKind; /** rule / keyword that triggered the handoff, shown after the label */ detail: string | null };

const KINDS: Record<string, QueueReasonKind> = {
  human_request: 'human_request',
  customer_request: 'human_request',
  asked_human: 'human_request',
  credits_exhausted: 'credits',
  credits: 'credits',
  quota_exhausted: 'credits',
  ai_error: 'ai_error',
  provider_error: 'ai_error',
  error: 'ai_error',
  send_failed: 'ai_error',
  risky_client: 'risk',
  risk: 'risk',
  blocked_word: 'blocked_word',
  abuse: 'abuse',
  abuse_guard: 'abuse',
  manual: 'manual',
  // an AI reply could not leave outside the 24 h window (MSG-06): a human must answer
  outside_window: 'window',
  reply_outside_window: 'window',
};

/**
 * `handoffReason` is free text set by the server: a known code (`human_request`, `credits_exhausted`…), a prefixed
 * rule (`rule:remboursement`, `keyword:avocat`) or the rule label itself. Anything unknown is a transfer with its text.
 */
export const queueReason = (handoffReason: string | null | undefined): QueueReason => {
  const raw = (handoffReason ?? '').trim();
  if (!raw) return { kind: 'transfer', detail: null };
  const known = KINDS[raw.toLowerCase()];
  if (known) return { kind: known, detail: null };
  const m = /^(rule|keyword|règle|regle|handoff)\s*[:=]\s*(.+)$/i.exec(raw);
  if (m) {
    const detail = m[2]!.trim().replace(/^[«"']\s*|\s*[»"']$/g, '');
    return { kind: KINDS[detail.toLowerCase()] ?? 'transfer', detail: KINDS[detail.toLowerCase()] ? null : detail || null };
  }
  return { kind: 'transfer', detail: raw };
};

/** `Amina Belkacem` → `Amina B.` (cards of the queue and of the inbox list). */
export const shortName = (name: string | null | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;
};
