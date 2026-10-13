// PCK-01 / PCK-02 / PCK-03 / 04 §14 "Credit packs" (D40). Web purchase = Chargily checkout (`POST /credits/packs/checkout`);
// mobile purchase = store IAP (iap.service.ts). Crediting writes `CreditPackPurchase(status=credited)` +
// `CreditLedger(bucket=pack, kind=credit, action=pack_purchase, key pack:<purchaseId>)` + `Invoice(kind=credit_pack)` +
// `credits.pack_purchased`. Pack credits never expire and are consumed after the plan credits (CreditService). A store
// refund removes them (`action=store_refund`, `pack:<purchaseId>:refund`); a negative balance ⇒ `credits.negative`.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { STORE_COMMISSION_PCT, type CreditPackDto, type PackCheckoutResultDto, type PackPurchaseDto } from '@djaber/shared';
import { prisma, TenantContext, type CreditPack, type CreditPackPurchase, type PaymentMethodBilling, type Tx } from '@djaber/db';
import { notFound } from '../../core/errors/app.exception';
import { I18nService } from '../../core/i18n/i18n.service';
import { page, toSkipTake, type Page } from '../../core/http/pagination';
import { CreditService } from '../credits/credit.service';
import { NotificationProducer } from '../notifications/notification.producer';
import { InvoiceService, type InvoiceLine } from './invoice.service';
import { PaymentService, type PaidInfo, type PaymentIntent } from './payment.service';

@Injectable()
export class PackService implements OnModuleInit {
  constructor(
    private readonly i18n: I18nService,
    private readonly payments: PaymentService,
    private readonly credits: CreditService,
    private readonly invoices: InvoiceService,
    private readonly notifications: NotificationProducer,
  ) {}

  onModuleInit() {
    this.payments.register(
      'pack',
      async (tx, intent, paid) => this.creditWeb(tx, (intent as Extract<PaymentIntent, { kind: 'pack' }>).purchaseId, paid),
      async (tx, intent) => {
        await tx.creditPackPurchase.updateMany({ where: { id: (intent as Extract<PaymentIntent, { kind: 'pack' }>).purchaseId, status: 'pending' }, data: { status: 'failed' } });
      },
    );
  }

  toDto(p: CreditPack, locale: string): CreditPackDto {
    return { id: p.id, slug: p.slug, name: this.i18n.pick(p.name, locale), credits: p.credits, priceWebDzd: p.priceWebDzd, googleProductId: p.googleProductId, appleProductId: p.appleProductId, storePriceLabel: p.storePriceLabel, isFeatured: p.isFeatured, pricePerCreditDzd: p.credits > 0 ? Math.round((p.priceWebDzd / p.credits) * 100) / 100 : 0 };
  }

  /** `GET /credit-packs?platform` (public). */
  async list(platform: 'google_play' | 'app_store' | undefined, locale: string): Promise<CreditPackDto[]> {
    const where = platform === 'google_play' ? { isActive: true, visibleMobile: true, googleProductId: { not: null } } : platform === 'app_store' ? { isActive: true, visibleMobile: true, appleProductId: { not: null } } : { isActive: true, visibleWeb: true };
    const rows = await TenantContext.runSystem(() => prisma.creditPack.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { credits: 'asc' }] }));
    return rows.map((p) => this.toDto(p, locale));
  }

  /** `POST /credits/packs/checkout { packId }` (web). */
  async checkout(packId: string, locale: 'fr' | 'ar' | 'en'): Promise<PackCheckoutResultDto> {
    const t = TenantContext.get();
    const pack = await TenantContext.runSystem(() => prisma.creditPack.findUnique({ where: { id: packId } }));
    if (!pack || !pack.isActive || !pack.visibleWeb) throw notFound();
    const purchase = await prisma.creditPackPurchase.create({ data: { workspaceId: t.workspaceId, creditPackId: pack.id, channel: 'web', status: 'pending', amount: pack.priceWebDzd, purchasedById: t.userId! } });
    const r = await this.payments.start({ amount: pack.priceWebDzd, description: `Djaber — ${this.i18n.pick(pack.name, locale)}`, intent: { kind: 'pack', purchaseId: purchase.id, userId: t.userId ?? null }, locale });
    const row = await prisma.billingPayment.findUniqueOrThrow({ where: { id: r.ref } });
    await prisma.creditPackPurchase.update({ where: { id: purchase.id }, data: { providerCheckoutId: row.providerCheckoutId } });
    return { checkoutUrl: r.checkoutUrl, ref: r.ref, purchaseId: purchase.id };
  }

  private async creditWeb(tx: Tx, purchaseId: string, paid: PaidInfo) {
    const purchase = await tx.creditPackPurchase.findFirstOrThrow({ where: { id: purchaseId }, include: { pack: true } });
    const inv = await this.credit(tx, purchase, paid.method ?? 'cib', paid.amount);
    return { invoiceId: inv };
  }

  /**
   * Credits a purchase once (status pending|validated → credited). Web: invoice of the amount paid; store: invoice net of
   * the 30 % store commission (D74). Returns the invoice id.
   */
  async credit(tx: Tx, purchase: CreditPackPurchase & { pack: CreditPack }, method: PaymentMethodBilling, amountPaid: number): Promise<string | null> {
    const moved = await tx.creditPackPurchase.updateMany({ where: { id: purchase.id, status: { in: ['pending', 'validated'] } }, data: { status: 'credited', validatedAt: purchase.validatedAt ?? new Date(), creditedAt: new Date() } });
    if (!moved.count) return (await tx.invoice.findFirst({ where: { creditPackPurchaseId: purchase.id }, select: { id: true } }))?.id ?? null;
    const workspaceId = purchase.workspaceId;
    await this.credits.writeIn(tx, workspaceId, { bucket: 'pack', action: 'pack_purchase', credits: purchase.pack.credits, key: `pack:${purchase.id}`, reason: `pack:${purchase.pack.slug}`, creditPackPurchaseId: purchase.id });
    const store = purchase.channel !== 'web';
    const gross = store ? purchase.pack.priceWebDzd : amountPaid;
    const net = store ? Math.round((gross * (100 - STORE_COMMISSION_PCT)) / 100) : gross;
    const lines: InvoiceLine[] = store
      ? [
          { key: 'billingDoc.line.pack', label: '', params: { credits: purchase.pack.credits }, amount: gross },
          { key: 'billingDoc.line.store', label: '', params: { store: purchase.channel, pct: STORE_COMMISSION_PCT }, amount: net - gross },
        ]
      : [{ key: 'billingDoc.line.pack', label: '', params: { credits: purchase.pack.credits }, amount: gross }];
    const inv = await this.invoices.create(tx, { workspaceId, kind: 'credit_pack', status: 'paid', amount: net, lines, creditPackPurchaseId: purchase.id, method, paidAt: new Date() });
    await this.notifications.emit(tx, { type: 'credits_pack_purchased', workspaceId, target: { owner: true }, key: `credits_pack_purchased:${purchase.id}`, data: { purchaseId: purchase.id, credits: purchase.pack.credits, channel: purchase.channel } });
    return inv.id;
  }

  /** PCK-03: store refund ⇒ credits removed (balance may go negative ⇒ `credits.negative`). Idempotent. */
  async refund(tx: Tx, purchase: CreditPackPurchase & { pack: CreditPack }, source: string) {
    const moved = await tx.creditPackPurchase.updateMany({ where: { id: purchase.id, status: { in: ['credited', 'validated'] } }, data: { status: 'refunded', refundedAt: new Date(), refundSource: source } });
    if (!moved.count) return null;
    const workspaceId = purchase.workspaceId;
    const r = await this.credits.writeIn(tx, workspaceId, { bucket: 'pack', action: 'store_refund', credits: -purchase.pack.credits, key: `pack:${purchase.id}:refund`, reason: `store_refund:${source}`, creditPackPurchaseId: purchase.id });
    await tx.invoice.updateMany({ where: { creditPackPurchaseId: purchase.id }, data: { status: 'refunded' } });
    if (!r.balance.unlimited && r.balance.total < 0) {
      await this.notifications.emit(tx, { type: 'credits_negative', workspaceId, target: { owner: true }, key: `credits_negative:${purchase.id}`, data: { balance: r.balance.total } });
    }
    return r.balance;
  }

  /** `GET /credits/packs/purchases`. */
  async purchases(q: { page: number; pageSize: number }, locale: string): Promise<Page<PackPurchaseDto>> {
    const [rows, total] = await Promise.all([prisma.creditPackPurchase.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { pack: true, invoice: { select: { id: true } } }, ...toSkipTake(q) }), prisma.creditPackPurchase.count()]);
    return page(
      rows.map((r) => ({ id: r.id, pack: { id: r.pack.id, slug: r.pack.slug, name: this.i18n.pick(r.pack.name, locale), credits: r.pack.credits }, channel: r.channel, status: r.status, amount: r.amount, createdAt: r.createdAt.toISOString(), creditedAt: r.creditedAt?.toISOString() ?? null, refundedAt: r.refundedAt?.toISOString() ?? null, invoiceId: r.invoice?.id ?? null })),
      total,
      q,
    );
  }
}
