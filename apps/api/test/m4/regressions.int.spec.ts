// Bugs found by the M4 web e2e on the real API (queue after an AI handoff, analysis import messages and categories).
import { Prisma } from '@djaber/db';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { connectedPage, db, newSender, receive } from '../support/m3';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

it('queue (needs_human, oldestWaiting) lists a handed-over thread whose last message is the AI handoff text', async () => {
  const owner = await asOwner(app);
  const page = await connectedPage(owner, app);
  const { conversation } = await receive(app, page, newSender(), { text: 'je veux parler à un humain' });
  // what the AI handoff leaves behind: status needs_human, the last message is outbound
  await db.conversation.update({
    where: { id: conversation.id },
    data: { status: 'needs_human', context: { ...(conversation.context as Prisma.JsonObject), lastDirection: 'out' } },
  });
  const queue = await owner.get('/conversations?status=needs_human&sort=oldestWaiting').expect(200);
  expect(queue.body.data.map((c: { id: string }) => c.id)).toContain(conversation.id);
  // the general "waiting for an answer" sort still only shows threads where the customer spoke last
  const waiting = await owner.get('/conversations?sort=oldestWaiting').expect(200);
  expect(waiting.body.data.map((c: { id: string }) => c.id)).not.toContain(conversation.id);
});

it('analysis import creates unknown categories and reports refused rows with a translated message', async () => {
  const owner = await asOwner(app, 'free'); // free plan: 50 products
  const page = await connectedPage(owner, app);
  const ok = await owner
    .post(`/channels/${page.id}/analysis/import`, { items: [{ name: 'Robe brodée', price: 5200, quantity: 2, category: 'Tenues de fête' }] })
    .expect((r) => expect([200, 201]).toContain(r.status));
  expect(ok.body.data.created).toHaveLength(1);
  const cat = await db.category.findFirst({ where: { workspaceId: owner.workspaceId, name: 'Tenues de fête', deletedAt: null } });
  expect(cat).not.toBeNull();
  const product = await db.product.findUniqueOrThrow({ where: { id: ok.body.data.created[0].productId } });
  expect(product.categoryId).toBe(cat!.id);

  // fill the plan, then a refused row carries the catalogue message, not the bare code
  await db.product.createMany({
    data: Array.from({ length: 60 }, (_, i) => ({ workspaceId: owner.workspaceId, name: `P${i}`, sku: `FILL-${i}`, price: 100 })) as never,
  });
  const refused = await owner
    .post(`/channels/${page.id}/analysis/import`, { items: [{ name: 'Sac rouge', price: 3000, quantity: 1 }] })
    .expect((r) => expect([200, 201]).toContain(r.status));
  expect(refused.body.data.failed).toHaveLength(1);
  const f = refused.body.data.failed[0];
  expect(f.code).toBe('PLAN_LIMIT');
  expect(f.message).not.toBe(f.code);
  expect(f.message).not.toMatch(/\{\w+\}/);
});
