// M2 exit criterion (00-build-order, 07-non-functional): products list p95 < 500 ms on 10 000 products.
// Kept in its own file so it can be run alone:  pnpm --filter @djaber/api exec jest --config jest.int.config.cjs test/m2/products-perf
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { db } from '../support/m2';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

const WORDS = ['Robe', 'Chemise', 'Sac', 'Montre', 'Parfum', 'Tapis', 'Lampe', 'Basket', 'Veste', 'Bracelet', 'Théière', 'Coussin'];
const p95 = (ms: number[]) => [...ms].sort((a, b) => a - b)[Math.ceil(ms.length * 0.95) - 1]!;

describe('GET /products at 10 000 products', () => {
  it('p95 < 500 ms across filters, search, sorts and deep pages', async () => {
    const owner = await asOwner(app);
    const noise = await asOwner(app); // another tenant with its own rows in the same tables
    const categories = await db.category.createManyAndReturn({ data: Array.from({ length: 20 }, (_, i) => ({ workspaceId: owner.workspaceId, name: `Rayon ${i}` })) });
    const rows = (workspaceId: string, n: number, withCategory: boolean) =>
      Array.from({ length: n }, (_, i) => ({
        workspaceId,
        sku: `SKU-${String(i).padStart(5, '0')}`,
        name: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]!.toLowerCase()} n°${i}`,
        description: `Description du produit ${i}`,
        categoryId: withCategory ? categories[i % categories.length]!.id : null,
        price: 500 + ((i * 37) % 20000),
        costPrice: i % 3 === 0 ? null : 300 + ((i * 17) % 9000),
        stock: i % 11 === 0 ? null : (i * 13) % 60,
        trackStock: i % 11 !== 0,
        minStock: i % 5,
        isActive: i % 9 !== 0,
        keywords: [`mot${i % 50}`, 'catalogue'],
        moderationStatus: 'approved' as const,
      }));
    for (let i = 0; i < 10; i++) await db.product.createMany({ data: rows(owner.workspaceId, 10_000, true).slice(i * 1000, (i + 1) * 1000) });
    await db.product.createMany({ data: rows(noise.workspaceId, 2_000, false) });
    await db.$executeRawUnsafe('ANALYZE "Product"');

    const first = await owner.get('/products').expect(200);
    expect(first.body.meta).toMatchObject({ total: 10_000, page: 1, pageSize: 25 });
    expect(first.body.data).toHaveLength(25);

    const queries = [
      '',
      'sort=name',
      'sort=-price&pageSize=100',
      'sort=sku&page=200&pageSize=50',
      'sort=-stock',
      'sort=cost&page=40',
      'q=montre',
      'q=SKU-0123',
      'q=bracelt', // typo-tolerant search (trigram word similarity)
      'q=mot42&sort=name',
      `categoryIds=${categories[3]!.id},${categories[7]!.id}`,
      'status=inactive&sort=name',
      'type=service',
      'stockState=low&sort=-stock',
      'stockState=out',
      'lowStock=1&active=1',
      'minPrice=1000&maxPrice=5000&sort=price',
      'minMargin=20&maxMargin=60&sort=-price',
      'minQty=10&maxQty=30&minCost=500',
      'noAgent=1&moderationStatus=approved&sort=-updatedAt&page=100&pageSize=100',
    ];
    const timings: number[] = [];
    for (let round = 0; round < 3; round++) {
      for (const qs of queries) {
        const started = performance.now();
        const res = await owner.get(`/products?${qs}`).expect(200);
        timings.push(performance.now() - started);
        expect(res.body.meta.total).toBeGreaterThan(0);
      }
    }
    const result = { requests: timings.length, p50: Math.round(p95(timings.slice().sort((a, b) => a - b).slice(0, Math.ceil(timings.length / 2)))), p95: Math.round(p95(timings)), max: Math.round(Math.max(...timings)) };
    console.log('products list @10k', result);
    expect(result.p95).toBeLessThan(500);

    // tenancy holds under load: the other workspace only ever sees its 2 000 rows
    expect((await noise.get('/products?q=montre').expect(200)).body.meta.total).toBeLessThanOrEqual(2000);
    expect((await noise.get('/products').expect(200)).body.meta.total).toBe(2000);
    // the stock dashboard and the alert list stay fast too
    for (const path of ['/stock/overview', '/products/low-stock']) {
      const started = performance.now();
      await owner.get(path).expect(200);
      expect(performance.now() - started).toBeLessThan(1500);
    }
  }, 180_000);
});
