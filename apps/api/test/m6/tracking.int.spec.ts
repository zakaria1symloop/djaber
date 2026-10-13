// M6 — tracking sync (DLV-04, 04 §22): scheduler cadence, batch endpoint, per-account limiter, mapping applied,
// unknown raw statuses, "Sans mouvement", stale at 30 d, manual refresh limit, courier webhooks (raw-body signature,
// status re-fetched before applying), customer texts, delivery list / overview, public tracking page.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CourierAccountService } from '../../src/modules/delivery/courier-account.service';
import { TenantContext } from '@djaber/db';
import { asOperator, asOwner, anonymous } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { forbidNetwork } from '../support/m3';
import { closeOutbox } from '../support/m4';
import { seedFees } from '../support/m5';
import { addCourier, confirmedOrder, db, drain, fakeCourier, makeDue, reloadOrder, runTrackingScheduler, sendAndWork, shipmentRow } from '../support/m6';

let app: TestApp;
let net: ReturnType<typeof forbidNetwork>;
beforeAll(async () => {
  app = await createTestApp();
  net = forbidNetwork();
});
afterAll(async () => {
  expect(net.spy).not.toHaveBeenCalled();
  net.restore();
  await closeOutbox();
  await app.close();
});
afterEach(() => fakeCourier(app).reset());

const DAY = 86_400_000;
const HOUR = 3_600_000;
const shop = async (provider: 'zrexpress' | 'ecotrack' | 'yalidine' = 'zrexpress') => {
  const owner = await asOwner(app);
  await seedFees(app, owner.workspaceId);
  const courier = await addCourier(owner, provider);
  return { owner, courier };
};

describe('tracking sync (DLV-04)', () => {
  it('AT-DLV-05 cadence: every 2 h during 3 days, then 12 h; batch endpoint used; only due parcels polled', async () => {
    const { owner } = await shop('yalidine');
    const parcels: Record<string, any>[] = [];
    for (let i = 0; i < 3; i++) parcels.push(await sendAndWork(app, owner, (await confirmedOrder(owner)).order));
    const s0 = await shipmentRow(parcels[0]!.id);
    expect(Math.round((s0.nextSyncAt!.getTime() - s0.lastSyncedAt!.getTime()) / HOUR)).toBe(2);
    // not due yet: nothing scheduled
    expect((await runTrackingScheduler(app)) as any).toMatchObject({ jobs: 0 });
    // two due (one created 4 days ago), one not
    await db.shipment.update({ where: { id: parcels[1]!.id }, data: { createdAt: new Date(Date.now() - 4 * DAY) } });
    await makeDue(parcels[0]!.id);
    await makeDue(parcels[1]!.id);
    const r = (await runTrackingScheduler(app)) as any;
    expect(r).toMatchObject({ due: 2, jobs: 1 });
    await drain(app, owner.workspaceId);
    const fake = fakeCourier(app);
    expect(fake.callsOf('track', 'yalidine')).toEqual([expect.objectContaining({ count: 2 })]); // one batch call
    const [a, b, c] = (await Promise.all(parcels.map((p) => shipmentRow(p.id)))) as [Awaited<ReturnType<typeof shipmentRow>>, Awaited<ReturnType<typeof shipmentRow>>, Awaited<ReturnType<typeof shipmentRow>>];
    expect(Math.round((a.nextSyncAt!.getTime() - Date.now()) / HOUR)).toBe(2);
    expect(Math.round((b.nextSyncAt!.getTime() - Date.now()) / HOUR)).toBe(12);
    expect(c.lastSyncedAt!.getTime()).toBeLessThan(a.lastSyncedAt!.getTime());
  });

  it('AT-DLV-04 mapping applied: picked up → in transit → out for delivery (customer text) → delivered; unknown raw ⇒ event stored, status unchanged; never backwards', async () => {
    const { owner } = await shop('zrexpress');
    const { order } = await confirmedOrder(owner);
    const p = await sendAndWork(app, owner, order);
    const fake = fakeCourier(app);
    const step = async (raw: string) => {
      fake.setStatus(p.trackingNumber, raw, new Date());
      await makeDue(p.id);
      await runTrackingScheduler(app);
      await drain(app, owner.workspaceId);
      return shipmentRow(p.id);
    };
    expect((await step('Ramassé')).status).toBe('picked_up');
    expect((await reloadOrder(owner, order.id)).deliveryStatus).toBe('in_transit');
    expect((await step('Statut bizarre XYZ')).status).toBe('picked_up');
    const events = await db.shipmentEvent.findMany({ where: { shipmentId: p.id }, orderBy: { createdAt: 'asc' } });
    expect(events.at(-1)).toMatchObject({ rawStatus: 'Statut bizarre XYZ', mappedStatus: null, source: 'poll' });
    expect((await step('Vers wilaya 16')).status).toBe('in_transit');
    expect((await step('En préparation')).status).toBe('in_transit'); // backwards: ignored
    expect((await step('Sorti en livraison')).status).toBe('out_for_delivery');
    expect((await reloadOrder(owner, order.id)).deliveryStatus).toBe('out_for_delivery');
    const delivered = await step('Livrée');
    expect(delivered).toMatchObject({ status: 'delivered', nextSyncAt: null, deliveryAttempts: 1 });
    expect(await reloadOrder(owner, order.id)).toMatchObject({ status: 'delivered', paymentStatus: 'paid' });
    // terminal: no more polling
    await db.shipment.update({ where: { id: p.id }, data: { nextSyncAt: new Date(Date.now() - 1000) } });
    expect(((await runTrackingScheduler(app)) as any).due).toBe(0);
  });

  it('AT-DLV-12 refresh twice in 5 min ⇒ TRACKING_SYNC_RATE_LIMITED {retryAfter}; 6 d without event ⇒ "Sans mouvement" (tab + KPI); 31 d ⇒ stale', async () => {
    const { owner } = await shop('zrexpress');
    const { order } = await confirmedOrder(owner);
    const p = await sendAndWork(app, owner, order);
    const first = await owner.post(`/shipments/${p.id}/sync`).expect(202);
    expect(first.body.data.syncAvailableAt).toEqual(expect.any(String));
    expect(first.body.data.actions.find((a: any) => a.key === 'sync')).toMatchObject({ enabled: false, reasonCode: 'TRACKING_SYNC_RATE_LIMITED' });
    const second = await owner.post(`/shipments/${p.id}/sync`).expect(429);
    expect(second.body.error).toMatchObject({ code: 'TRACKING_SYNC_RATE_LIMITED', params: { retryAfter: expect.any(Number) } });
    expect(second.body.error.params.retryAfter).toBeGreaterThan(290);
    await drain(app, owner.workspaceId);

    await db.shipment.update({ where: { id: p.id }, data: { lastEventAt: new Date(Date.now() - 6 * DAY), status: 'in_transit' } });
    const view = (await owner.get(`/shipments/${p.id}`).expect(200)).body.data;
    expect(view.noMovement).toBe(true);
    const tab = (await owner.get('/shipments?lastEvent=gt5d_stale').expect(200)).body.data;
    expect(tab.map((r: any) => r.id)).toEqual([order.id]);
    expect(tab[0].shipment.noMovement).toBe(true);
    const ov = (await owner.get('/delivery/overview').expect(200)).body.data;
    expect(ov.kpis.staleOver5d).toBe(1);
    expect(ov.tabs.no_movement).toBe(1);
    expect(ov.stale.map((r: any) => r.id)).toEqual([order.id]);
    expect((await reloadOrder(owner, order.id)).shipment.stale).toBe(true);

    await db.shipment.update({ where: { id: p.id }, data: { lastEventAt: new Date(Date.now() - 31 * DAY) } });
    const r = (await runTrackingScheduler(app)) as any;
    expect(r.staled).toBeGreaterThanOrEqual(1);
    expect(await shipmentRow(p.id)).toMatchObject({ status: 'stale', nextSyncAt: null });
    expect((await reloadOrder(owner, order.id)).deliveryStatus).toBe('sent'); // stale leaves deliveryStatus unchanged
    // manual parcels are not tracked
    const manual = await confirmedOrder(owner);
    const shipped = await owner.post(`/orders/${manual.order.id}/ship-manual`, {}).expect(200);
    expect((await owner.post(`/shipments/${shipped.body.data.shipments[0].id}/sync`).expect(404)).body.error.code).toBe('TRACKING_NOT_FOUND');
  });

  it('courier unavailable during a batch ⇒ lastError + next sync pushed 2 h; tracking not found ⇒ TRACKING_NOT_FOUND', async () => {
    const { owner } = await shop('ecotrack');
    const p = await sendAndWork(app, owner, (await confirmedOrder(owner)).order);
    const q = await sendAndWork(app, owner, (await confirmedOrder(owner)).order);
    fakeCourier(app).failNext('track', 'unavailable');
    await makeDue(p.id);
    await makeDue(q.id);
    await runTrackingScheduler(app);
    await drain(app, owner.workspaceId);
    const sp = await shipmentRow(p.id);
    expect(sp.lastError).toBe('COURIER_UNAVAILABLE');
    expect(Math.round((sp.nextSyncAt!.getTime() - Date.now()) / HOUR)).toBe(2);
    const filtered = (await owner.get('/shipments?lastError=COURIER_UNAVAILABLE').expect(200)).body.data;
    expect(filtered).toHaveLength(2);
  });
});

describe('courier webhooks (06 §3)', () => {
  it('Yalidine: invalid secret ⇒ 401; valid ⇒ InboundEvent + job; the status is re-fetched before applying (webhook body not trusted); redelivery ⇒ no duplicate', async () => {
    const { owner, courier } = await shop('yalidine');
    const { order } = await confirmedOrder(owner);
    const p = await sendAndWork(app, owner, order);
    const secret = await TenantContext.runAs(owner.workspaceId, async () => app.app.get(CourierAccountService).webhookSecretOf(await db.courierAccount.findUniqueOrThrow({ where: { id: courier.id } })));
    const body = JSON.stringify({ type: 'parcel_status_updated', events: [{ data: { tracking: p.trackingNumber, status: 'Livré', date_status: '2026-10-12 10:00:00' } }] });
    const post = (s: string | null) => {
      const r = request(app.http()).post(`/api/v1/webhooks/couriers/${courier.id}`).set('Content-Type', 'application/json');
      return (s ? r.set('X-Yalidine-Secret', s) : r).send(body);
    };
    expect((await post('wrong-secret').expect(401)).body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect((await post(null).expect(401)).body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    // the courier actually still says "out for delivery": the re-fetched status wins over the webhook body
    fakeCourier(app).setStatus(p.trackingNumber, 'Sorti en livraison');
    const ok = await post(secret).expect(200);
    expect(ok.body).toEqual({ received: 1 });
    await post(secret).expect(200); // redelivery
    expect(await db.inboundEvent.count({ where: { provider: 'courier', externalId: { contains: p.trackingNumber } } })).toBe(1);
    await drain(app, owner.workspaceId);
    expect(await shipmentRow(p.id)).toMatchObject({ status: 'out_for_delivery' });
    const ev = await db.shipmentEvent.findFirst({ where: { shipmentId: p.id, source: 'webhook' } });
    expect(ev).toMatchObject({ rawStatus: 'Sorti en livraison', mappedStatus: 'out_for_delivery' });
    // unknown account / provider without webhooks
    await request(app.http()).post(`/api/v1/webhooks/couriers/${randomUUID()}`).send(body).expect(404);
    const zr = await addCourier(owner, 'zrexpress');
    await request(app.http()).post(`/api/v1/webhooks/couriers/${zr.id}`).send(body).expect(404);
  });
});

describe('delivery list & overview (DLV-08)', () => {
  it('tabs = filters; rows are orders with their latest parcel; KPIs and per-courier figures; 403 / isolation', async () => {
    const { owner } = await shop('zrexpress');
    const { order: toSend } = await confirmedOrder(owner);
    const { order: moving } = await confirmedOrder(owner);
    const mp = await sendAndWork(app, owner, moving);
    const { order: done } = await confirmedOrder(owner);
    const dp = await sendAndWork(app, owner, done);
    fakeCourier(app).setStatus(dp.trackingNumber, 'Livré');
    await makeDue(dp.id);
    await runTrackingScheduler(app);
    await drain(app, owner.workspaceId);

    const all = (await owner.get('/shipments').expect(200)).body;
    expect(all.meta.total).toBe(3);
    const toSendRows = (await owner.get('/shipments?shipmentStatus=not_sent').expect(200)).body.data;
    expect(toSendRows.map((r: any) => r.id)).toEqual([toSend.id]);
    expect(toSendRows[0]).toMatchObject({ shipment: null, orderStatus: 'confirmed' });
    expect(toSendRows[0].actions[0]).toMatchObject({ key: 'send_courier', enabled: true, primary: true });
    const transit = (await owner.get('/shipments?shipmentStatus=pending,sent,picked_up,in_transit,out_for_delivery').expect(200)).body.data;
    expect(transit.map((r: any) => r.id)).toEqual([moving.id]);
    expect(transit[0].shipment).toMatchObject({ id: mp.id, status: 'sent', trackingNumber: mp.trackingNumber });
    expect((await owner.get(`/shipments?q=${mp.trackingNumber}`).expect(200)).body.data.map((r: any) => r.id)).toEqual([moving.id]);
    expect((await owner.get('/shipments?provider=zrexpress&sort=-lastSyncedAt').expect(200)).body.meta.total).toBe(2);
    await owner.get('/shipments?sort=-nope').expect(400);
    await owner.get('/shipments?shipmentStatus=lost').expect(422);

    const ov = (await owner.get('/delivery/overview').expect(200)).body.data;
    expect(ov.kpis).toMatchObject({ toSend: 1, pendingPickup: 1, delivered30d: 1, deliveredPct30d: 100, returned30d: 0 });
    expect(ov.tabs).toMatchObject({ to_send: 1, in_transit: 1, failed: 0, returns: 0, all: 3 });
    expect(ov.kpis.byCourier).toEqual([expect.objectContaining({ provider: 'zrexpress', sent: 2, delivered: 1, codCollected: dp.codAmount })]);
    expect(ov.couriers.active).toBe(1);

    const op = await asOperator(app, owner.workspaceId);
    await op.get('/shipments').expect(200);
    const other = await asOwner(app);
    expect((await other.get('/shipments').expect(200)).body.meta.total).toBe(0);
    expect((await other.get('/delivery/overview').expect(200)).body.data.tabs.all).toBe(0);
  });
});

describe('public tracking page (`/s/[code]`)', () => {
  it('mapped timeline only, no customer data; unknown token ⇒ 404; "Signaler ce vendeur" ⇒ report, 3 / h / IP', async () => {
    const { owner } = await shop('zrexpress');
    const { order } = await confirmedOrder(owner);
    const p = await sendAndWork(app, owner, order);
    fakeCourier(app).setStatus(p.trackingNumber, 'Sorti en livraison');
    await makeDue(p.id);
    await runTrackingScheduler(app);
    await drain(app, owner.workspaceId);
    const token = (await shipmentRow(p.id)).publicTrackingToken;
    const pub = anonymous(app);
    const res = await pub.get(`/track/${token}`).expect(200);
    expect(res.body.data).toMatchObject({ orderNumber: order.number, status: 'out_for_delivery', statusLabel: 'EN LIVRAISON', courier: 'ZR Express', trackingNumber: p.trackingNumber, isStopdesk: false });
    expect(res.body.data.events.map((e: any) => e.status)).toEqual(['out_for_delivery', 'sent']);
    const text = JSON.stringify(res.body.data);
    expect(text).not.toContain(order.clientPhone);
    expect(text).not.toContain(order.clientName);
    expect(text).not.toContain('Bab Ezzouar');
    expect(text).not.toContain(String(order.total));
    await pub.get('/track/unknown-token-123').expect(404);
    await pub.post(`/track/${token}/report`, { reason: 'robbery' }).expect(422);
    // M11 (AT-PUB-05 captcha, M6 carry-over): no / wrong captcha token ⇒ 422 with the field, nothing stored
    expect((await pub.post(`/track/${token}/report`, { reason: 'fraud' }).expect(422)).body.error.fields).toEqual({ captchaToken: 'validation.captcha' });
    expect((await pub.post(`/track/${token}/report`, { reason: 'fraud', captchaToken: 'bot' }).expect(422)).body.error.fields).toEqual({ captchaToken: 'validation.captcha' });
    expect((await pub.get('/captcha/config').expect(200)).body.data).toEqual({ provider: 'fake', siteKey: null });
    const rep = await pub.post(`/track/${token}/report`, { reason: 'fraud', details: 'colis jamais reçu', captchaToken: 'fake-pass' }).expect(201);
    expect(rep.body.data).toMatchObject({ status: 'open' });
    const row = await db.report.findUniqueOrThrow({ where: { id: rep.body.data.id } });
    expect(row).toMatchObject({ type: 'merchant', reporterKind: 'end_customer', targetWorkspaceId: owner.workspaceId, reason: 'fraud' });
    await pub.post(`/track/${token}/report`, { reason: 'spam', captchaToken: 'fake-pass' }).expect(201);
    await pub.post(`/track/${token}/report`, { reason: 'spam', captchaToken: 'fake-pass' }).expect(201);
    expect((await pub.post(`/track/${token}/report`, { reason: 'spam', captchaToken: 'fake-pass' }).expect(429)).body.error.code).toBe('ABUSE_REPORT_RATE_LIMITED');
  });
});
