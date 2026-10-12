// DLV-06 / 04 §22 / AT-DLV-08 / AT-DLV-13 — labels. Courier label when the provider offers one (fetched by the worker
// after creation, `courier.fetch-label`, stored under `private/ws/<id>/labels/`), else the Djaber label (ZR Express ⇒
// `LABEL_UNAVAILABLE` warning + fallback). One label: `GET /shipments/:id/label` (signed URL, 24 h). Many: job
// `labels-merge` (one merged PDF; orders without a created parcel skipped with `SHIPMENT_NOT_CREATED`; optional
// "bordereau imprimé" stamp on `Order.labelPrintedAt`). Also the M2 product label sheet (`POST /products/bulk/labels`).
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import type { LabelFileView, LabelFormat, LabelQuery, LabelsJobInput, LabelsJobResult, ProductLabelsInput, ProductLabelsJobResult } from '@djaber/shared';
import { prisma, TenantContext, type Job, type Shipment } from '@djaber/db';
import { ConfigService } from '../../core/config/config.service';
import { AppException, notFound } from '../../core/errors/app.exception';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { StorageService } from '../../core/storage/storage.service';
import { JobService } from '../jobs/job.service';
import { CourierAdapters } from './adapters/courier-registry';
import { isCourierError, PROVIDER_NAMES, type CourierProvider } from './adapters/courier-adapter';
import { CourierAccountService } from './courier-account.service';
import { CourierLimiter } from './courier-limiter';
import { renderDjaberLabels, type DjaberLabelData, type LabelLang } from './labels/djaber-label.pdf';
import { renderProductLabels, PRODUCT_LABELS_PER_PAGE, type ProductLabelData } from './labels/product-labels.pdf';

const URL_TTL_S = 24 * 3600;
const NOT_CREATED: Shipment['status'][] = ['pending', 'cancelled'];

@Injectable()
export class LabelService implements OnModuleInit {
  private readonly log = new Logger(LabelService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly jobs: JobService,
    private readonly registry: ProcessorRegistry,
    private readonly adapters: CourierAdapters,
    private readonly accounts: CourierAccountService,
    private readonly limiter: CourierLimiter,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.registry.register('courier', 'fetch-label', (data: { shipmentId: string; workspaceId: string }) => this.fetchLabel(data), { concurrency: 4 });
    this.registry.register('jobs', 'labels-merge', (data: { jobId: string }) => this.mergeJob(data.jobId), { concurrency: 2 });
    this.registry.register('jobs', 'product-labels', (data: { jobId: string }) => this.productLabelsJob(data.jobId), { concurrency: 2 });
  }

  private lang(l?: string | null): LabelLang {
    const t = l ?? TenantContext.get().locale;
    return t === 'ar' || t === 'en' ? t : 'fr';
  }

  // --- courier label (worker) -------------------------------------------------------------------------------------------
  /** `courier.fetch-label` (3 / 30 s): adapter label → storage; `LABEL_UNAVAILABLE` ⇒ nothing stored (Djaber fallback). */
  async fetchLabel(data: { shipmentId: string; workspaceId: string }) {
    await TenantContext.runAs(data.workspaceId, async () => {
      const s = await prisma.shipment.findFirst({ where: { id: data.shipmentId } });
      if (!s || !s.trackingNumber || s.labelUrl || !s.courierAccountId) return;
      const adapter = this.adapters.get(s.provider);
      const account = await prisma.courierAccount.findFirst({ where: { id: s.courierAccountId } });
      if (!adapter.getLabel || !account) return;
      try {
        await this.limiter.take(account.id, 'other');
        const r = await adapter.getLabel(this.accounts.open(account), s.trackingNumber);
        if (!('pdf' in r)) return;
        const key = `private/ws/${s.workspaceId}/labels/${s.id}.pdf`;
        await this.storage.put(key, r.pdf, 'application/pdf');
        await prisma.shipment.update({ where: { id: s.id }, data: { labelUrl: key } });
      } catch (e) {
        if (isCourierError(e) && e.kind !== 'unavailable') return;
        throw e;
      }
    });
  }

  // --- data -----------------------------------------------------------------------------------------------------------------
  private async labelData(shipments: (Shipment & { order: Awaited<ReturnType<LabelService['orderFor']>> })[], lang: LabelLang): Promise<Map<string, DjaberLabelData>> {
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: TenantContext.workspaceId() }, select: { name: true, phone: true, address: true, senderWilaya: { select: { code: true, nameFr: true, nameAr: true } } } });
    const accounts = new Map((await prisma.courierAccount.findMany({ where: { id: { in: shipments.map((s) => s.courierAccountId).filter((x): x is string => !!x) } } })).map((a) => [a.id, a]));
    const stopdeskIds = shipments.map((s) => s.stopdeskId).filter((x): x is string => !!x);
    const stopdesks = new Map((stopdeskIds.length ? await prisma.courierStopdesk.findMany({ where: { externalId: { in: stopdeskIds } } }) : []).map((d) => [d.externalId, d.name]));
    const web = this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '');
    const name = (x: { nameFr: string; nameAr: string } | null | undefined) => (x ? (lang === 'ar' ? x.nameAr : x.nameFr) : null);
    const out = new Map<string, DjaberLabelData>();
    for (const s of shipments) {
      const o = s.order;
      const a = s.courierAccountId ? accounts.get(s.courierAccountId) : undefined;
      out.set(s.id, {
        shopName: ws.name,
        shopPhone: a?.senderPhone ?? ws.phone,
        senderAddress: a?.senderAddress ?? ws.address,
        senderWilaya: ws.senderWilaya ? `${ws.senderWilaya.code} · ${name(ws.senderWilaya)}` : null,
        orderNumber: o.number,
        courier: a?.displayName ?? PROVIDER_NAMES[s.provider as CourierProvider] ?? s.provider,
        trackingNumber: s.trackingNumber,
        recipientName: o.clientName,
        phone: o.clientPhone,
        phone2: o.clientPhone2,
        wilaya: o.wilaya ? `${o.wilaya.code} · ${name(o.wilaya)}` : null,
        commune: o.communeText ?? name(o.commune),
        address: o.address,
        isStopdesk: o.isStopdesk,
        stopdeskName: s.stopdeskId ? (stopdesks.get(s.stopdeskId) ?? s.stopdeskId) : null,
        codAmount: s.codAmount,
        itemsSummary: s.contentSummary ?? o.items.map((i) => `${i.productName}${i.variantName ? ` ${i.variantName}` : ''} ×${i.quantity}`).join(', '),
        trackingUrl: `${web}/s/${s.publicTrackingToken}`,
      });
    }
    return out;
  }

  private orderFor(orderId: string) {
    return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { orderBy: { id: 'asc' } }, wilaya: true, commune: true } });
  }

  private async store(body: Buffer, name: string, createdById: string | null | undefined) {
    const ws = TenantContext.workspaceId();
    const key = `private/ws/${ws}/labels/${name}.pdf`;
    await this.storage.put(key, body, 'application/pdf');
    const upload = createdById ? await prisma.upload.create({ data: { workspaceId: ws, storageKey: key, url: key, mime: 'application/pdf', size: body.length, kind: 'label', createdById } }) : null;
    return { key, upload };
  }

  // --- one label --------------------------------------------------------------------------------------------------------------
  /** `GET /shipments/:id/label` → the courier label when stored, else the Djaber label (+ `LABEL_UNAVAILABLE` warning). */
  async single(id: string, q: LabelQuery): Promise<{ file: LabelFileView; warning: 'LABEL_UNAVAILABLE' | null }> {
    const s = await prisma.shipment.findFirst({ where: { id } });
    if (!s) throw notFound();
    if (NOT_CREATED.includes(s.status) || (!s.trackingNumber && s.provider !== 'manual')) throw new AppException('SHIPMENT_NOT_CREATED');
    const expiresAt = new Date(Date.now() + URL_TTL_S * 1000).toISOString();
    if (q.source !== 'djaber' && s.labelUrl) {
      const stored = await this.storage.get(s.labelUrl).catch(() => null);
      if (stored) return { file: { url: this.storage.signedUrl(s.labelUrl, URL_TTL_S), fileName: `${s.trackingNumber ?? s.id}.pdf`, size: stored.body.length, source: 'courier', format: q.format, expiresAt }, warning: null };
    }
    const order = await this.orderFor(s.orderId);
    const lang = this.lang(q.lang);
    const data = await this.labelData([{ ...s, order }], lang);
    const pdf = await renderDjaberLabels([data.get(s.id)!], q.format, lang);
    const { key } = await this.store(pdf, `${order.number}-${q.format}-${Date.now()}`, TenantContext.get().userId);
    const courierHasLabels = s.provider !== 'manual' && this.adapters.get(s.provider).capabilities.label;
    return { file: { url: this.storage.signedUrl(key, URL_TTL_S), fileName: `${order.number}.pdf`, size: pdf.length, source: 'djaber', format: q.format, expiresAt }, warning: q.source === 'djaber' || courierHasLabels ? null : 'LABEL_UNAVAILABLE' };
  }

  // --- merged labels (job) ------------------------------------------------------------------------------------------------------
  /** `POST /shipments/labels` → 202 `{ jobId }` (Job `labels`, name `labels-merge`). */
  async requestMerge(input: LabelsJobInput) {
    const total = (input.orderIds?.length ?? 0) + (input.shipmentIds?.length ?? 0);
    const job = await this.jobs.create({ kind: 'labels', name: 'labels-merge', payload: { orderIds: input.orderIds ?? [], shipmentIds: input.shipmentIds ?? [], format: input.format, markPrinted: input.markPrinted, lang: this.lang(input.lang) }, total, expiresAt: new Date(Date.now() + 7 * 86_400_000) });
    return { jobId: job.id };
  }

  async mergeJob(jobId: string) {
    await this.jobs.run(jobId, async (job: Job) => {
      const p = (job.payload ?? {}) as { orderIds?: string[]; shipmentIds?: string[]; format?: LabelFormat; markPrinted?: boolean; lang?: LabelLang };
      const format = p.format ?? 'a6';
      const lang = p.lang ?? 'fr';
      const skipped: LabelsJobResult['skipped'] = [];
      // one entry per requested id, in the requested order
      const picked: { shipment: Shipment; orderId: string }[] = [];
      const orders = p.orderIds?.length ? await prisma.order.findMany({ where: { id: { in: p.orderIds } }, select: { id: true, number: true, shipments: { orderBy: { createdAt: 'desc' } } } }) : [];
      const byOrder = new Map(orders.map((o) => [o.id, o]));
      for (const id of p.orderIds ?? []) {
        const o = byOrder.get(id);
        if (!o) {
          skipped.push({ id, orderNumber: null, code: 'NOT_FOUND' });
          continue;
        }
        const s = o.shipments.find((x) => !NOT_CREATED.includes(x.status) && (x.trackingNumber || x.provider === 'manual'));
        if (!s) skipped.push({ id, orderNumber: o.number, code: 'SHIPMENT_NOT_CREATED' });
        else picked.push({ shipment: s, orderId: o.id });
      }
      const ships = p.shipmentIds?.length ? await prisma.shipment.findMany({ where: { id: { in: p.shipmentIds } }, include: { order: { select: { number: true } } } }) : [];
      const byShip = new Map(ships.map((s) => [s.id, s]));
      for (const id of p.shipmentIds ?? []) {
        const s = byShip.get(id);
        if (!s) skipped.push({ id, orderNumber: null, code: 'NOT_FOUND' });
        else if (NOT_CREATED.includes(s.status) || (!s.trackingNumber && s.provider !== 'manual')) skipped.push({ id, orderNumber: s.order.number, code: 'SHIPMENT_NOT_CREATED' });
        else if (!picked.some((x) => x.shipment.id === s.id)) picked.push({ shipment: s, orderId: s.orderId });
      }

      // Djaber labels for the parcels without a stored courier label, rendered one PDF per label then merged in order
      const full = await Promise.all(picked.map(async (x) => ({ ...x.shipment, order: await this.orderFor(x.orderId) })));
      const data = await this.labelData(full, lang);
      const merged = await PDFDocument.create();
      let courierLabels = 0;
      let djaberLabels = 0;
      let done = 0;
      for (const s of full) {
        let bytes: Buffer | null = null;
        if (s.labelUrl) {
          bytes = (await this.storage.get(s.labelUrl).catch(() => null))?.body ?? null;
          if (bytes) courierLabels++;
        }
        if (!bytes) {
          bytes = await renderDjaberLabels([data.get(s.id)!], format, lang);
          djaberLabels++;
        }
        const src = await PDFDocument.load(bytes);
        for (const page of await merged.copyPages(src, src.getPageIndices())) merged.addPage(page);
        if (++done % 10 === 0) await this.jobs.progress(jobId, (done / Math.max(1, full.length)) * 100);
      }
      if (!full.length) merged.addPage();
      const pdf = Buffer.from(await merged.save());
      if (p.markPrinted && picked.length) await prisma.order.updateMany({ where: { id: { in: picked.map((x) => x.orderId) } }, data: { labelPrintedAt: new Date() } });
      const { upload } = await this.store(pdf, `bordereaux-${jobId}`, job.createdById);
      const result: LabelsJobResult = { kind: 'labels', count: full.length, pages: merged.getPageCount(), format, fileName: `bordereaux-${full.length}.pdf`, size: pdf.length, skipped, courierLabels, djaberLabels };
      return { resultUploadId: upload?.id ?? null, result, status: skipped.length ? 'partial' : 'done' };
    });
  }

  // --- product label sheet (M2 carry-over) -----------------------------------------------------------------------------------
  /** `POST /products/bulk/labels` → 202 `{ jobId }` (Job `labels`, name `product-labels`). */
  async requestProductLabels(input: ProductLabelsInput) {
    const job = await this.jobs.create({ kind: 'labels', name: 'product-labels', payload: { ids: input.ids, copies: input.copies, withPrice: input.withPrice, includeVariants: input.includeVariants }, total: input.ids.length, expiresAt: new Date(Date.now() + 7 * 86_400_000) });
    return { jobId: job.id };
  }

  async productLabelsJob(jobId: string) {
    await this.jobs.run(jobId, async (job: Job) => {
      const p = (job.payload ?? {}) as { ids?: string[]; copies?: number; withPrice?: boolean; includeVariants?: boolean };
      const products = await prisma.product.findMany({ where: { id: { in: p.ids ?? [] }, deletedAt: null }, include: { variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } } });
      const by = new Map(products.map((x) => [x.id, x]));
      const labels: ProductLabelData[] = [];
      for (const id of p.ids ?? []) {
        const prod = by.get(id);
        if (!prod) continue;
        const rows: ProductLabelData[] =
          p.includeVariants !== false && prod.variants.length
            ? prod.variants.map((v) => ({ name: prod.name, variant: v.name, sku: v.sku ?? prod.sku, price: p.withPrice === false ? null : (v.price ?? prod.price) }))
            : [{ name: prod.name, variant: null, sku: prod.sku, price: p.withPrice === false ? null : prod.price }];
        for (const r of rows) for (let c = 0; c < (p.copies ?? 1); c++) labels.push(r);
      }
      const pdf = await renderProductLabels(labels);
      const { upload } = await this.store(pdf, `etiquettes-produits-${jobId}`, job.createdById);
      const result: ProductLabelsJobResult = { kind: 'product_labels', count: labels.length, pages: Math.max(1, Math.ceil(labels.length / PRODUCT_LABELS_PER_PAGE)), fileName: `etiquettes-${labels.length}.pdf`, size: pdf.length };
      return { resultUploadId: upload?.id ?? null, result, status: products.length < (p.ids?.length ?? 0) ? 'partial' : 'done' };
    });
  }
}
