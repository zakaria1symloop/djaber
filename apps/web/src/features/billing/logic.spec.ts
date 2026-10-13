import { describe, expect, it } from 'vitest';
import {
  canPayInvoice,
  canRenewNow,
  cyclePrice,
  defaultCycle,
  estimateCredits,
  methodGroup,
  monthlyEquivalent,
  normalizeCalculator,
  parseCycle,
  planBanner,
  planCta,
  pollDelay,
  POLL_MAX,
  returnView,
  yearlyDiscountPct,
  type PlanLike,
  type SubscriptionLike,
} from './logic';

const NOW = Date.parse('2026-10-13T10:00:00Z');
const day = (d: number) => new Date(NOW + d * 86_400_000).toISOString();
const free: PlanLike = { id: 'p-free', slug: 'free', priceMonthly: 0, priceYearly: 0 };
const starter: PlanLike = { id: 'p-starter', slug: 'starter', priceMonthly: 1900, priceYearly: 19000 };
const pro: PlanLike = { id: 'p-pro', slug: 'pro', priceMonthly: 4900, priceYearly: 49000 };
const sub = (o: Partial<SubscriptionLike> = {}): SubscriptionLike => ({ plan: starter, status: 'active', billingCycle: 'monthly', currentPeriodEnd: day(20), cancelAtPeriodEnd: false, dunningStage: null, trialEndsAt: null, ...o });

describe('plan prices (D68 seed: starter 1 900 / 19 000, pro 4 900 / 49 000)', () => {
  it('reads the cycle price and the monthly equivalent of the yearly price', () => {
    expect(cyclePrice(pro, 'monthly')).toBe(4900);
    expect(cyclePrice(pro, 'yearly')).toBe(49000);
    expect(monthlyEquivalent(pro, 'yearly')).toBe(4083);
    expect(monthlyEquivalent(starter, 'monthly')).toBe(1900);
  });
  it('computes the yearly saving (−17 %) unless the server sends it', () => {
    expect(yearlyDiscountPct(pro)).toBe(17);
    expect(yearlyDiscountPct({ ...pro, yearlyDiscountPct: 20 })).toBe(20);
    expect(yearlyDiscountPct(free)).toBe(0);
  });
  it('parses the cycle of the URL and defaults to the subscription cycle', () => {
    expect(parseCycle('yearly')).toBe('yearly');
    expect(parseCycle('weekly')).toBeNull();
    expect(defaultCycle(sub({ billingCycle: 'yearly' }))).toBe('yearly');
    expect(defaultCycle(sub({ billingCycle: 'none' }))).toBe('monthly');
    expect(defaultCycle(null)).toBe('monthly');
  });
});

describe('plan card action (BIL-01, 02 §5: upgrade now, downgrade / cancel at period end)', () => {
  it('trial: every paid plan is a subscription, the free card is current', () => {
    const s = sub({ plan: pro, status: 'trial', billingCycle: 'none', trialEndsAt: day(5) });
    expect(planCta(pro, s, 'monthly', NOW)).toEqual({ kind: 'change', direction: 'subscribe' });
    expect(planCta(starter, s, 'monthly', NOW)).toEqual({ kind: 'change', direction: 'subscribe' });
    expect(planCta(free, s, 'monthly', NOW)).toEqual({ kind: 'current' });
  });
  it('free plan (or expired): free is current, paid plans subscribe', () => {
    const s = sub({ plan: free, billingCycle: 'none' });
    expect(planCta(free, s, 'monthly', NOW)).toEqual({ kind: 'current' });
    expect(planCta(pro, s, 'yearly', NOW)).toEqual({ kind: 'change', direction: 'subscribe' });
  });
  it('paid plan: higher = upgrade, lower = downgrade, free = cancel', () => {
    const s = sub({ plan: starter });
    expect(planCta(pro, s, 'monthly', NOW)).toEqual({ kind: 'change', direction: 'upgrade' });
    expect(planCta(free, s, 'monthly', NOW)).toEqual({ kind: 'cancel' });
    expect(planCta(starter, sub({ plan: pro }), 'monthly', NOW)).toEqual({ kind: 'change', direction: 'downgrade' });
  });
  it('same plan: renew inside J−7, disabled before; other cycle changes the commitment', () => {
    expect(planCta(starter, sub({ currentPeriodEnd: day(20) }), 'monthly', NOW)).toMatchObject({ kind: 'renew_later' });
    expect(planCta(starter, sub({ currentPeriodEnd: day(5) }), 'monthly', NOW)).toEqual({ kind: 'renew' });
    expect(planCta(starter, sub({ dunningStage: 'd0', status: 'dunning', currentPeriodEnd: day(-1) }), 'monthly', NOW)).toEqual({ kind: 'renew' });
    expect(planCta(starter, sub(), 'yearly', NOW)).toEqual({ kind: 'change', direction: 'upgrade' });
    expect(planCta(starter, sub({ billingCycle: 'yearly' }), 'monthly', NOW)).toEqual({ kind: 'change', direction: 'downgrade' });
  });
  it('a scheduled cancel offers the undo on the current card, nothing on the free card', () => {
    const s = sub({ cancelAtPeriodEnd: true });
    expect(planCta(starter, s, 'monthly', NOW)).toEqual({ kind: 'resume' });
    expect(planCta(free, s, 'monthly', NOW)).toEqual({ kind: 'current' });
    expect(canRenewNow(s, NOW)).toBe(false);
    // a booked downgrade is undone from the current card too
    expect(planCta(starter, sub({ nextPlan: { id: free.id } }), 'monthly', NOW)).toEqual({ kind: 'resume' });
  });
  it('compares a yearly target per month', () => {
    // pro yearly (4 083 / month) is above starter monthly (1 900)
    expect(planCta(pro, sub({ plan: starter }), 'yearly', NOW)).toEqual({ kind: 'change', direction: 'upgrade' });
  });
});

describe('plan banners (12 §0, R-J dunning, D44 plan expired)', () => {
  it('expired wins, then dunning, then expiring', () => {
    expect(planBanner({ status: 'active', periodEnd: day(20), expired: { at: day(-1), planName: 'Pro' }, free: true }, NOW)).toBe('planExpired');
    expect(planBanner({ status: 'dunning', periodEnd: day(-1), dunningStage: 'd0' }, NOW)).toBe('dunning');
    expect(planBanner({ status: 'active', periodEnd: day(-2), dunningStage: 'd_plus_3' }, NOW)).toBe('dunning');
    expect(planBanner({ status: 'active', periodEnd: day(6), dunningStage: 'd_minus_7' }, NOW)).toBe('planExpiring');
  });
  it('trial ending in ≤ 7 days warns; later or free does not', () => {
    expect(planBanner({ status: 'trial', periodEnd: day(5), trialEndsAt: day(5) }, NOW)).toBe('planExpiring');
    expect(planBanner({ status: 'trial', periodEnd: day(12), trialEndsAt: day(12) }, NOW)).toBeNull();
    expect(planBanner({ status: 'active', periodEnd: day(3), free: true }, NOW)).toBeNull();
  });
  it('a plan the owner cancelled does not warn (the page says it)', () => {
    expect(planBanner({ status: 'active', periodEnd: day(3), cancelAtPeriodEnd: true }, NOW)).toBeNull();
    expect(planBanner(null, NOW)).toBeNull();
  });
});

describe('checkout return page (FL-28: 5 s × 12)', () => {
  it('keeps verifying until 12 answers, then shows EN ATTENTE', () => {
    expect(returnView('verifying', 0)).toBe('verifying');
    expect(returnView('verifying', POLL_MAX - 1)).toBe('verifying');
    expect(returnView('verifying', POLL_MAX)).toBe('pending');
    expect(returnView(undefined, 3)).toBe('verifying');
  });
  it('server states win; a 404 is an unknown ref', () => {
    expect(returnView('success', 1)).toBe('success');
    expect(returnView('failed', 1)).toBe('failed');
    expect(returnView('expired', 1)).toBe('expired');
    expect(returnView('pending', 1)).toBe('pending');
    expect(returnView('verifying', 1, true)).toBe('unknown');
  });
  it('polls fast while verifying, slowly while pending, never after a final state', () => {
    expect(pollDelay('verifying')).toBe(5_000);
    expect(pollDelay('pending')).toBe(15_000);
    expect(pollDelay('success')).toBe(false);
    expect(pollDelay('unknown')).toBe(false);
  });
});

describe('invoices', () => {
  it('pays only unpaid invoices with something left', () => {
    expect(canPayInvoice({ status: 'unpaid', remaining: 4900, pdfUrl: null })).toBe(true);
    expect(canPayInvoice({ status: 'unpaid', remaining: 0, pdfUrl: null })).toBe(false);
    expect(canPayInvoice({ status: 'paid', remaining: 0, pdfUrl: null })).toBe(false);
  });
  it('groups the payment method of the pill', () => {
    expect(methodGroup('cib')).toBe('cib');
    expect(methodGroup('manual_ccp')).toBe('manual');
    expect(methodGroup('google_play')).toBe('store');
    expect(methodGroup(null)).toBeNull();
  });
});

describe('credit calculator (PCK-05, AT-PCK-04)', () => {
  it('matches the API formula: 1 200 × 4, 15 %, 8 % ⇒ 5 988', () => {
    expect(estimateCredits({ conversations: 1200, msgsPerConv: 4, photoPct: 15, voicePct: 8 })).toEqual({ textTurns: 4800, imageTurns: 180, voiceTurns: 96, credits: 5988 });
  });
  it('keeps inputs in range', () => {
    expect(normalizeCalculator({ conversations: -5, msgsPerConv: 0, photoPct: 140, voicePct: 3.6 })).toEqual({ conversations: 0, msgsPerConv: 1, photoPct: 100, voicePct: 4 });
  });
});
