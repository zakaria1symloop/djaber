// Trust & safety rules of the merchant screens (04 §13, frame "SAFE — Trust & safety (merchant)"). Pure functions.
import { BLOCKED_WORDS_MAX, DEFAULT_SAFETY_RULES, type BlockReason, type CustomerBlockView, type ReportReason, type SafetyRules } from '@djaber/shared';

/** Reasons offered by "Bloquer ce client" / "Bloquer un numéro" (`uncollected` is set by the automatic rule only). */
export const BLOCK_REASONS: readonly BlockReason[] = ['harassment', 'fraud', 'spam', 'inappropriate', 'other'];
/** Reasons of "Signaler à Djaber", in the order of the frame; `ai_incorrect` only for a reported AI message. */
export const reportReasons = (type: 'conversation' | 'customer' | 'ai_message' | 'product'): ReportReason[] =>
  type === 'ai_message' ? ['ai_incorrect', 'inappropriate_content', 'other'] : ['harassment', 'fraud', 'spam', 'inappropriate_content', 'other'];
/** "Bloquer aussi ce client maintenant" makes sense only when a customer is the target. */
export const canBlockAlso = (type: 'conversation' | 'customer' | 'ai_message' | 'product') => type === 'conversation' || type === 'customer';

/** Platform rows are never unblockable by the merchant (403 CUSTOMER_BLOCKED_BY_PLATFORM), whatever the flag says. */
export const isUnblockable = (b: Pick<CustomerBlockView, 'source' | 'unblockable'>) => b.source !== 'platform' && b.unblockable !== false;

/** "Marquer risque": `riskAfterReturns = 0` is the rule off; switching it on restores the default of 04 §13 (2). */
export const setRiskRule = (rules: SafetyRules, on: boolean): SafetyRules => ({ ...rules, riskAfterReturns: on ? rules.riskAfterReturns || DEFAULT_SAFETY_RULES.riskAfterReturns : 0 });
/** Auto-block: the switch is `autoBlockEnabled`; the threshold is kept while the rule is off. */
export const setAutoBlock = (rules: SafetyRules, on: boolean): SafetyRules => ({ ...rules, autoBlockEnabled: on });
export const AUTO_BLOCK_MIN = 1;
export const AUTO_BLOCK_MAX = 50;
/** Threshold typed in the field: 1–50, anything else is refused (null) and the stored value stays. */
export const parseThreshold = (digits: string): number | null => {
  const n = Number(digits);
  return /^\d{1,2}$/.test(digits) && n >= AUTO_BLOCK_MIN && n <= AUTO_BLOCK_MAX ? n : null;
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٟ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Adds words typed in the field ("avocat, arnaque") to the workspace list: split on commas / new lines, trimmed,
 * 60 characters max each, duplicates ignored case- and diacritic-insensitively, list capped at 200.
 */
export const addBlockedWords = (current: readonly string[], input: string): { words: string[]; added: number; full: boolean } => {
  const words = [...current];
  const seen = new Set(words.map(fold));
  let added = 0;
  for (const raw of input.split(/[,;\n]+/)) {
    const w = raw.trim().replace(/^[«"']\s*|\s*[»"']$/g, '').slice(0, 60);
    if (!w || seen.has(fold(w))) continue;
    if (words.length >= BLOCKED_WORDS_MAX) return { words, added, full: true };
    words.push(w);
    seen.add(fold(w));
    added++;
  }
  return { words, added, full: false };
};
