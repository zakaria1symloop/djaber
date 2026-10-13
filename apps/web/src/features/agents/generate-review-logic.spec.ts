import type { AgentGenerationResult } from '@djaber/shared';
import { describe, expect, it } from 'vitest';
import { reviewOverride, seedReview } from './generate-review-logic';

const result: AgentGenerationResult = {
  channelId: 'c',
  conversations: 3,
  messages: 6,
  summary: 's',
  languages: [],
  topQuestions: [],
  tone: 'warm',
  proposedInstructions: 'Proposition',
  proposedFaq: [{ q: 'Vous livrez à Sétif ?', a: 'Oui, 58 wilayas.' }],
  proposedPolicies: { delivery: '58 wilayas' },
  linkedAgent: null,
};

describe('generation review override (AGT-03, M11)', () => {
  it('an untouched review sends nothing: the proposal applies as is', () => {
    expect(reviewOverride(result, seedReview(result))).toBeUndefined();
  });
  it('only the edited fields are sent', () => {
    const r = seedReview(result);
    expect(reviewOverride(result, { ...r, instructions: 'Texte revu' })).toEqual({ instructions: 'Texte revu' });
    expect(reviewOverride(result, { ...r, faq: [] })).toEqual({ faq: [] });
    expect(reviewOverride(result, { ...r, faq: [...r.faq, { q: ' Taille L ? ', a: ' Oui ' }] })).toEqual({ faq: [{ q: 'Vous livrez à Sétif ?', a: 'Oui, 58 wilayas.' }, { q: 'Taille L ?', a: 'Oui' }] });
    expect(reviewOverride(result, { ...r, policies: { ...r.policies, payment: 'À la livraison' } })).toEqual({ policies: { delivery: '58 wilayas', payment: 'À la livraison' } });
    expect(reviewOverride(result, { ...r, policies: { delivery: '' } })).toEqual({ policies: {} });
  });
  it('empty rows are dropped; a half-filled row blocks the apply (null)', () => {
    const r = seedReview(result);
    expect(reviewOverride(result, { ...r, faq: [...r.faq, { q: '', a: '  ' }] })).toBeUndefined();
    expect(reviewOverride(result, { ...r, faq: [...r.faq, { q: 'Question seule', a: '' }] })).toBeNull();
  });
});
