// Helpers of the M5 suites: fee grid seeding, order creation through the API (Idempotency-Key), the fake push adapter,
// stock / cash readers. The worker side runs synchronously (support/m3 `work`, support/m1 `drainMail`).
import { randomUUID } from 'node:crypto';
import { rawPrisma as db, TenantContext, type Tx } from '@djaber/db';
import { FeeService } from '../../src/modules/delivery/fee.service';
import { FakePushGateway, PUSH_GATEWAY } from '../../src/modules/notifications/push/push.gateway';
import type { Actor } from './actors';
import type { TestApp } from './app';
import { createProduct } from './m2';

export const idem = () => ({ 'Idempotency-Key': randomUUID() });
let phoneSeq = 0;
/** A valid, unique Algerian mobile number for the run. */
export const phone = () => `05${String(Date.now()).slice(-6)}${String(++phoneSeq % 100).padStart(2, '0')}`;

/** The 58 default fee rows (what provisioning creates for a real sign-up). */
export const seedFees = async (app: TestApp, workspaceId: string) =>
  TenantContext.runAs(workspaceId, () => db.$transaction((tx) => app.app.get(FeeService).seedDefaults(tx as unknown as Tx, workspaceId)));

export const address = (over: Record<string, unknown> = {}) => ({ wilayaId: 16, communeText: 'Bab Ezzouar', isStopdesk: false, address: 'Cité 200 logements, Bt 4, Bab Ezzouar', ...over });

export const orderBody = (productId: string, over: Record<string, unknown> = {}) => ({
  client: { name: 'Amine Benali', phone: phone() },
  items: [{ productId, quantity: 1 }],
  delivery: address(),
  paymentMethod: 'cash',
  status: 'new',
  ...over,
});

export const postOrder = (actor: Actor, body: Record<string, unknown>) => actor.post('/orders', body).set(idem());

/** A product + a `new` order on it through `POST /orders`; returns the order view. */
export const newOrder = async (actor: Actor, over: Record<string, unknown> = {}, product?: { id: string }) => {
  const p = product ?? (await createProduct(actor, { name: `Robe ${randomUUID().slice(0, 4)}`, price: 4500, stock: 10 }));
  const res = await postOrder(actor, orderBody(p.id, over));
  if (res.status !== 201) throw new Error(`order creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { order: res.body.data as Record<string, any>, product: p };
};

export const status = (actor: Actor, order: { id?: string; version?: number } & Record<string, any>, to: string, extra: Record<string, unknown> = {}) => actor.post(`/orders/${order.id}/status`, { to, version: order.version, ...extra }).set(idem());

export const productStock = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;
export const movementsOf = (orderId: string) => db.stockMovement.findMany({ where: { refType: 'order', refId: orderId }, orderBy: { createdAt: 'asc' } });
export const cashOf = async (orderId: string) => {
  const entries = await db.paymentEntry.findMany({ where: { sourceType: 'order', sourceId: orderId } });
  const ids = entries.map((e) => e.cashTransactionId).filter((x): x is string => !!x);
  return db.cashTransaction.findMany({ where: { OR: [{ id: { in: ids } }, { sourceType: 'order', sourceId: orderId }] }, orderBy: { createdAt: 'asc' } });
};

export const fakePush = (app: TestApp): FakePushGateway => {
  const gateway = app.app.get(PUSH_GATEWAY);
  if (!(gateway instanceof FakePushGateway)) throw new Error('tests must run with the fake push adapter');
  return gateway;
};

export { db };
