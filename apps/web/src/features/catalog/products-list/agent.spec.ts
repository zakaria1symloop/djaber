// Products list × agents (carry-over M2 → M4): agent filter chips and the outcome of "Ajouter à un agent".
import { describe, expect, it } from 'vitest';
import { parseListState } from '@/lib/list-state';
import { activeChips, addToAgentOutcome, agentFilterOptions, agentFilterPatch, NO_AGENT, PRODUCTS_LIST, type ChipLabels } from './spec';

describe('agent filter', () => {
  it('options: "Aucun agent" first, then the agents', () => {
    expect(agentFilterOptions([{ id: 'a1', name: 'Vendeur Pro' }], 'Aucun agent')).toEqual([
      { value: NO_AGENT, label: 'Aucun agent' },
      { value: 'a1', label: 'Vendeur Pro' },
    ]);
  });
  it('"Aucun agent" and agents exclude each other, the last click wins', () => {
    expect(agentFilterPatch(['a1'], false)).toEqual({ noAgent: null, agentId: ['a1'] });
    expect(agentFilterPatch(['a1', 'a2'], false)).toEqual({ noAgent: null, agentId: ['a1', 'a2'] });
    // "Aucun agent" clicked while an agent was chosen
    expect(agentFilterPatch(['a1', NO_AGENT], false)).toEqual({ noAgent: true, agentId: null });
    // an agent clicked while "Aucun agent" was on
    expect(agentFilterPatch([NO_AGENT, 'a1'], true)).toEqual({ noAgent: null, agentId: ['a1'] });
    expect(agentFilterPatch([NO_AGENT], true)).toEqual({ noAgent: true, agentId: null });
    expect(agentFilterPatch([], true)).toEqual({ noAgent: null, agentId: null });
  });
  it('`agentId` lives in the URL and gives one chip', () => {
    const s = parseListState(PRODUCTS_LIST, new URLSearchParams('agentId=a1,a2'));
    const labels = { agent: (n: string) => `Agent : ${n}`, agentName: (id: string) => ({ a1: 'Vendeur Pro', a2: 'Service Client' })[id] ?? '…' } as unknown as ChipLabels;
    const chips = activeChips(s, labels);
    expect(chips).toEqual([{ key: 'agentId', label: 'Agent : Vendeur Pro, Service Client', clear: { agentId: null } }]);
  });
});

describe('addToAgentOutcome', () => {
  const ok = { id: 'p', ok: true };
  const ko = { id: 'q', ok: false, error: { code: 'PRODUCT_ARCHIVED', message: 'Produit archivé.' } };
  it('all added', () => expect(addToAgentOutcome({ ok: 3, failed: 0, results: [ok, ok, ok] })).toEqual({ kind: 'done', count: 3 }));
  it('some refused ⇒ per-item results', () => expect(addToAgentOutcome({ ok: 1, failed: 1, results: [ok, ko] })).toEqual({ kind: 'partial', ok: 1, failed: 1 }));
  it('all refused ⇒ the first reason', () => expect(addToAgentOutcome({ ok: 0, failed: 2, results: [ko, ko] })).toEqual({ kind: 'failed', code: 'PRODUCT_ARCHIVED', message: 'Produit archivé.', count: 2 }));
});
