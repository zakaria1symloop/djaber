// Helpers of the M6 suites: courier accounts through the API, confirmed orders, sending through the API
// (Idempotency-Key), the fake courier backend (scripting: 503, validation errors, status sequences), the worker side
// run synchronously (`drain`). Nothing here talks to a courier: COURIER_DRIVER=fake (global-setup) + `forbidNetwork`.
import { CourierAdapters } from '../../src/modules/delivery/adapters/courier-registry';
import type { FakeCourierBackend } from '../../src/modules/delivery/adapters/fake-courier';
import { ProcessorRegistry } from '../../src/core/queue/processor.registry';
import type { Actor } from './actors';
import type { TestApp } from './app';
import { drain } from './m2';
import { db, idem, newOrder, status } from './m5';

export const fakeCourier = (app: TestApp): FakeCourierBackend => {
  const adapters = app.app.get(CourierAdapters);
  if (adapters.driver !== 'fake') throw new Error('tests must run with the fake courier driver');
  return adapters.fake;
};

export const CREDS = {
  zrexpress: { token: 'zr-token-123456', key: 'zr-key-abcdef' },
  ecotrack: { baseUrl: 'https://boutique.ecotrack.dz', token: 'eco-token-987654' },
  yalidine: { apiId: 'yal-id-112233', apiToken: 'yal-token-445566' },
} as const;

/** `POST /delivery/couriers` with valid fake credentials (unique per workspace + provider). */
export const addCourier = async (actor: Actor, provider: keyof typeof CREDS = 'zrexpress', over: Record<string, unknown> = {}) => {
  const res = await actor.post('/delivery/couriers', { provider, credentials: CREDS[provider], sender: { name: 'Boutique Test', phone: '0555123456', address: 'Rue Didouche Mourad, Alger', wilayaId: 16 }, ...over });
  if (res.status !== 201) throw new Error(`courier creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as Record<string, any>;
};

/** A `confirmed` order (address of support/m5 `address()`: Alger, Bab Ezzouar, home delivery). */
export const confirmedOrder = async (actor: Actor, over: Record<string, unknown> = {}) => {
  const { order, product } = await newOrder(actor, over);
  const res = await status(actor, order, 'confirmed').expect(200);
  return { order: res.body.data as Record<string, any>, product };
};

/** The send dialog body prefilled from the order (DLV-05). */
export const sendBody = (order: Record<string, any>, over: Record<string, unknown> = {}) => ({
  wilayaId: order.address.wilayaId,
  communeId: order.address.communeId,
  communeText: order.address.communeId ? null : order.address.communeText,
  address: order.address.address,
  isStopdesk: order.address.isStopdesk,
  stopdeskId: order.address.stopdeskId,
  ...over,
});

export const send = (actor: Actor, order: Record<string, any>, over: Record<string, unknown> = {}) => actor.post(`/orders/${order.id}/shipments`, sendBody(order, over)).set(idem());

/** Sends and runs the worker: returns the parcel after the courier call. */
export const sendAndWork = async (app: TestApp, actor: Actor, order: Record<string, any>, over: Record<string, unknown> = {}) => {
  const res = await send(actor, order, over).expect(202);
  await drain(app, actor.workspaceId);
  return (await actor.get(`/shipments/${res.body.data.id}`).expect(200)).body.data as Record<string, any>;
};

export const reloadOrder = async (actor: Actor, id: string) => (await actor.get(`/orders/${id}`).expect(200)).body.data as Record<string, any>;
export const shipmentRow = (id: string) => db.shipment.findUniqueOrThrow({ where: { id } });

/**
 * `sched-tracking-sync`, synchronously. Its batch jobs have deterministic ids per 10-min slot (`track:<account>:<slot>:<n>`);
 * the processed ones of earlier runs are forgotten so that several runs inside one slot each schedule their batches.
 */
export const runTrackingScheduler = async (app: TestApp) => {
  const task = app.app.get(ProcessorRegistry).crons.find((c) => c.name === 'sched-tracking-sync');
  if (!task) throw new Error('sched-tracking-sync not registered');
  await db.outbox.deleteMany({ where: { topic: 'job', key: { startsWith: 'track:' }, processedAt: { not: null } } });
  return task.handler();
};

/** Makes a parcel due for the next scheduler run. */
export const makeDue = (id: string) => db.shipment.update({ where: { id }, data: { nextSyncAt: new Date(Date.now() - 1000) } });

export { db, drain, idem };
