// M6 — labels (DLV-06, 04 §22): courier label when offered (fetched by the worker), Djaber fallback (ZR Express ⇒
// LABEL_UNAVAILABLE), merged PDF job (orders without a parcel skipped with SHIPMENT_NOT_CREATED), thermal format,
// "bordereau imprimé" stamp; the product label sheet (M2 carry-over).
import { PDFDocument } from 'pdf-lib';
import { StorageService } from '../../src/core/storage/storage.service';
import { asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { createProduct, jobOf } from '../support/m2';
import { forbidNetwork } from '../support/m3';
import { closeOutbox } from '../support/m4';
import { seedFees } from '../support/m5';
import { addCourier, confirmedOrder, db, drain, fakeCourier, reloadOrder, sendAndWork, shipmentRow } from '../support/m6';

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

const MM = 72 / 25.4;
/** PDF behind a signed URL of the local storage driver (`/api/v1/files/<key>?exp&sig`). */
const pdfAt = async (url: string) => {
  const key = decodeURIComponent(new URL(url, 'http://x').pathname.replace(/^.*\/api\/v1\/files\//, ''));
  const { body } = await app.app.get(StorageService).get(key);
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  return PDFDocument.load(body);
};
const pdfOfJob = async (jobId: string) => {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const upload = await db.upload.findUniqueOrThrow({ where: { id: job.resultUploadId! } });
  const { body } = await app.app.get(StorageService).get(upload.storageKey);
  return PDFDocument.load(body);
};

describe('labels (DLV-06)', () => {
  it('AT-DLV-08 ZR Express ⇒ LABEL_UNAVAILABLE warning + Djaber fallback PDF (A6 / thermal); EcoTrack ⇒ the courier label', async () => {
    const owner = await asOwner(app);
    await seedFees(app, owner.workspaceId);
    await addCourier(owner, 'zrexpress');
    const p = await sendAndWork(app, owner, (await confirmedOrder(owner)).order);
    expect(p.labelSource).toBe('djaber');
    const res = await owner.get(`/shipments/${p.id}/label`).expect(200);
    expect(res.body.meta.warnings).toEqual([expect.objectContaining({ code: 'LABEL_UNAVAILABLE' })]);
    expect(res.body.data).toMatchObject({ source: 'djaber', format: 'a6', fileName: expect.stringMatching(/^CMD-\d+\.pdf$/) });
    const a6 = await pdfAt(res.body.data.url);
    expect(a6.getPageCount()).toBe(1);
    expect(Math.round(a6.getPage(0).getWidth() / MM)).toBe(105);
    const thermal = await owner.get(`/shipments/${p.id}/label?format=thermal`).expect(200);
    const t = await pdfAt(thermal.body.data.url);
    expect([Math.round(t.getPage(0).getWidth() / MM), Math.round(t.getPage(0).getHeight() / MM)]).toEqual([100, 150]);

    const eco = await asOwner(app);
    await seedFees(app, eco.workspaceId);
    await addCourier(eco, 'ecotrack');
    const ep = await sendAndWork(app, eco, (await confirmedOrder(eco)).order);
    expect((await shipmentRow(ep.id)).labelUrl).toMatch(/labels\/.+\.pdf$/); // fetched by `courier.fetch-label`
    const label = await eco.get(`/shipments/${ep.id}/label`).expect(200);
    expect(label.body.data.source).toBe('courier');
    expect(label.body.meta.warnings).toEqual([]);
    expect((await eco.get(`/shipments/${ep.id}/label?source=djaber`).expect(200)).body.data.source).toBe('djaber');
    // no parcel at the courier yet ⇒ SHIPMENT_NOT_CREATED
    fakeCourier(app).unavailable('ecotrack', true);
    const { order } = await confirmedOrder(eco);
    const pending = await eco.post(`/orders/${order.id}/shipments`, { wilayaId: 16, communeText: 'Bab Ezzouar', isStopdesk: false, address: order.address.address }).set('Idempotency-Key', crypto.randomUUID()).expect(202);
    expect((await eco.get(`/shipments/${pending.body.data.id}/label`).expect(422)).body.error.code).toBe('SHIPMENT_NOT_CREATED');
    fakeCourier(app).unavailable('ecotrack', false);
    const other = await asOwner(app);
    await other.get(`/shipments/${ep.id}/label`).expect(404);
  });

  it('AT-DLV-08 merged labels for 10 orders (one PDF, one page each)', async () => {
    const owner = await asOwner(app);
    await seedFees(app, owner.workspaceId);
    await addCourier(owner, 'zrexpress');
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await sendAndWork(app, owner, (await confirmedOrder(owner)).order)).orderId);
    const res = await owner.post('/shipments/labels', { orderIds: ids }).expect(202);
    await drain(app, owner.workspaceId);
    const job = await jobOf(owner, res.body.data.jobId);
    expect(job).toMatchObject({ kind: 'labels', status: 'done', result: { count: 10, pages: 10, djaberLabels: 10, skipped: [] }, resultUrl: expect.any(String) });
    expect((await pdfOfJob(res.body.data.jobId)).getPageCount()).toBe(10);
  });

  it('AT-DLV-13 labels on 6 orders with 2 unsent ⇒ 4-page PDF + 2 rows SHIPMENT_NOT_CREATED; thermal; labelPrintedAt set when ticked', async () => {
    const owner = await asOwner(app);
    await seedFees(app, owner.workspaceId);
    await addCourier(owner, 'ecotrack');
    const sent: string[] = [];
    for (let i = 0; i < 4; i++) sent.push((await sendAndWork(app, owner, (await confirmedOrder(owner)).order)).orderId);
    const unsent = [(await confirmedOrder(owner)).order.id, (await confirmedOrder(owner)).order.id];
    const op = await asOperator(app, owner.workspaceId);
    const res = await op.post('/shipments/labels', { orderIds: [...sent.slice(0, 2), unsent[0], ...sent.slice(2), unsent[1]], format: 'thermal', markPrinted: true }).expect(202);
    await drain(app, owner.workspaceId);
    const job = await jobOf(op, res.body.data.jobId);
    expect(job).toMatchObject({ status: 'partial', result: { count: 4, pages: 4, format: 'thermal', courierLabels: 4 } });
    expect(job.result.skipped).toEqual(unsent.map((id) => expect.objectContaining({ id, code: 'SHIPMENT_NOT_CREATED' })));
    expect((await pdfOfJob(res.body.data.jobId)).getPageCount()).toBe(4);
    for (const id of sent) expect((await reloadOrder(owner, id)).labelPrintedAt).toEqual(expect.any(String));
    for (const id of unsent) expect((await reloadOrder(owner, id)).labelPrintedAt).toBeNull();
    await op.post('/shipments/labels', {}).expect(422);
  });
});

describe('product labels (M2 carry-over, `POST /products/bulk/labels`)', () => {
  it('202 job → A4 sheet, one label per product / variant × copies; cross-workspace ids ignored', async () => {
    const owner = await asOwner(app);
    const a = await createProduct(owner, { name: 'Robe kabyle', price: 4500, sku: `RK-${Date.now()}` });
    const b = await createProduct(owner, { name: 'قفطان تقليدي', price: 9800, variants: [{ name: 'M', price: 9800, stock: 2 }, { name: 'L', price: 9900, stock: 1 }] });
    const other = await asOwner(app);
    const c = await createProduct(other, { name: 'Autre', price: 100 });
    const res = await owner.post('/products/bulk/labels', { ids: [a.id, b.id, c.id], copies: 2 }).expect(202);
    await drain(app, owner.workspaceId);
    const job = await jobOf(owner, res.body.data.jobId);
    expect(job).toMatchObject({ kind: 'labels', status: 'partial', result: { kind: 'product_labels', count: 6, pages: 1 } });
    expect((await pdfOfJob(res.body.data.jobId)).getPageCount()).toBe(1);
    await owner.post('/products/bulk/labels', { ids: [] }).expect(422);
  });
});
