// Pure view models of the M4 inbox additions: rows of the "Détail du tour IA" inspector (`GET /messages/:id/ai-run`)
// and the label of a handoff reason (`Conversation.handoffReason`).
import { formatNumber } from '@djaber/shared';
import type { AiRun } from '@/features/agents/contracts';
import { confidenceLabel, secondsLabel, statusTone } from '@/features/agents/logic';
import { queueReason, type QueueReasonKind } from '@/features/queue/logic';

export type AiRunRowKey = 'status' | 'intent' | 'model' | 'tokens' | 'latency' | 'tools' | 'credits' | 'error';
export type AiRunRow = {
  key: AiRunRowKey;
  /** already formatted, language-neutral parts; the component adds the translated words */
  value: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
  /** extra facts the component translates: intent key, fallback flag, counts */
  intent?: string | null;
  confidence?: string | null;
  fallback?: boolean;
  input?: string;
  output?: string;
  count?: number;
};

/** Rows of the inspector in the order of AGT-07 (statut · intention · modèle · tokens · latence · outils · crédits · erreur). */
export const aiRunRows = (run: AiRun, locale: string): AiRunRow[] => {
  const rows: AiRunRow[] = [
    { key: 'status', value: run.status.toUpperCase(), tone: statusTone(run.status) },
    { key: 'intent', value: run.intent ? run.intent.toUpperCase() : '—', intent: run.intent, confidence: run.confidence === null || run.confidence === undefined ? null : confidenceLabel(run.confidence, locale) },
    { key: 'model', value: [run.model, run.provider].filter(Boolean).join(' · ') || '—', fallback: run.usedFallback, tone: run.usedFallback ? 'warning' : undefined },
    { key: 'tokens', value: '', input: formatNumber(run.tokens?.input ?? 0), output: formatNumber(run.tokens?.output ?? 0) },
    { key: 'latency', value: secondsLabel(run.latencyMs, locale) },
    { key: 'tools', value: String(run.toolCalls?.length ?? 0), count: run.toolCalls?.length ?? 0 },
    { key: 'credits', value: formatNumber(run.credits ?? 0), count: run.credits ?? 0 },
  ];
  if (run.error) rows.push({ key: 'error', value: run.error, tone: 'danger' });
  return rows;
};

/** Reason of a needs-human conversation: the kind (i18n `inbox.handoff.reason.<kind>`) and the rule / keyword detail. */
export const handoffReason = (raw: string | null | undefined): { kind: QueueReasonKind; detail: string | null } | null => {
  if (!raw?.trim()) return null;
  return queueReason(raw);
};
