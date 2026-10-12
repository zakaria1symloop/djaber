// GDS-10 stock rules (FIG GDS-10 rule labels, AT-GDS-16 PRIX on Workspace.targetMarginPct) and the REC-02 cross-sell engine.
import { runCrossSellRules } from './cross-sell.engine';
import { inventoryVarianceCandidate, priceForMargin, recoKey, runStockRules, type EngineInput } from './stock-reco.engine';

const now = new Date('2026-10-12T10:00:00Z');
const DAY = 86_400_000;
const base = (over: Partial<EngineInput> = {}): EngineInput => ({ lines: [], products: [], suppliers: [], topics: [], targetMarginPct: 35, now, ...over });
const line = (over: Partial<EngineInput['lines'][number]> = {}): EngineInput['lines'][number] => ({ productId: 'p1', variantId: null, name: 'Parfum Oud 100 ml', variantName: null, stock: 12, minStock: 3, costPrice: 1500, units30d: 64, units7d: 15, supplier: { id: 's1', name: 'Belkacem Import', leadDays: 6 }, ...over });
const product = (over: Partial<EngineInput['products'][number]> = {}): EngineInput['products'][number] => ({ productId: 'p1', name: 'Montre Classic', price: 6000, costPrice: 3000, hasVariants: false, trackStock: true, stock: 9, lastSoldAt: new Date(now.getTime() - 74 * DAY), createdAt: new Date(now.getTime() - 200 * DAY), lastPurchaseNumber: null, ...over });

describe('GDS-10 stock rules', () => {
  it('RÉAPPROVISIONNER: stock 12, 64 sold / 30 d ⇒ out in ~5 d < lead 6 d ⇒ order 64 u (covers 30 d)', () => {
    const [c] = runStockRules(base({ lines: [line()] }));
    expect(c).toMatchObject({ ruleKey: 'restock_lead_time', type: 'restock', priority: 'high', supplierId: 's1', suggestedAction: { kind: 'create_purchase', params: { quantity: 64, productId: 'p1' } }, estimatedValue: 64 * 1500 });
    expect(c!.body.fr).toContain('rupture dans ~5 jours');
  });
  it('no card when the stock lasts longer than the lead time, or nothing sells', () => {
    expect(runStockRules(base({ lines: [line({ stock: 200 })] }))).toHaveLength(0);
    expect(runStockRules(base({ lines: [line({ units30d: 0, units7d: 0 })] }))).toHaveLength(0);
  });
  it('RUPTURE IMMINENTE: variant at 1 u with 4 sales this week (and no duplicate restock card)', () => {
    const out = runStockRules(base({ lines: [line({ variantId: 'v1', variantName: 'M / Noir', stock: 1, units7d: 4, units30d: 10 })] }));
    expect(out.map((c) => c.ruleKey)).toEqual(['stockout_variant']);
    expect(out[0]).toMatchObject({ type: 'stockout_imminent', priority: 'high', variantId: 'v1' });
  });
  it('PROMOUVOIR: 0 sale for 74 d and 9 u in stock ⇒ promo card with the tied-up value', () => {
    const out = runStockRules(base({ products: [product({ price: 3000 * 2 })] }));
    const promo = out.find((c) => c.ruleKey === 'dead_stock');
    expect(promo).toMatchObject({ type: 'promote', priority: 'medium', estimatedValue: 27000, suggestedAction: { kind: 'create_promo' } });
    expect(promo!.body.fr).toContain('74 jours');
  });
  it('AT-GDS-16 PRIX: margin 29 % < 35 % ⇒ price 41 000 → 44 600; target 40 % moves the next run', () => {
    const p = product({ name: 'Sac cuir camel', price: 41000, costPrice: 29000, lastSoldAt: now, stock: 2 });
    const out = runStockRules(base({ products: [p] }));
    expect(out.find((c) => c.ruleKey === 'margin_below_target')).toMatchObject({ type: 'price', suggestedAction: { kind: 'update_price', params: { from: 41000, price: 44600 } } });
    expect(priceForMargin(29000, 40)).toBe(48300);
    expect(runStockRules(base({ products: [p], targetMarginPct: 25 })).some((c) => c.ruleKey === 'margin_below_target')).toBe(false);
  });
  it('FOURNISSEUR: 3 late deliveries out of 5 (≥ 50 %); AGENT IA: ≥ 10 unknown-product questions in 7 d', () => {
    const out = runStockRules(base({ suppliers: [{ supplierId: 's2', name: 'Textile Sétif', deliveries: 5, late: 3, avgDelayDays: 4 }, { supplierId: 's3', name: 'OK', deliveries: 5, late: 1, avgDelayDays: 1 }], topics: [{ agentId: 'a1', agentName: 'Vendeur Pro', topic: 'Parfum Musc', count: 12 }, { agentId: 'a1', agentName: 'Vendeur Pro', topic: 'x', count: 3 }] }));
    expect(out.map((c) => [c.ruleKey, c.supplierId ?? c.agentId])).toEqual([
      ['supplier_late', 's2'],
      ['agent_unknown_product', 'a1'],
    ]);
  });
  it('INV-02 variance card and stable keys', () => {
    const c = inventoryVarianceCandidate({ productId: 'p1', variantId: null, name: 'Gant', variantName: null, expected: 3, counted: 1, pct: 67, number: 'INV-1', inventoryId: 'i1' });
    expect(c).toMatchObject({ ruleKey: 'inventory_variance', type: 'restock', suggestedAction: { kind: 'open_product' } });
    expect(recoKey(c)).toBe('inventory_variance|p1|||');
  });
});

describe('REC-02 cross-sell engine (V1 rules)', () => {
  const P = (id: string, price: number, categoryId: string | null, keywords: string[] = []) => ({ id, name: id, price, categoryId, keywords });
  it('co-purchase ≥ 2 both ways, same-category up-sell 10 %–100 % dearer, ≥ 2 shared keywords; ≤ 3 per product', () => {
    const products = [P('a', 1000, 'c1', ['parfum', 'oud', 'luxe']), P('b', 1500, 'c1', ['parfum', 'oud']), P('c', 5000, 'c1'), P('d', 800, null), P('e', 1200, 'c1'), P('f', 1300, 'c1')];
    const pairs = runCrossSellRules(products, [
      { a: 'a', b: 'd', count: 3 },
      { a: 'b', b: 'c', count: 1 },
    ]);
    const of = (id: string) => pairs.filter((p) => p.productId === id).map((p) => [p.recommendedId, p.type, p.score]);
    expect(of('d')).toEqual([['a', 'cross_sell', 70]]);
    // a: co-purchase d (70), keywords b (30) vs up-sell b (45 best wins), e (35), f (25) → top 3
    expect(of('a')).toEqual([
      ['d', 'cross_sell', 70],
      ['e', 'up_sell', 45],
      ['f', 'up_sell', 35],
    ]);
    expect(pairs.every((p) => p.productId !== p.recommendedId)).toBe(true);
    expect(pairs.some((p) => p.productId === 'b' && p.recommendedId === 'c')).toBe(false);
  });
});
