// M11 — AT-BIL-01 "order payment variant" (PAY-02…04 built in M9, verified here end to end with the M11 integrations):
// order payment link webhook unsigned ⇒ 401; signed twice ⇒ one payment, one cash row; the paid order reaches the outbound
// webhook (`order.paid`) and the Google Sheets row; a failed link emits `payment.failed` to the merchant's endpoint.
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { cashOf, newOrder, seedFees } from '../support/m5';
import { checkoutIdOf, fakeChargily, postChargilyWebhook, runPayments } from '../support/m9';
import { connectSheets, db, localNetworkOnly, receiver, sheetRows, syncSheets, work, type Receiver } from '../support/m11';

let app: TestApp;
let net: ReturnType<typeof localNetworkOnly>;
let r: Receiver;
beforeAll(async () => {
  app = await createTestApp();
  net = localNetworkOnly();
  r = await receiver();
});
afterAll(async () => {
  net.restore();
  await r.close();
  await app.close();
});

it('AT-BIL-01 (order payment link) unsigned ⇒ 401; signed twice ⇒ one paid payment + one cash row; order.paid webhook + Sheets row; failed ⇒ payment.failed webhook', async () => {
  const owner = await asOwner(app);
  await seedFees(app, owner.workspaceId);
  await owner.patch('/workspace', { onlinePaymentEnabled: true }).expect(200);
  await owner.post('/webhooks', { url: r.url, events: ['order.paid', 'payment.failed'] }).expect(201);
  await connectSheets(app, owner);
  const sheet = (await owner.put('/integrations/google-sheets', { createNew: true }).expect(200)).body.data;

  const { order } = await newOrder(owner);
  await owner.post(`/orders/${order.id}/payment-link`, { send: false }).expect(201);
  await runPayments(app, [owner.workspaceId]);
  const link = (await owner.get(`/orders/${order.id}/payment-link`).expect(200)).body.data;
  const decided = await fakeChargily(app).decide(checkoutIdOf(link.url), 'paid');
  await postChargilyWebhook(app, decided!.webhook!.rawBody, null).expect(401);
  await postChargilyWebhook(app, decided!.webhook!.rawBody, decided!.webhook!.signature).expect(200);
  await postChargilyWebhook(app, decided!.webhook!.rawBody, decided!.webhook!.signature).expect(200);
  await runPayments(app, [owner.workspaceId]);
  expect(await db.orderPayment.count({ where: { orderId: order.id, status: 'paid' } })).toBe(1);
  expect(await cashOf(order.id)).toHaveLength(1);
  expect((await owner.get(`/orders/${order.id}`).expect(200)).body.data).toMatchObject({ paymentStatus: 'paid', amountPaid: order.total });

  await work(app, [owner.workspaceId]);
  const paid = r.hits.map((h) => JSON.parse(h.body)).filter((b) => b.event === 'order.paid');
  expect(paid).toHaveLength(1);
  expect(paid[0].data).toMatchObject({ order: { id: order.id, paymentStatus: 'paid' }, method: 'card' });
  await syncSheets(app, owner.workspaceId);
  expect((await sheetRows(app, sheet.spreadsheetId)).find((x) => x[17] === order.id)).toBeDefined();

  const { order: second } = await newOrder(owner);
  await owner.post(`/orders/${second.id}/payment-link`, { send: false }).expect(201);
  await runPayments(app, [owner.workspaceId]);
  const l2 = (await owner.get(`/orders/${second.id}/payment-link`).expect(200)).body.data;
  const failed = await fakeChargily(app).decide(checkoutIdOf(l2.url), 'failed');
  await postChargilyWebhook(app, failed!.webhook!.rawBody, failed!.webhook!.signature).expect(200);
  await runPayments(app, [owner.workspaceId]);
  await work(app, [owner.workspaceId]);
  const pf = r.hits.map((h) => JSON.parse(h.body)).find((b) => b.event === 'payment.failed');
  expect(pf.data).toMatchObject({ orderId: second.id, reason: 'failed' });
});
