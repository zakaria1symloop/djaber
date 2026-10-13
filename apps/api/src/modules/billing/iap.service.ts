// D74 / PCK-01 / FL-20 / 05-integrations §5 — mobile credit packs through the stores.
//   POST /credits/packs/iap/validate (Idempotency-Key, idempotent on transactionId): unknown product ⇒ 404
//     IAP_PRODUCT_UNKNOWN; already credited ⇒ 409 IAP_RECEIPT_ALREADY_USED (the app treats it as success); store says
//     invalid ⇒ 422 IAP_RECEIPT_INVALID; store down (10 s) ⇒ 503 IAP_STORE_UNAVAILABLE, the purchase stays `pending` and
//     `payments/iap-validate` + `sched-payment-reconcile` retry it; credits are granted only after the store confirms.
//   POST /webhooks/store/{google-play|app-store}: signature / token check, `InboundEvent` dedup, job
//     `payments/store-notification`; a refund removes the pack credits (PCK-03).
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { IapValidateInput, IapValidateResult } from '@djaber/shared';
import { prisma, Prisma, rawPrisma, TenantContext, type CreditPack, type CreditPackPurchase, type Tx } from '@djaber/db';
import { AppException } from '../../core/errors/app.exception';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { TenantResolver } from '../../core/tenancy/tenant.resolver';
import { CreditService } from '../credits/credit.service';
import { STORE_VALIDATORS, StoreUnavailableError, type StorePlatform, type StoreReceipt, type StoreValidators, type StoreVerdict } from './iap/store-validators';
import { PackService } from './pack.service';

type Purchase = CreditPackPurchase & { pack: CreditPack };
const TIMEOUT_MS = 10_000;
const withTimeout = <T>(p: Promise<T>) => Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new StoreUnavailableError('timeout')), TIMEOUT_MS))]);
const receiptOf = (p: CreditPackPurchase): StoreReceipt => {
  const r = (p.receipt ?? {}) as { productId?: string; transactionId?: string; receipt?: string; purchaseToken?: string };
  return { productId: r.productId ?? '', transactionId: r.transactionId ?? p.storeTransactionId ?? '', receipt: r.receipt, purchaseToken: r.purchaseToken };
};

@Injectable()
export class IapService implements OnModuleInit {
  private readonly log = new Logger(IapService.name);
  constructor(
    @Inject(STORE_VALIDATORS) readonly stores: StoreValidators,
    private readonly packs: PackService,
    private readonly credits: CreditService,
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueOutbox,
    private readonly tenants: TenantResolver,
  ) {}

  onModuleInit() {
    this.registry.register('payments', 'iap-validate', (data: { receiptId: string }) => this.revalidate(data.receiptId, true), { concurrency: 2 });
    this.registry.register('payments', 'store-notification', (data: { inboundEventId: string }) => this.processNotification(data.inboundEventId), { concurrency: 2 });
    this.registry.extendCron('sched-payment-reconcile', 'iap-pending', () => this.pollPending());
  }

  private packFor(platform: StorePlatform, productId: string) {
    return TenantContext.runSystem(() => prisma.creditPack.findFirst({ where: { isActive: true, visibleMobile: true, ...(platform === 'google_play' ? { googleProductId: productId } : { appleProductId: productId }) } }));
  }

  /** `POST /credits/packs/iap/validate`. */
  async validate(input: IapValidateInput): Promise<IapValidateResult> {
    const t = TenantContext.get();
    const pack = await this.packFor(input.platform, input.productId);
    if (!pack) throw new AppException('IAP_PRODUCT_UNKNOWN');
    const existing = await TenantContext.runSystem(() => prisma.creditPackPurchase.findUnique({ where: { storeTransactionId: input.transactionId }, include: { pack: true } }));
    if (existing && (existing.workspaceId !== t.workspaceId || existing.status === 'credited' || existing.status === 'refunded')) throw new AppException('IAP_RECEIPT_ALREADY_USED');
    if (existing && existing.status === 'invalid') throw new AppException('IAP_RECEIPT_INVALID');
    const receipt = { productId: input.productId, transactionId: input.transactionId, ...(input.receipt ? { receipt: input.receipt } : {}), ...(input.purchaseToken ? { purchaseToken: input.purchaseToken } : {}) };
    let purchase: Purchase;
    try {
      purchase = existing ?? (await prisma.creditPackPurchase.create({ data: { workspaceId: t.workspaceId, creditPackId: pack.id, channel: input.platform, status: 'pending', amount: pack.priceWebDzd, storeTransactionId: input.transactionId, receipt: receipt as Prisma.InputJsonValue, purchasedById: t.userId! }, include: { pack: true } }));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new AppException('IAP_RECEIPT_ALREADY_USED');
      throw e;
    }
    let verdict: StoreVerdict;
    try {
      verdict = await withTimeout(this.stores.validate(input.platform, receipt));
    } catch (e) {
      if (!(e instanceof StoreUnavailableError)) throw e;
      // FL-20 F-3: kept pending, retried by `payments/iap-validate` (and polled by sched-payment-reconcile)
      await prisma.$transaction((db) => this.queue.add(db as Tx, 'payments', 'iap-validate', { receiptId: purchase.id, workspaceId: t.workspaceId }, `iap:${purchase.id}`, { attempts: 3, backoff: { type: 'fixed', delay: 60_000 } }));
      throw new AppException('IAP_STORE_UNAVAILABLE');
    }
    const r = await this.applyVerdict(purchase, verdict);
    if (r === 'invalid') throw new AppException('IAP_RECEIPT_INVALID');
    const balance = await this.credits.summary();
    return { status: r === 'credited' ? 'credited' : 'pending', creditsAdded: r === 'credited' ? pack.credits : 0, purchaseId: purchase.id, balance };
  }

  /** Applies a store verdict to a purchase (credit once / invalid / still pending). */
  private async applyVerdict(purchase: Purchase, v: StoreVerdict): Promise<'credited' | 'invalid' | 'pending'> {
    const workspaceId = purchase.workspaceId;
    if (v.state === 'pending') {
      await TenantContext.runAs(workspaceId, () => prisma.creditPackPurchase.update({ where: { id: purchase.id }, data: { storeOrderId: v.orderId ?? purchase.storeOrderId } }));
      return 'pending';
    }
    if (v.state === 'invalid') {
      await TenantContext.runAs(workspaceId, () => prisma.creditPackPurchase.updateMany({ where: { id: purchase.id, status: 'pending' }, data: { status: 'invalid' } }));
      return 'invalid';
    }
    const tenant = await this.tenants.forWorker(workspaceId);
    await TenantContext.run(tenant, () =>
      prisma.$transaction(async (db) => {
        const tx = db as Tx;
        await tx.creditPackPurchase.updateMany({ where: { id: purchase.id, status: 'pending' }, data: { status: 'validated', validatedAt: new Date(), storeOrderId: v.orderId ?? null } });
        await this.packs.credit(tx, { ...purchase, validatedAt: new Date() }, purchase.channel === 'google_play' ? 'google_play' : 'app_store', 0);
      }),
    );
    // consumables are consumed only after the credit (05 §5); a failure here is retried by the store's own flow
    await this.stores.acknowledge(purchase.channel as StorePlatform, receiptOf(purchase)).catch((e) => this.log.warn({ purchaseId: purchase.id, err: String(e) }, 'store acknowledge failed'));
    return 'credited';
  }

  /** `payments/iap-validate` and the reconcile poll: validates a pending purchase again. */
  async revalidate(purchaseId: string, fromJob = false) {
    const p = await TenantContext.runSystem(() => prisma.creditPackPurchase.findUnique({ where: { id: purchaseId }, include: { pack: true } }));
    if (!p || p.status !== 'pending' || p.channel === 'web') return 'noop';
    try {
      return await this.applyVerdict(p, await withTimeout(this.stores.validate(p.channel as StorePlatform, receiptOf(p))));
    } catch (e) {
      if (e instanceof StoreUnavailableError && fromJob) throw e; // BullMQ retries (3 / 60 s)
      if (e instanceof StoreUnavailableError) return 'pending';
      throw e;
    }
  }

  /** Pending store purchases younger than 72 h are polled (FL-20 F-3 "server also polls pending receipts"). */
  async pollPending(now = new Date()) {
    const rows = await TenantContext.runSystem(() => prisma.creditPackPurchase.findMany({ where: { status: 'pending', channel: { in: ['google_play', 'app_store'] }, createdAt: { gte: new Date(now.getTime() - 72 * 3600_000) } }, select: { id: true }, take: 200 }));
    let n = 0;
    for (const r of rows) if ((await this.revalidate(r.id)) === 'credited') n++;
    return n;
  }

  // --- store server notifications ------------------------------------------------------------------------------------------
  async ingestNotification(platform: StorePlatform, req: { headers: Record<string, string | string[] | undefined>; query: Record<string, unknown>; rawBody: Buffer | undefined }) {
    const n = await this.stores.parseNotification(platform, { headers: req.headers, query: req.query, rawBody: req.rawBody ?? Buffer.alloc(0) });
    if (!n) {
      this.log.warn({ platform }, 'store notification refused: invalid signature / token');
      throw new AppException('WEBHOOK_SIGNATURE_INVALID');
    }
    const opts = JSON.stringify({ attempts: 3, backoff: { type: 'fixed', delay: 60_000 } });
    const provider = platform === 'google_play' ? 'google_play' : 'app_store';
    const received = await rawPrisma.$executeRaw`
      WITH ev AS (
        INSERT INTO "InboundEvent" ("id","provider","externalId","payload","receivedAt")
        VALUES (uuid_generate_v7(), ${provider}::"InboundProvider", ${n.externalId}, ${JSON.stringify(n)}::jsonb, now())
        ON CONFLICT ("externalId") DO NOTHING
        RETURNING "id","externalId"
      )
      INSERT INTO "Outbox" ("id","workspaceId","topic","key","payload","attempts","createdAt")
      SELECT uuid_generate_v7(), NULL, 'job', 'store:' || ev."externalId",
             jsonb_build_object('queue', 'payments', 'name', 'store-notification', 'data', jsonb_build_object('inboundEventId', ev."id"), 'opts', ${opts}::jsonb),
             0, now()
      FROM ev
      ON CONFLICT ("topic","key") DO NOTHING`;
    return { received };
  }

  async processNotification(inboundEventId: string) {
    const ev = await TenantContext.runSystem(() => prisma.inboundEvent.findUnique({ where: { id: inboundEventId } }));
    if (!ev || ev.processedAt) return;
    const n = ev.payload as { platform: StorePlatform; kind: string; transactionId: string | null; orderId: string | null; purchaseToken: string | null };
    let error: string | null = null;
    if (n.kind === 'refund') {
      const or: Prisma.CreditPackPurchaseWhereInput[] = [];
      if (n.transactionId) or.push({ storeTransactionId: n.transactionId }, { storeOrderId: n.transactionId });
      if (n.orderId) or.push({ storeOrderId: n.orderId }, { storeTransactionId: n.orderId });
      if (n.purchaseToken) or.push({ receipt: { path: ['purchaseToken'], equals: n.purchaseToken } });
      const p = or.length ? await TenantContext.runSystem(() => prisma.creditPackPurchase.findFirst({ where: { channel: n.platform, OR: or }, include: { pack: true } })) : null;
      if (!p) error = 'unknown_purchase';
      else await this.refund(p, n.platform);
    }
    await TenantContext.runSystem(() => prisma.inboundEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), error } }));
  }

  async refund(p: Purchase, source: string) {
    const tenant = await this.tenants.forWorker(p.workspaceId);
    return TenantContext.run(tenant, () => prisma.$transaction((db) => this.packs.refund(db as Tx, p, source)));
  }
}
