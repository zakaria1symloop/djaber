// Pure rules of the editable generation review (AGT-03 override, M11 carry-over).
import type { AgentGenerationResult } from '@djaber/shared';

type PolicyKey = 'delivery' | 'payment' | 'returns' | 'hours';
const POLICY_KEYS: PolicyKey[] = ['delivery', 'payment', 'returns', 'hours'];

export type Review = { instructions: string; faq: { q: string; a: string }[]; policies: Partial<Record<PolicyKey, string>> };
export type ReviewOverride = { instructions?: string; faq?: { q: string; a: string }[]; policies?: Record<string, string> };

/** The proposal of the job as the editor's initial value. */
export const seedReview = (r: AgentGenerationResult): Review => ({
  instructions: r.proposedInstructions ?? '',
  faq: (r.proposedFaq ?? []).map((f) => ({ q: f.q, a: f.a })),
  policies: Object.fromEntries(POLICY_KEYS.map((k) => [k, (r.proposedPolicies as Partial<Record<PolicyKey, string>> | undefined)?.[k] ?? ''])),
});

const cleanPolicies = (p: Partial<Record<PolicyKey, string>>) =>
  Object.fromEntries(POLICY_KEYS.map((k) => [k, (p[k] ?? '').trim()]).filter(([, v]) => v)) as Record<string, string>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The `override` to send: only the fields that differ from the proposal (`undefined` when nothing was edited, so the
 * proposal applies as is). Empty FAQ rows are dropped; a row with only a question or only an answer ⇒ `null` (the dialog
 * asks to complete or remove it).
 */
export function reviewOverride(r: AgentGenerationResult, v: Review): ReviewOverride | null | undefined {
  const rows = v.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q || f.a);
  if (rows.some((f) => !f.q || !f.a)) return null;
  const seed = seedReview(r);
  const out: ReviewOverride = {};
  if (v.instructions !== seed.instructions) out.instructions = v.instructions;
  const seedRows = seed.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() }));
  if (!same(rows, seedRows)) out.faq = rows;
  const policies = cleanPolicies(v.policies);
  if (!same(policies, cleanPolicies(seed.policies))) out.policies = policies;
  return Object.keys(out).length ? out : undefined;
}
