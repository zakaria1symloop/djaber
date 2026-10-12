// `AgentInsight.detail` is written by the AI pipeline as a code (`off_catalogue`, `customer_request`, `refund`,
// `blocked_word:<word>`, `faq_candidate`, `outside_window`…) or as free text (a provider error). The cards of the agents
// list, of the Insights tab and of the inbox dialog show it in words: the handoff-reason labels of the inbox for the
// codes they share, the text itself otherwise.
import type { TFunction } from '@/lib/i18n';
import { handoffLabel } from '@/features/inbox/ui';
import { queueReason } from '@/features/queue/logic';

export const insightDetail = (t: TFunction, detail: string | null | undefined): string | null => {
  const raw = detail?.trim();
  if (!raw) return null;
  if (raw === 'faq_candidate') return t('agents.insights.detail.faqCandidate');
  const reason = queueReason(raw);
  // an unknown code or free text: shown as the server wrote it
  if (reason.kind === 'transfer') return reason.detail ?? raw;
  return handoffLabel(t, raw);
};
