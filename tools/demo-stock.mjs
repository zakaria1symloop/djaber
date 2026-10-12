// M7 — adds GDS operations to the demo shop made by tools/demo-data.mjs (owner account read from .local/demo-accounts.md):
// advanced stock mode, suppliers, purchases (ordered, partially received, received + paid), counter sales (paid, partial
// with a client), manual cash rows, a cross-sell rule and a stock-recommendation run. Fake drivers only.
// Usage: node tools/demo-stock.mjs [apiBaseUrl]
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = `${process.argv[2] ?? 'http://localhost:4010'}/api/v1`;
const md = readFileSync(resolve(root, '.local/demo-accounts.md'), 'utf8');
const [, email, password] = /^\| owner[^|]*\| (\S+) \| (\S+) \|$/m.exec(md) ?? [];
if (!email) throw new Error('run tools/demo-data.mjs first');

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  return json?.data;
};
const soft = (p) => p.catch((e) => (console.warn(e.message), null));

const T = (await call('POST', '/auth/login', null, { email, password })).accessToken;
const ws = await call('GET', '/workspace', T);
if (ws.stockMode !== 'advanced') await soft(call('PATCH', '/workspace', T, { stockMode: 'advanced', version: ws.version }));
const products = (await call('GET', '/products?pageSize=50', T)).filter((p) => p.trackStock && !p.hasVariants);
if (products.length < 3) throw new Error('the demo shop needs at least 3 tracked products without variants');
const [a, b, c, d] = products;

const existing = await call('GET', '/suppliers', T);
const supplier = async (body) => existing.find((s) => s.name === body.name) ?? (await call('POST', '/suppliers', T, body));
const belkacem = await supplier({ name: 'Belkacem Import', phone: '0550123456', email: 'belkacem@import.dz', address: 'Zone industrielle, Sétif', terms: 'Paiement à 30 j · remise 5 % > 100 000 DA', paymentTermsDays: 30, avgLeadDays: 6, notes: 'Livre le jeudi.' });
const textile = await supplier({ name: 'Textile Sétif', phone: '0661987654', avgLeadDays: 4 });
await supplier({ name: 'Parfumerie Orient', email: 'contact@orient.dz' });

const day = 86_400_000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();
// received and paid
const p1 = await call('POST', '/purchases', T, { supplierId: belkacem.id, items: [{ productId: a.id, quantity: 12, unitCost: Math.max(100, Math.round(a.price * 0.45)) }, { productId: b.id, quantity: 6, unitCost: Math.max(100, Math.round(b.price * 0.5)) }], shippingCost: 1500, status: 'pending', purchasedAt: iso(-6), expectedAt: iso(-1) });
await call('POST', `/purchases/${p1.id}/receive`, T, { items: p1.items.map((i) => ({ id: i.id, receivedQty: i.quantity })), supplierInvoiceRef: 'F-2026-118', paymentNow: { amount: Math.round(p1.total / 2), method: 'transfer' } });
// partially received, late
const p2 = await call('POST', '/purchases', T, { supplierId: textile.id, items: [{ productId: c.id, quantity: 10, unitCost: Math.max(100, Math.round(c.price * 0.4)) }], status: 'pending', purchasedAt: iso(-8), expectedAt: iso(-2) });
await call('POST', `/purchases/${p2.id}/receive`, T, { items: [{ id: p2.items[0].id, receivedQty: 4 }] });
// ordered, not yet received; and a draft
await call('POST', '/purchases', T, { supplierId: belkacem.id, items: [{ productId: (d ?? a).id, quantity: 20, unitCost: Math.max(100, Math.round((d ?? a).price * 0.45)) }], status: 'pending', expectedAt: iso(5) });
await call('POST', '/purchases', T, { supplierId: textile.id, items: [{ productId: b.id, quantity: 5, unitCost: Math.max(100, Math.round(b.price * 0.5)) }] });

// counter sales: paid walk-in, partial with a client, then "Encaisser le reste" on another
const s1 = await soft(call('POST', '/sales', T, { items: [{ productId: a.id, quantity: 1 }], paymentMethod: 'cash', amountPaid: a.price }));
const s2 = await soft(call('POST', '/sales', T, { client: { name: 'Amina Bouzid', phone: '0555123478' }, items: [{ productId: b.id, quantity: 2 }], paymentMethod: 'cash', amountPaid: Math.round(b.price / 2) }));
const s3 = await soft(call('POST', '/sales', T, { client: { name: 'Yacine Merabet', phone: '0770998877' }, items: [{ productId: c.id, quantity: 1 }], paymentMethod: 'ccp', amountPaid: 0 }));
if (s3) await soft(call('POST', `/sales/${s3.id}/payments`, T, { amount: s3.total, method: 'ccp' }));

// manual cash rows: opening deposit, fuel
await soft(call('POST', '/cash', T, { type: 'income', amount: 20000, category: 'deposit', method: 'cash', description: 'Apport ouverture' }));
await soft(call('POST', '/cash', T, { type: 'expense', amount: 1500, category: 'shipping', method: 'cash', description: 'Carburant livraison' }));

// a cross-sell rule and a stock-recommendation run (rate limited 1 / 10 min)
await soft(call('POST', '/recommendations', T, { productId: a.id, recommendedId: b.id, type: 'cross_sell', score: 80, reason: 'Souvent achetés ensemble' }));
await soft(call('POST', '/stock-recommendations/generate', T));

console.log(`demo stock ready: 3 suppliers, 4 purchases, ${[s1, s2, s3].filter(Boolean).length} sales, 2 manual cash rows`);
