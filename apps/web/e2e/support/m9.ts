// M9 — billing on the REAL API (PAYMENT_DRIVER=fake, IAP_DRIVER=fake): every checkout answers
// `checkoutUrl = <api>/api/v1/dev-payments/<checkoutId>`, a plain page with the buttons Payé · Échoué · Expiré ·
// En attente that delivers a signed Chargily webhook and redirects to `/{locale}/settings/billing/return?ref=`.
// `POST /dev-payments/:id { outcome }` does the same without the page; `POST /dev/billing/clock { days }` ages the
// subscription and runs the daily jobs (trial 15 d ⇒ expired; paid monthly 23 ⇒ J−7, 30 ⇒ dunning d0, 33 ⇒ d+3, 37 ⇒
// expired); `POST /dev/billing/pack` credits a store pack, `POST /dev/billing/store-refund` refunds it. No real payment.
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { clearRateLimits } from './global-setup';
import { API, authHeaders, mailLink, PASSWORD, uniqueEmail, waitForMail, type Account } from './m1';
import { idem, realGet, realPost } from './m4-real';

type Json = Record<string, unknown>;
export type E2ePlan = { id: string; slug: string; name: string; priceMonthly: number; priceYearly: number; limits: { maxPages: number; maxAgents: number; monthlyCredits: number; features: string[] } };
export type E2eSubscription = { id: string; plan: E2ePlan; status: string; billingCycle: string; cancelAtPeriodEnd: boolean; dunningStage: string | null; currentPeriodEnd: string; unpaidInvoice: { id: string; number: string; amount: number; remaining: number } | null; expiredFrom: { planName: string; at: string } | null; pausedResources: { type: string; id: string; name: string }[]; nextPlan: { slug: string } | null };
export type E2eInvoice = { id: string; number: string; status: string; amount: number; remaining: number; kind: string };
export type E2ePack = { id: string; slug: string; name: string; credits: number; priceWebDzd: number };

/** True when the M9 billing endpoints answer. */
export async function billingReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    const r = await request.get(`${API}/billing/subscription`, { headers: authHeaders(a), timeout: 5000 });
    return r.ok();
  } catch {
    return false;
  }
}

export const plansOf = (request: APIRequestContext, a: Account) => realGet<E2ePlan[]>(request, a, '/plans');
export const planBySlug = async (request: APIRequestContext, a: Account, slug: string) => {
  const p = (await plansOf(request, a)).find((x) => x.slug === slug);
  if (!p) throw new Error(`plan ${slug} not found`);
  return p;
};
export const subscriptionOf = (request: APIRequestContext, a: Account) => realGet<E2eSubscription>(request, a, '/billing/subscription');
export const invoicesOf = (request: APIRequestContext, a: Account, query = '') => realGet<E2eInvoice[]>(request, a, `/billing/invoices${query}`);
export const packsOf = (request: APIRequestContext, a: Account) => realGet<E2ePack[]>(request, a, '/credit-packs');

/** The checkout id at the end of a fake `checkoutUrl` (`…/dev-payments/<id>`). */
export const checkoutIdOf = (url: string): string => {
  const m = /\/dev-payments\/([^/?#]+)/.exec(url);
  if (!m) throw new Error(`not a fake checkout url: ${url}`);
  return m[1]!;
};
/** Chooses the outcome of a fake checkout over HTTP (same effect as the button of the dev page). */
export const payOutcome = (request: APIRequestContext, a: Account, checkoutUrl: string, outcome: 'paid' | 'failed' | 'expired' | 'pending') =>
  realPost<{ redirectUrl: string }>(request, a, `/dev-payments/${checkoutIdOf(checkoutUrl)}`, { outcome });

/** Subscribes the workspace to a paid plan through the fake gateway (checkout + "Payé"), then waits for the activation. */
export async function subscribe(request: APIRequestContext, a: Account, slug: 'starter' | 'pro', cycle: 'monthly' | 'yearly' = 'monthly'): Promise<E2eSubscription> {
  const plan = await planBySlug(request, a, slug);
  const r = await realPost<{ checkoutUrl: string | null; ref: string | null }>(request, a, '/billing/checkout', { planId: plan.id, cycle }, idem());
  expect(r.checkoutUrl, 'checkout url').toBeTruthy();
  await payOutcome(request, a, r.checkoutUrl!, 'paid');
  let sub: E2eSubscription | null = null;
  await expect
    .poll(async () => {
      sub = await subscriptionOf(request, a);
      return `${sub.plan.slug}/${sub.status}/${sub.billingCycle}`;
    }, { timeout: 30_000 })
    .toBe(`${slug}/active/${cycle}`);
  return sub!;
}

/** Ages the current subscription by `days` and runs the daily billing jobs (fake driver only). */
export const billingClock = (request: APIRequestContext, a: Account, days: number) => realPost<Json>(request, a, '/dev/billing/clock', { days });
/** Jumps the current subscription to a lifecycle state (`expire`, `expiring`, `dunning` + stage, `trial_end`, `renew`). */
export const devSubscription = (request: APIRequestContext, a: Account, action: 'expire' | 'expiring' | 'dunning' | 'trial_end' | 'renew', o: { stage?: 'd_minus_7' | 'd0' | 'd_plus_3'; planSlug?: string } = {}) =>
  realPost<E2eSubscription>(request, a, '/dev/billing/subscription', { action, ...o });
/** Credits a store pack (fake IAP) and returns the transaction id for a later refund. */
export const devPack = (request: APIRequestContext, a: Account, o: Json = {}) => realPost<{ transactionId: string } & Json>(request, a, '/dev/billing/pack', o);
export const devStoreRefund = (request: APIRequestContext, a: Account, transactionId?: string) => realPost<Json>(request, a, '/dev/billing/store-refund', transactionId ? { transactionId } : {});

/**
 * On the fake gateway page: chooses Payé · Échoué · Expiré · En attente. The page's form post answers
 * `303 Location: <web>/…/settings/billing/return?ref=` but Chromium refuses to follow that cross-origin redirect under
 * the API's CSP `form-action 'self'` (reported to the API, web-requests F): the same form post is sent here and the
 * browser goes to the `Location` itself — the decision, the signed webhook and the return URL are the API's own.
 */
export async function chooseOnGateway(page: Page, outcome: 'paid' | 'failed' | 'expired' | 'pending') {
  await expect(page).toHaveURL(/\/dev-payments\//, { timeout: 30_000 });
  await expect(page.getByTestId(`dev-pay-${outcome}`)).toBeVisible();
  const res = await page.request.post(page.url(), { form: { outcome }, maxRedirects: 0 });
  const location = res.headers()['location'];
  expect(location, `dev payment ${outcome}: ${res.status()}`).toBeTruthy();
  await page.goto(location!);
}

/** Regex of an amount as `formatNumber` prints it ("4 900": any space between the groups). */
export const amount = (n: number) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?'));

/** Invites a member with a role and registers it through the invitation e-mail (file mail driver). */
export async function inviteMember(request: APIRequestContext, owner: Account, role: 'admin' | 'operator', firstName = 'Nadia'): Promise<Account> {
  const email = uniqueEmail(role);
  const before = Date.now() - 2_000;
  const inv = await request.post(`${API}/workspace/invitations`, { headers: authHeaders(owner), data: { email, role } });
  expect(inv.status(), `invite: ${await inv.text()}`).toBeLessThan(300);
  const token = mailLink(await waitForMail(email, /^workspace\/invitation$/, { after: before })).split('/').pop()!.split('?')[0]!;
  const register = () => request.post(`${API}/auth/register`, { data: { firstName, lastName: 'Ferhat', email, password: PASSWORD, locale: 'fr', invitationToken: token } });
  let res = await register();
  if (res.status() === 429) {
    await clearRateLimits();
    res = await register();
  }
  expect(res.status(), `register ${role}: ${await res.text()}`).toBeLessThan(300);
  const { data } = (await res.json()) as { data: { accessToken: string } };
  return { email, password: PASSWORD, firstName, lastName: 'Ferhat', accessToken: data.accessToken, workspaceId: owner.workspaceId };
}
