// CLI-04 aggregates (recomputed from rows, never incremented), ORD-12 / 04 §13 / §21 risk rules, AT-CLI-05, AT-ORD-14.
import { computeClientAggregates, type AggregateOrder } from './client-aggregates.service';

const now = new Date('2026-10-12T10:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const order = (status: string, total: number, over: Partial<AggregateOrder> = {}): AggregateOrder => ({ status, total, orderedAt: daysAgo(1), cancelledAt: status === 'cancelled' ? daysAgo(1) : null, cancelReason: null, returnedUncollected: false, ...over });
const rules = { riskAfterReturns: 2 };

describe('client aggregates (CLI-04)', () => {
  it('AT-CLI-05 totals come from delivered orders + completed sales; cancelled orders do not count', () => {
    const a = computeClientAggregates([order('delivered', 2000, { orderedAt: daysAgo(5) }), order('new', 500, { orderedAt: daysAgo(2) }), order('cancelled', 900)], [{ total: 1000, soldAt: daysAgo(3) }], rules, now);
    expect(a).toMatchObject({ orderCount: 3, totalSpent: 3000, deliveredCount: 1, cancelCount: 1, returnCount: 0, autoRisk: 'normal' });
    expect(a.lastOrderAt).toEqual(daysAgo(2));
  });

  it('the same rows give the same values (recompute, never increment)', () => {
    const rows = [order('delivered', 2000), order('returned', 800, { returnedUncollected: true })];
    expect(computeClientAggregates(rows, [], rules, now)).toEqual(computeClientAggregates(rows, [], rules, now));
  });

  it('AT-ORD-14 ≥ 3 cancelled in 30 d ⇒ high; 3 cancelled long ago ⇒ normal', () => {
    expect(computeClientAggregates([order('cancelled', 1), order('cancelled', 1), order('cancelled', 1)], [], rules, now).autoRisk).toBe('high');
    const old = { cancelledAt: daysAgo(40), orderedAt: daysAgo(40) };
    expect(computeClientAggregates([order('cancelled', 1, old), order('cancelled', 1, old), order('cancelled', 1, old)], [], rules, now).autoRisk).toBe('normal');
  });

  it('04 §13 riskAfterReturns: ≥ 2 returns in 90 d ⇒ high; the threshold follows the workspace rule', () => {
    const two = [order('returned', 1), order('returned', 1)];
    expect(computeClientAggregates(two, [], rules, now).autoRisk).toBe('high');
    expect(computeClientAggregates(two, [], { riskAfterReturns: 3 }, now).autoRisk).toBe('normal');
  });

  it('04 §21 a "faux numéro" cancellation makes the client risky', () => {
    expect(computeClientAggregates([order('cancelled', 1, { cancelReason: 'fake' })], [], rules, now).autoRisk).toBe('high');
  });

  it('uncollected parcels (returned unreachable / refused) are counted for the auto-block rule', () => {
    expect(computeClientAggregates([order('returned', 1, { returnedUncollected: true }), order('returned', 1)], [], rules, now).uncollectedCount).toBe(1);
  });
});
