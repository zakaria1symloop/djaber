// M2 — product search ignores accents and case (CAT-08): "theiere" finds "Théière".
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { createProduct } from '../support/m2';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

it('GET /products?q= is accent- and case-insensitive on the name', async () => {
  const owner = await asOwner(app);
  await createProduct(owner, { name: 'Théière émaillée' });
  await createProduct(owner, { name: 'Robe satin' });
  for (const q of ['theiere', 'THÉIÈRE', 'emaillee', 'Théi']) {
    const r = await owner.get(`/products?q=${encodeURIComponent(q)}`);
    expect(r.status).toBe(200);
    expect(r.body.data.map((p: { name: string }) => p.name)).toEqual(['Théière émaillée']);
  }
  const none = await owner.get('/products?q=cafetiere');
  expect(none.body.data).toEqual([]);
});

it('DELETE /categories/:id?reassignTo=none moves its products to "no category" (CAT-04 reassign dialog)', async () => {
  const owner = await asOwner(app);
  const cat = await owner.post('/categories', { name: 'Robes' });
  expect(cat.status).toBe(201);
  const p = await createProduct(owner, { name: 'Robe lin', categoryId: cat.body.data.id });
  expect((await owner.delete(`/categories/${cat.body.data.id}`)).status).toBe(409);
  expect((await owner.delete(`/categories/${cat.body.data.id}?reassignTo=none`)).status).toBe(204);
  const after = await owner.get(`/products/${p.id}`);
  expect(after.body.data.category ?? null).toBeNull();
});
