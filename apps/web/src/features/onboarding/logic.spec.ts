import { describe, expect, it } from 'vitest';
import { agentTestPath, agentToTest, connectedChannels, limitReached, SCRATCH_WIZARD_PATH } from './logic';

describe('onboarding — Ready step next actions (ONB-01 step 6)', () => {
  it('tests an active agent first, else the most recent draft; none without agent', () => {
    expect(agentToTest([])).toBeNull();
    expect(agentToTest(null)).toBeNull();
    const draftOld = { id: 'd1', name: 'A', status: 'draft' as const, updatedAt: '2026-10-01T10:00:00Z' };
    const draftNew = { id: 'd2', name: 'B', status: 'draft' as const, updatedAt: '2026-10-02T10:00:00Z' };
    const active = { id: 'a1', name: 'C', status: 'active' as const, updatedAt: '2026-09-01T10:00:00Z' };
    expect(agentToTest([draftOld, draftNew])?.id).toBe('d2');
    expect(agentToTest([draftNew, active])?.id).toBe('a1');
  });
  it('opens the playground of an agent page, and wizard step 5 for a draft (a draft has no page)', () => {
    expect(agentTestPath({ id: 'a1', status: 'active' })).toBe('/agents/a1/playground');
    expect(agentTestPath({ id: 'a1', status: 'paused' })).toBe('/agents/a1/playground');
    expect(agentTestPath({ id: 'd1', status: 'draft' })).toBe('/agents/new/activate?draft=d1');
  });
  it('blocks an action at the plan limit only (-1 = unlimited)', () => {
    const plan = (maxMembers: number, members: number) => ({ limits: { maxMembers, maxProducts: -1 }, usage: { members, products: 3 } });
    expect(limitReached(plan(3, 1), 'members')).toBeNull();
    expect(limitReached(plan(1, 1), 'members')).toEqual({ current: 1, limit: 1 });
    expect(limitReached(plan(-1, 40), 'members')).toBeNull();
    expect(limitReached(plan(1, 1), 'products')).toBeNull();
    expect(limitReached(null, 'members')).toBeNull();
  });
});

describe('onboarding — reopened steps', () => {
  it('counts the pages that are still connected', () => {
    const rows = [
      { id: '1', name: 'Boutique', status: 'active' },
      { id: '2', name: 'Old', status: 'disconnected' },
      { id: '3', name: 'IG', status: 'pending_review' },
      { id: '4', name: 'Off', status: 'disabled' },
    ];
    expect(connectedChannels(rows).map((c) => c.id)).toEqual(['1', '3']);
    expect(connectedChannels(undefined)).toEqual([]);
  });
  it('"Partir de zéro" opens the agent wizard with the blank starting point', () => {
    expect(SCRATCH_WIZARD_PATH).toBe('/agents/new?start=scratch');
  });
});
