// Trust & safety rules of the merchant screens (04 §13).
import { BLOCKED_WORDS_MAX } from '@djaber/shared';
import { describe, expect, it } from 'vitest';
import { addBlockedWords, canBlockAlso, isUnblockable, parseThreshold, reportReasons, setAutoBlock, setRiskRule } from './logic';

describe('report dialog', () => {
  it('reasons per target: a customer report offers the 5 reasons of the frame, an AI message starts with ai_incorrect', () => {
    expect(reportReasons('customer')).toEqual(['harassment', 'fraud', 'spam', 'inappropriate_content', 'other']);
    expect(reportReasons('conversation')).toEqual(reportReasons('customer'));
    expect(reportReasons('ai_message')[0]).toBe('ai_incorrect');
  });
  it('"Bloquer aussi" only when a customer is the target', () => {
    expect(canBlockAlso('conversation')).toBe(true);
    expect(canBlockAlso('customer')).toBe(true);
    expect(canBlockAlso('ai_message')).toBe(false);
    expect(canBlockAlso('product')).toBe(false);
  });
});

describe('blocked list', () => {
  it('platform rows are never unblockable by the merchant', () => {
    expect(isUnblockable({ source: 'manual', unblockable: true })).toBe(true);
    expect(isUnblockable({ source: 'auto_rule', unblockable: true })).toBe(true);
    expect(isUnblockable({ source: 'platform', unblockable: true })).toBe(false);
    expect(isUnblockable({ source: 'manual', unblockable: false })).toBe(false);
  });
});

describe('automatic rules', () => {
  const rules = { riskAfterReturns: 2, autoBlockEnabled: false, autoBlockAfterUncollected: 3, handoffOnRisk: true };
  it('the auto-block switch is `autoBlockEnabled`; the threshold is kept while the rule is off', () => {
    expect(setAutoBlock(rules, true)).toEqual({ ...rules, autoBlockEnabled: true });
    expect(setAutoBlock({ ...rules, autoBlockEnabled: true, autoBlockAfterUncollected: 5 }, false)).toEqual({ ...rules, autoBlockEnabled: false, autoBlockAfterUncollected: 5 });
  });
  it('the risk rule: off writes 0, on restores the default of 04 §13 or keeps the stored value', () => {
    expect(setRiskRule(rules, false).riskAfterReturns).toBe(0);
    expect(setRiskRule({ ...rules, riskAfterReturns: 0 }, true).riskAfterReturns).toBe(2);
    expect(setRiskRule({ ...rules, riskAfterReturns: 4 }, true).riskAfterReturns).toBe(4);
  });
  it('threshold: 1–50 only (0 is refused by the API with 422)', () => {
    expect(parseThreshold('3')).toBe(3);
    expect(parseThreshold('50')).toBe(50);
    expect(parseThreshold('0')).toBeNull();
    expect(parseThreshold('51')).toBeNull();
    expect(parseThreshold('')).toBeNull();
  });
});

describe('blocked words', () => {
  it('splits, trims, strips quotes and ignores duplicates (case and diacritics)', () => {
    expect(addBlockedWords(['avocat'], ' Arnaque, « escroc » ; AVOCAT\nÉscroc ')).toEqual({ words: ['avocat', 'Arnaque', 'escroc'], added: 2, full: false });
    expect(addBlockedWords([], ' , ;')).toEqual({ words: [], added: 0, full: false });
  });
  it('caps a word at 60 characters and the list at 200', () => {
    expect(addBlockedWords([], 'x'.repeat(80)).words[0]).toHaveLength(60);
    const full = Array.from({ length: BLOCKED_WORDS_MAX }, (_, i) => `w${i}`);
    expect(addBlockedWords(full, 'encore')).toEqual({ words: full, added: 0, full: true });
  });
});
