// PRM-01 / PRM-02 / 04 §14 "Promo codes" (D57). Validation order (AT-PRM-01): exists and active (PROMO_INVALID) → window
// (PROMO_EXPIRED) → uses < maxUses (PROMO_LIMIT_REACHED) → not used by this workspace (PROMO_ALREADY_USED) → plan in
// planSlugs (PROMO_PLAN_MISMATCH) → no other active discount (PROMO_NOT_STACKABLE) → mobile: credits codes only
// (PROMO_MOBILE_SUBSCRIPTION_FORBIDDEN). `credits` codes credit the plan part at once (`grant`, reason `promo:<CODE>`);
// `trial_extension` codes move `trialEndsAt` / `currentPeriodEnd` of a trial; discount codes apply at checkout.
// Referral codes `PARRAIN-<x>` (target = the sponsor's workspace) record a redemption and pay 300 credits to both sides
// when the referee's first paid invoice is paid (AT-PRM-02).
import { Injectable } from '@nestjs/common';
import { REFERRAL_CREDITS, REFERRAL_PREFIX, type CreditsDto, type PromoCheckDto, type PromoRedeemDto } from '@djaber/shared';
import { prisma, TenantContext, type Plan, type PromoCode, type Tx } from '@djaber/db';
import { AppException } from '../../core/errors/app.exception';
import { TenantResolver } from '../../core/tenancy/tenant.resolver';
import { CreditService } from '../credits/credit.service';
import { currentSub, DAY_MS, lockBilling } from './billing.util';

export type PromoContext = { workspaceId: string; plan?: Plan | null; platform: 'web' | 'mobile'; purpose: 'checkout' | 'redeem' | 'validate' };
const DISCOUNT = new Set(['percent_discount', 'fixed_discount']);

@Injectable()
export class PromoService {
  constructor(
    private readonly credits: CreditService,
    private readonly tenants: TenantResolver,
  ) {}

  static isReferral(code: string) {
    return code.toUpperCase().startsWith(REFERRAL_PREFIX);
  }

  toCheck(p: PromoCode): PromoCheckDto {
    return { code: p.code, kind: p.kind, value: p.value, periods: p.periods, planSlugs: p.planSlugs, referral: PromoService.isReferral(p.code) };
  }

  /** The full validation matrix; returns the code row or throws a `PROMO_*` error. */
  async check(raw: string, ctx: PromoContext, db: Tx = prisma as unknown as Tx): Promise<PromoCode> {
    const code = raw.trim().toUpperCase();
    const p = await TenantContext.runSystem(() => prisma.promoCode.findUnique({ where: { code } }));
    if (!p || !p.isActive) throw new AppException('PROMO_INVALID');
    const now = Date.now();
    if ((p.validFrom && p.validFrom.getTime() > now) || (p.validTo && p.validTo.getTime() < now)) throw new AppException('PROMO_EXPIRED');
    if (p.maxUses !== null) {
      const uses = await TenantContext.runSystem(() => prisma.promoRedemption.count({ where: { promoCodeId: p.id } }));
      if (uses >= p.maxUses) throw new AppException('PROMO_LIMIT_REACHED');
    }
    const mine = await TenantContext.runSystem(() => prisma.promoRedemption.count({ where: { promoCodeId: p.id, workspaceId: ctx.workspaceId } }));
    if (mine >= Math.max(1, p.perWorkspaceLimit)) throw new AppException('PROMO_ALREADY_USED');
    // target audience: a workspace code is for that workspace only (a referral code is never for its own sponsor)
    const paidBefore = await TenantContext.runSystem(() => prisma.invoice.count({ where: { workspaceId: ctx.workspaceId, kind: 'subscription', status: 'paid' } }));
    if (PromoService.isReferral(p.code)) {
      if (p.targetWorkspaceId === ctx.workspaceId) throw new AppException('PROMO_INVALID');
      if (paidBefore > 0) throw new AppException('PROMO_INVALID');
    } else if (p.target === 'workspace' && p.targetWorkspaceId !== ctx.workspaceId) throw new AppException('PROMO_INVALID');
    else if (p.target === 'new_workspaces' && paidBefore > 0) throw new AppException('PROMO_INVALID');
    else if (p.target === 'existing' && paidBefore === 0) throw new AppException('PROMO_INVALID');
    if (DISCOUNT.has(p.kind) && ctx.platform === 'mobile') throw new AppException('PROMO_MOBILE_SUBSCRIPTION_FORBIDDEN');
    if (p.kind === 'trial_extension' && ctx.platform === 'mobile') throw new AppException('PROMO_MOBILE_SUBSCRIPTION_FORBIDDEN');
    if (DISCOUNT.has(p.kind)) {
      if (ctx.plan && p.planSlugs.length && !p.planSlugs.includes(ctx.plan.slug)) throw new AppException('PROMO_PLAN_MISMATCH', { plans: p.planSlugs.join(', ') });
      const sub = await currentSub(db, ctx.workspaceId);
      if (sub && (sub.discountPct || (sub.promoRedemptionId && (await this.discountLeft(db, sub.id, sub.promoRedemptionId)) > 0))) throw new AppException('PROMO_NOT_STACKABLE');
    }
    return p;
  }

  /** Discounted price of one period (percent or DA), never below 0. */
  static apply(p: Pick<PromoCode, 'kind' | 'value'> | null, amount: number) {
    if (!p) return amount;
    if (p.kind === 'percent_discount') return Math.max(0, Math.round(amount * (1 - Math.min(100, p.value) / 100)));
    if (p.kind === 'fixed_discount') return Math.max(0, amount - p.value);
    return amount;
  }

  /** Periods of discount left on a subscription (null `periods` = the first payment only). */
  async discountLeft(db: Tx, subscriptionId: string, redemptionId: string): Promise<number> {
    const r = await db.promoRedemption.findUnique({ where: { id: redemptionId }, include: { promoCode: true } });
    if (!r || !DISCOUNT.has(r.promoCode.kind)) return 0;
    const used = await db.invoice.count({ where: { subscriptionId, kind: 'subscription', status: 'paid', paidAt: { gte: r.redeemedAt } } });
    return Math.max(0, (r.promoCode.periods ?? 1) - used);
  }

  /** The discount code still running on a subscription (renewal invoices). */
  async activeDiscount(db: Tx, sub: { id: string; promoRedemptionId: string | null }): Promise<PromoCode | null> {
    if (!sub.promoRedemptionId) return null;
    if ((await this.discountLeft(db, sub.id, sub.promoRedemptionId)) <= 0) return null;
    const r = await db.promoRedemption.findUnique({ where: { id: sub.promoRedemptionId }, include: { promoCode: true } });
    return r?.promoCode ?? null;
  }

  /** Records the use of a code (unique per workspace); returns the redemption id. */
  async record(tx: Tx, p: PromoCode, workspaceId: string, userId: string, ledgerEntryId: string | null = null): Promise<string> {
    const existing = await tx.promoRedemption.findFirst({ where: { promoCodeId: p.id, workspaceId } });
    if (existing) return existing.id;
    const r = await tx.promoRedemption.create({ data: { promoCodeId: p.id, workspaceId, userId, ledgerEntryId } });
    return r.id;
  }

  /** `POST /billing/promo/validate { code, planId? }`. */
  async validate(code: string, plan: Plan | null, platform: 'web' | 'mobile'): Promise<PromoCheckDto> {
    const p = await this.check(code, { workspaceId: TenantContext.workspaceId(), plan, platform, purpose: 'validate' });
    return this.toCheck(p);
  }

  /** `POST /billing/promo/redeem { code }` — credits / trial extension / referral; discount codes belong to a plan change. */
  async redeem(code: string, platform: 'web' | 'mobile', summary: () => Promise<CreditsDto>): Promise<PromoRedeemDto> {
    const t = TenantContext.get();
    const workspaceId = t.workspaceId;
    const p = await this.check(code, { workspaceId, platform, purpose: 'redeem' });
    if (DISCOUNT.has(p.kind)) throw new AppException('PROMO_PLAN_MISMATCH', { plans: p.planSlugs.join(', ') || '—' });
    let creditsAdded = 0;
    let trialEndsAt: string | null = null;
    await prisma.$transaction(async (db) => {
      const tx = db as Tx;
      await lockBilling(tx, workspaceId);
      // re-checked under the lock: two tabs redeeming the same code at once
      if (await tx.promoRedemption.findFirst({ where: { promoCodeId: p.id, workspaceId } })) throw new AppException('PROMO_ALREADY_USED');
      if (PromoService.isReferral(p.code)) {
        await this.record(tx, p, workspaceId, t.userId!);
        return;
      }
      if (p.kind === 'credits') {
        const w = await this.credits.writeIn(tx, workspaceId, { bucket: 'plan', action: 'grant', credits: p.value, key: `promo:${p.id}:${workspaceId}`, reason: `promo:${p.code}`, grantedById: null });
        await this.record(tx, p, workspaceId, t.userId!, w.entryId);
        creditsAdded = p.value;
        return;
      }
      // trial_extension
      const sub = await currentSub(tx, workspaceId);
      if (!sub || sub.status !== 'trial' || !sub.trialEndsAt) throw new AppException('PROMO_PLAN_MISMATCH', { plans: 'trial' });
      const until = new Date(sub.trialEndsAt.getTime() + p.value * DAY_MS);
      await tx.subscription.update({ where: { id: sub.id }, data: { trialEndsAt: until, currentPeriodEnd: until } });
      await this.record(tx, p, workspaceId, t.userId!);
      trialEndsAt = until.toISOString();
    });
    await this.tenants.invalidate(workspaceId);
    return { ...this.toCheck(p), creditsAdded, trialEndsAt, balance: await summary() };
  }

  /**
   * AT-PRM-02: on the referee's first paid subscription invoice, 300 credits to the referee and to the sponsor, once.
   * Called inside the activation transaction.
   */
  async payReferral(tx: Tx, workspaceId: string) {
    const r = await tx.promoRedemption.findFirst({ where: { workspaceId, promoCode: { code: { startsWith: REFERRAL_PREFIX } } }, include: { promoCode: true } });
    if (!r || r.ledgerEntryId) return;
    const paid = await tx.invoice.count({ where: { workspaceId, kind: 'subscription', status: 'paid' } });
    if (paid !== 1) return; // the invoice of this activation is the first one
    const value = r.promoCode.value || REFERRAL_CREDITS;
    const mine = await this.credits.writeIn(tx, workspaceId, { bucket: 'plan', action: 'grant', credits: value, key: `referral:${r.id}:referee`, reason: `referral:${r.promoCode.code}` });
    await tx.promoRedemption.update({ where: { id: r.id }, data: { ledgerEntryId: mine.entryId } });
    const sponsor = r.promoCode.targetWorkspaceId;
    if (sponsor) {
      await TenantContext.runAs(sponsor, async () => {
        const tenant = await this.tenants.forWorker(sponsor).catch(() => null);
        if (!tenant) return;
        await TenantContext.run(tenant, () => this.credits.writeIn(tx, sponsor, { bucket: 'plan', action: 'grant', credits: value, key: `referral:${r.id}:sponsor`, reason: `referral:${r.promoCode.code}` }));
      });
    }
  }
}
