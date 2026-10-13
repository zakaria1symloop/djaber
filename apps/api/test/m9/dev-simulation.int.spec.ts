// M9 — the development payment simulator (PAYMENT_DRIVER=fake / IAP_DRIVER=fake only): the fake Chargily checkout page and
// the dev shortcuts the web e2e uses to reach billing states without `page.route` mocks. Every choice goes through the
// real webhook / receipt code paths.
import request from 'supertest';
import { asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { eventually } from '../support/m1';
import { forbidNetwork } from '../support/m3';
import { channels, checkoutIdOf, currentSubOf, db, idem, makeTrial, planId } from '../support/m9';

let app: TestApp;
let net: ReturnType<typeof forbidNetwork>;
beforeAll(async () => {
  app = await createTestApp();
  net = forbidNetwork();
});
afterAll(async () => {
  net.restore();
  await app.close();
});

describe('fake checkout page /dev-payments/:id', () => {
  it('shows the amount and the four choices; a form post records the choice, delivers the signed webhook and redirects (303) to the web return page', async () => {
    const owner = await asOwner(app);
    await makeTrial(app, owner.workspaceId);
    const r = (await owner.post('/billing/checkout', { planId: await planId('starter'), cycle: 'monthly' }).set(idem()).expect(200)).body.data;
    const path = new URL(r.checkoutUrl).pathname;
    const page = await request(app.http()).get(path).expect(200);
    expect(page.headers['content-type']).toContain('text/html');
    // the 303 after a choice goes to the web: the page's CSP must allow the web origin as a form target
    expect(page.headers['content-security-policy']).toMatch(/form-action 'self' [^;]*http/);
    for (const id of ['dev-pay-paid', 'dev-pay-failed', 'dev-pay-expired', 'dev-pay-pending', 'dev-pay-amount', 'dev-pay-reason']) expect(page.text).toContain(`data-testid="${id}"`);
    expect(page.text).toContain('1 900 DA');
    const post = await request(app.http()).post(path).type('form').send({ outcome: 'paid' }).expect(303);
    expect(String(post.headers.location).endsWith(`/fr/settings/billing/return?ref=${r.ref}`)).toBe(true);
    expect((await currentSubOf(owner.workspaceId)).plan.slug).toBe('starter');
    expect((await owner.get(`/billing/checkout/return?ref=${r.ref}`).expect(200)).body.data.status).toBe('success');
    expect(await eventually(() => db.auditLog.count({ where: { action: 'dev_payment.decided', after: { path: ['checkoutId'], equals: checkoutIdOf(r.checkoutUrl) } } }))).toBe(1);
    // JSON post answers the redirect; unknown checkout ⇒ 404; bad outcome ⇒ 422
    const r2 = (await owner.post('/billing/checkout', { planId: await planId('pro'), cycle: 'monthly' }).set(idem()).expect(200)).body.data;
    expect((await request(app.http()).post(new URL(r2.checkoutUrl).pathname).send({ outcome: 'failed', reason: 'otp_failed' }).expect(200)).body.data).toMatchObject({ outcome: 'failed', status: 'failed', redirectUrl: expect.stringContaining(r2.ref) });
    expect((await owner.get(`/billing/checkout/return?ref=${r2.ref}`).expect(200)).body.data).toMatchObject({ status: 'failed', failureReason: 'otp_failed' });
    await request(app.http()).get('/api/v1/dev-payments/01fakeunknown').expect(404);
    await request(app.http()).post(new URL(r2.checkoutUrl).pathname).send({ outcome: 'refund' }).expect(422);
  });
});

describe('dev billing shortcuts', () => {
  it('subscription states on demand: expire (free + paused by plan), renew (pauses lifted), expiring / dunning stages, trial end; packs and store refunds; Operator 403', async () => {
    const owner = await asOwner(app);
    await (await asOperator(app, owner.workspaceId)).post('/dev/billing/subscription', { action: 'expire' }).expect(403);
    await makeTrial(app, owner.workspaceId);
    await channels(owner.workspaceId, 2);
    const expired = (await owner.post('/dev/billing/subscription', { action: 'expire' }).expect(200)).body.data;
    expect(expired).toMatchObject({ plan: { slug: 'free' }, expiredFrom: { planSlug: 'pro' } });
    expect(expired.pausedResources).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'channel', name: 'Page 2' }), expect.objectContaining({ type: 'member' })]));
    const renewed = (await owner.post('/dev/billing/subscription', { action: 'renew', planSlug: 'starter' }).expect(200)).body.data;
    expect(renewed).toMatchObject({ plan: { slug: 'starter' }, status: 'active', provider: 'manual', pausedResources: [] });
    expect((await owner.post('/dev/billing/subscription', { action: 'expiring' }).expect(200)).body.data).toMatchObject({ dunningStage: 'd_minus_7' });
    expect((await owner.post('/dev/billing/subscription', { action: 'dunning', stage: 'd0' }).expect(200)).body.data).toMatchObject({ status: 'dunning', dunningStage: 'd0', unpaidInvoice: { amount: 1900 } });
    expect((await owner.post('/dev/billing/subscription', { action: 'dunning', stage: 'd_plus_3' }).expect(200)).body.data).toMatchObject({ dunningStage: 'd_plus_3' });
    const t = await asOwner(app);
    await makeTrial(app, t.workspaceId);
    expect((await t.post('/dev/billing/subscription', { action: 'trial_end' }).expect(200)).body.data).toMatchObject({ plan: { slug: 'free' }, expiredFrom: { planSlug: 'pro' } });
    // packs through the fake store, then a refund that makes the balance negative
    const p = (await owner.post('/dev/billing/pack', {}).expect(200)).body.data;
    expect(p).toMatchObject({ status: 'credited', creditsAdded: 500, transactionId: expect.stringMatching(/^GPA\./) });
    await owner.post('/dev/billing/pack', { platform: 'app_store' }).expect(200);
    const refund = (await owner.post('/dev/billing/store-refund', { transactionId: p.transactionId }).expect(200)).body.data;
    expect(refund.received).toBe(1);
    expect(refund.balance.packs.remaining).toBe(500);
    expect((await db.creditPackPurchase.findUniqueOrThrow({ where: { storeTransactionId: p.transactionId } })).status).toBe('refunded');
    // clock: a fresh trial 15 days later is on the free plan
    const c = await asOwner(app);
    await makeTrial(app, c.workspaceId);
    expect((await c.post('/dev/billing/clock', { days: 15 }).expect(200)).body.data.plan.slug).toBe('free');
    expect((await c.get('/dev/billing/help').expect(200)).body.data.driver).toEqual({ payments: 'fake', stores: 'fake' });
  });
});
