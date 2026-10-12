// REC-02 — the V1 cross-sell rule engine (recommendation.service.ts): co-purchase pairs, same-category up-sell, keyword
// similarity. Pure: the service loads the catalogue and the co-purchase counts. At most 3 suggestions per product (REC-01).
import { RECO_MAX_PER_TURN } from '@djaber/shared';

export type XsProduct = { id: string; name: string; price: number; categoryId: string | null; keywords: string[] };
export type XsPair = { productId: string; recommendedId: string; type: 'cross_sell' | 'up_sell'; score: number; reason: string };

export const CO_PURCHASE_MIN = 2;
export const KEYWORDS_MIN_SHARED = 2;
const norm = (k: string) =>
  k
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Scores (0–100): co-purchase 40 + 10 × times bought together (≥ 2), capped 100; up-sell in the same category for a
 * price 10 %–100 % higher, 45 − 10 per rank; ≥ 2 shared keywords 30 + 5 per extra keyword. The best type per pair wins;
 * then the 3 best suggestions per product.
 */
export function runCrossSellRules(products: XsProduct[], coPurchases: { a: string; b: string; count: number }[]): XsPair[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const best = new Map<string, XsPair>();
  const offer = (p: XsPair) => {
    if (p.productId === p.recommendedId || !byId.has(p.productId) || !byId.has(p.recommendedId)) return;
    const k = `${p.productId}|${p.recommendedId}`;
    const cur = best.get(k);
    if (!cur || cur.score < p.score) best.set(k, p);
  };
  for (const c of coPurchases) {
    if (c.count < CO_PURCHASE_MIN) continue;
    const score = Math.min(100, 40 + 10 * c.count);
    offer({ productId: c.a, recommendedId: c.b, type: 'cross_sell', score, reason: `co_purchase:${c.count}` });
    offer({ productId: c.b, recommendedId: c.a, type: 'cross_sell', score, reason: `co_purchase:${c.count}` });
  }
  const byCategory = new Map<string, XsProduct[]>();
  for (const p of products) if (p.categoryId) byCategory.set(p.categoryId, [...(byCategory.get(p.categoryId) ?? []), p]);
  for (const list of byCategory.values()) {
    for (const p of list) {
      const ups = list.filter((o) => o.id !== p.id && o.price > p.price * 1.1 && o.price <= p.price * 2).sort((x, y) => x.price - y.price || x.id.localeCompare(y.id));
      ups.slice(0, RECO_MAX_PER_TURN).forEach((o, rank) => offer({ productId: p.id, recommendedId: o.id, type: 'up_sell', score: 45 - 10 * rank, reason: 'same_category' }));
    }
  }
  const kw = products.map((p) => ({ id: p.id, set: new Set(p.keywords.map(norm).filter((k) => k.length >= 3)) })).filter((x) => x.set.size >= KEYWORDS_MIN_SHARED);
  for (let i = 0; i < kw.length; i++) {
    for (let j = i + 1; j < kw.length; j++) {
      const shared = [...kw[i]!.set].filter((k) => kw[j]!.set.has(k)).length;
      if (shared < KEYWORDS_MIN_SHARED) continue;
      const score = Math.min(60, 30 + 5 * (shared - KEYWORDS_MIN_SHARED));
      offer({ productId: kw[i]!.id, recommendedId: kw[j]!.id, type: 'cross_sell', score, reason: `keywords:${shared}` });
      offer({ productId: kw[j]!.id, recommendedId: kw[i]!.id, type: 'cross_sell', score, reason: `keywords:${shared}` });
    }
  }
  const perProduct = new Map<string, XsPair[]>();
  for (const p of best.values()) perProduct.set(p.productId, [...(perProduct.get(p.productId) ?? []), p]);
  return [...perProduct.values()].flatMap((list) => list.sort((a, b) => b.score - a.score || a.recommendedId.localeCompare(b.recommendedId)).slice(0, RECO_MAX_PER_TURN));
}
