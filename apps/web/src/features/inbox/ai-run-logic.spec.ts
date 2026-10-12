// M4 inbox additions: inspector rows of an AI run and handoff reason mapping.
import { describe, expect, it } from 'vitest';
import type { AiRun } from '@/features/agents/contracts';
import { aiRunRows, handoffReason } from './ai-run-logic';

const run = (patch: Partial<AiRun> = {}): AiRun => ({
  id: 'r1',
  kind: 'reply',
  status: 'ok',
  intent: 'sale',
  model: 'gpt-4o-mini',
  provider: 'openai',
  usedFallback: false,
  tokens: { input: 2140, output: 186 },
  latencyMs: 2300,
  confidence: 0.97,
  credits: 1,
  toolCalls: [{ name: 'search_products', args: { query: 'robe' }, result: { count: 3 } }],
  error: null,
  startedAt: '2026-10-11T10:00:00Z',
  ...patch,
});

describe('aiRunRows', () => {
  it('lists status, intent, model, tokens, latency, tools, credits', () => {
    const rows = aiRunRows(run(), 'fr');
    expect(rows.map((r) => r.key)).toEqual(['status', 'intent', 'model', 'tokens', 'latency', 'tools', 'credits']);
    expect(rows[0]).toMatchObject({ value: 'OK', tone: 'success' });
    expect(rows[1]).toMatchObject({ value: 'SALE', confidence: '0,97' });
    expect(rows[2]).toMatchObject({ value: 'gpt-4o-mini · openai', fallback: false });
    expect(rows[3]!.input!.replace(/\s/g, ' ')).toBe('2 140');
    expect(rows[3]!.output).toBe('186');
    expect(rows[4]!.value).toBe('2,3 s');
    expect(rows[5]!.count).toBe(1);
  });
  it('fallback model is flagged, error adds a row, handoff is a warning', () => {
    const rows = aiRunRows(run({ usedFallback: true, status: 'error', error: 'AI_PROVIDER_ERROR', intent: null, confidence: null, latencyMs: null }), 'en');
    expect(rows.find((r) => r.key === 'model')).toMatchObject({ fallback: true, tone: 'warning' });
    expect(rows.find((r) => r.key === 'error')).toMatchObject({ value: 'AI_PROVIDER_ERROR', tone: 'danger' });
    expect(rows.find((r) => r.key === 'intent')).toMatchObject({ value: '—', confidence: null });
    expect(rows.find((r) => r.key === 'latency')!.value).toBe('—');
    expect(aiRunRows(run({ status: 'handoff' }), 'fr')[0]!.tone).toBe('warning');
  });
});

describe('handoffReason', () => {
  it('no reason ⇒ null', () => {
    expect(handoffReason(null)).toBeNull();
    expect(handoffReason(' ')).toBeNull();
  });
  it('codes of the AI pipeline map to a kind', () => {
    expect(handoffReason('customer_request')).toEqual({ kind: 'human_request', detail: null });
    expect(handoffReason('unclear_streak')).toEqual({ kind: 'unclear', detail: null });
    expect(handoffReason('risky_client')).toEqual({ kind: 'risk', detail: null });
  });
  it('unknown text is kept as the detail of a transfer', () => {
    expect(handoffReason('Règle « remboursement »')).toEqual({ kind: 'transfer', detail: 'Règle « remboursement »' });
  });
});
