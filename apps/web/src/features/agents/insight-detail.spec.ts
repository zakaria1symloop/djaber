import { describe, expect, it } from 'vitest';
import type { TFunction } from '@/lib/i18n';
import { insightDetail } from './insight-detail';

// the key and its params, so the mapping is checked without the catalogue
const t = ((key: string) => `<${key}>`) as unknown as TFunction;

describe('insight detail in words', () => {
  it('handoff codes of the pipeline get the inbox reason label', () => {
    expect(insightDetail(t, 'off_catalogue')).toBe('<inbox.handoff.reason.off_catalogue>');
    expect(insightDetail(t, 'customer_request')).toBe('<inbox.handoff.reason.human_request>');
    expect(insightDetail(t, 'refund')).toBe('<inbox.handoff.reason.refund>');
    expect(insightDetail(t, 'blocked_word:arnaque')).toBe('<inbox.handoff.reason.blocked_word> · arnaque');
  });
  it('an FAQ candidate has its own label; free text and empty values stay as they are', () => {
    expect(insightDetail(t, 'faq_candidate')).toBe('<agents.insights.detail.faqCandidate>');
    expect(insightDetail(t, 'fournisseur indisponible 18:40–19:05')).toBe('fournisseur indisponible 18:40–19:05');
    expect(insightDetail(t, '  ')).toBeNull();
    expect(insightDetail(t, null)).toBeNull();
  });
});
