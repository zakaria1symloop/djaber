// Small shared pieces of the billing module (dates, prices, current subscription, workspace lock).
import { prisma, type BillingCycle, type Plan, type Subscription, type Tx } from '@djaber/db';

export const DAY_MS = 86_400_000;
export const CURRENT_STATUSES = ['trial', 'active', 'dunning'] as const;

/** `from` + n months, clamped to the month length (31 Jan + 1 month = 28/29 Feb) — same rule as the credit periods. */
export const addMonths = (from: Date, n: number) => {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + n, 1, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(from.getUTCDate(), last));
  return d;
};
export const addCycle = (from: Date, cycle: BillingCycle) => addMonths(from, cycle === 'yearly' ? 12 : 1);
export const priceOf = (plan: Pick<Plan, 'priceMonthly' | 'priceYearly'>, cycle: BillingCycle) => (cycle === 'yearly' ? plan.priceYearly : cycle === 'monthly' ? plan.priceMonthly : 0);
/** A paid running period (a renewal / dunning target): Chargily or manual, with a cycle. */
export const isPaid = (s: Pick<Subscription, 'billingCycle' | 'provider'> | null | undefined) => !!s && s.billingCycle !== 'none' && s.provider !== 'none';
export const isFreePlan = (p: Pick<Plan, 'priceMonthly' | 'priceYearly'>) => p.priceMonthly === 0 && p.priceYearly === 0;

/** Serialises every billing write of a workspace (checkout activation, dunning, expiry, cancel) inside a transaction. */
export const lockBilling = (tx: Tx, workspaceId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId} || ':billing', 0))`;

export type SubWithPlan = Subscription & { plan: Plan };
export const currentSub = (db: Tx | typeof prisma, workspaceId: string): Promise<SubWithPlan | null> =>
  (db as Tx).subscription.findFirst({ where: { workspaceId, status: { in: [...CURRENT_STATUSES] } }, include: { plan: true }, orderBy: { createdAt: 'desc' } });

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
