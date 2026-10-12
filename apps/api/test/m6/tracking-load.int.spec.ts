// M6 exit criterion (00-build-order §2 M6): tracking sync of 10 k shipments in one batch run within the per-account
// limiter budget — fake Yalidine driver (batch endpoint, ≤ 50 trackings per call), limiter set to 50 calls / s here.
import { TenantContext } from '@djaber/db';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { forbidNetwork } from '../support/m3';
import { closeOutbox } from '../support/m4';
import { seedFees } from '../support/m5';
import { addCourier, confirmedOrder, CREDS, db, drain, fakeCourier, runTrackingScheduler } from '../support/m6';

const BUDGET_RPS = 50;
const N = 10_000;
let app: TestApp;
let net: ReturnType<typeof forbidNetwork>;
beforeAll(async () => {
  process.env.COURIER_TRACK_RPS = String(BUDGET_RPS);
  app = await createTestApp();
  net = forbidNetwork();
}, 120_000);
afterAll(async () => {
  expect(net.spy).not.toHaveBeenCalled();
  net.restore();
  process.env.COURIER_TRACK_RPS = '1000';
  await closeOutbox();
  await app.close();
});

it('AT-DLV-05 10 000 parcels synced in one scheduler run: 200 batch calls of ≤ 50, never more than the budget per second', async () => {
  const owner = await asOwner(app);
  await seedFees(app, owner.workspaceId);
  const courier = await addCourier(owner, 'yalidine');
  const { order } = await confirmedOrder(owner);
  const ws = owner.workspaceId;
  await db.$executeRaw`
    INSERT INTO "Order" ("id","workspaceId","number","clientId","source","status","confirmationStatus","deliveryStatus","clientName","clientPhone","wilayaId","communeText","address","subtotal","deliveryFee","total","confirmedAt","shippedAt","updatedAt")
    SELECT uuid_generate_v7(), ${ws}::uuid, 'LOAD-' || g, ${order.client.id}::uuid, 'manual', 'shipped', 'confirmed', 'sent', 'Client charge', '0555000000', 16, 'Bab Ezzouar', 'Cité 200 logements, Bt 4', 1000, 400, 1400, now(), now(), now()
    FROM generate_series(1, ${N}) g`;
  await db.$executeRaw`
    INSERT INTO "Shipment" ("id","workspaceId","orderId","provider","courierAccountId","status","rawStatus","trackingNumber","publicTrackingToken","codAmount","lastEventAt","nextSyncAt","createdAt","updatedAt")
    SELECT uuid_generate_v7(), ${ws}::uuid, o."id", 'yalidine', ${courier.id}::uuid, 'sent', 'En préparation', 'YLOAD-' || o."number", md5(o."id"::text), 1400, now(), now() - interval '1 minute', now(), now()
    FROM "Order" o WHERE o."workspaceId" = ${ws}::uuid AND o."number" LIKE 'LOAD-%'`;
  const fake = fakeCourier(app);
  const rows = await db.shipment.findMany({ where: { workspaceId: ws, trackingNumber: { startsWith: 'YLOAD-' } }, select: { trackingNumber: true } });
  expect(rows).toHaveLength(N);
  const before = new Date(Date.now() - 3_600_000);
  rows.forEach((r, i) => fake.seed('yalidine', CREDS.yalidine, r.trackingNumber!, i % 100 === 0 ? 'Livré' : 'En préparation', i % 100 === 0 ? new Date() : before));
  fake.reset();

  const sched = (await runTrackingScheduler(app)) as { due: number; jobs: number };
  expect(sched).toMatchObject({ due: N, jobs: N / 50 });
  const t0 = Date.now();
  await TenantContext.runSystem(() => drain(app, ws));
  const elapsed = Date.now() - t0;

  const calls = fake.callsOf('track', 'yalidine');
  expect(calls).toHaveLength(N / 50);
  expect(Math.max(...calls.map((c) => c.count))).toBeLessThanOrEqual(50);
  const perSecond = new Map<number, number>();
  for (const c of calls) perSecond.set(Math.floor(c.at / 1000), (perSecond.get(Math.floor(c.at / 1000)) ?? 0) + 1);
  expect(Math.max(...perSecond.values())).toBeLessThanOrEqual(BUDGET_RPS);
  expect(elapsed).toBeGreaterThanOrEqual(((N / 50) / BUDGET_RPS - 1) * 1000);

  expect(await db.shipment.count({ where: { workspaceId: ws, trackingNumber: { startsWith: 'YLOAD-' }, lastSyncedAt: null } })).toBe(0);
  expect(await db.shipment.count({ where: { workspaceId: ws, trackingNumber: { startsWith: 'YLOAD-' }, status: 'delivered' } })).toBe(N / 100);
  expect(await db.order.count({ where: { workspaceId: ws, number: { startsWith: 'LOAD-' }, status: 'delivered' } })).toBe(N / 100);
  // the next run finds nothing due (cadence 2 h)
  expect(((await runTrackingScheduler(app)) as { due: number }).due).toBe(0);
}, 600_000);
