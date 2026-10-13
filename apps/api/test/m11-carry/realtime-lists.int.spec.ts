// M11 carry-overs — real time and list filters: WebSocket `resync { since }` with the missed rows and `typing` relayed to
// the other members (03-events §2, M3 / M4 rows), `originSessionId` on `product.updated` (M2 row), client tag suggestions
// `GET /clients/tags` (M5 row), products of a supplier `GET /products?supplierId=` (M7 row).
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { TokenService } from '../../src/core/auth/token.service';
import { asAdmin, asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { adjust, createProduct, key, wsEvents } from '../support/m2';
import { connectedPage, forbidNetwork, newSender, receive } from '../support/m3';
import { closeOutbox, db } from '../support/m4';
import { newOrder, seedFees } from '../support/m5';
import { advancedShop, product, purchase, supplier } from '../support/m7';

let app: TestApp;
let url: string;
let net: ReturnType<typeof forbidNetwork>;
const sockets: Socket[] = [];
beforeAll(async () => {
  app = await createTestApp();
  await app.app.listen(0);
  url = `http://127.0.0.1:${(app.app.getHttpServer().address() as AddressInfo).port}/ws`;
  net = forbidNetwork();
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  expect(net.spy).not.toHaveBeenCalled();
  net.restore();
  await closeOutbox();
  await app.close();
});

const connectWs = (token: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
  });
const resync = (s: Socket, body: unknown) =>
  new Promise<any>((resolve) => {
    s.once('resync', resolve);
    s.emit('resync', body);
  });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('WebSocket resync (03-events §2)', () => {
  it('answers { conversations, orders, notificationsUnread } changed after `since`, scoped to the socket\'s workspace and member', async () => {
    const owner = await asOwner(app);
    const page = await connectedPage(owner, app);
    const before = await receive(app, page, newSender(), { text: 'Ancien' });
    await db.conversation.update({ where: { id: before.conversation.id }, data: { updatedAt: new Date(Date.now() - 3600_000) } });
    const since = new Date(Date.now() - 60_000).toISOString();
    const fresh = await receive(app, page, newSender(), { text: 'Bonjour' });
    await seedFees(app, owner.workspaceId);
    const { order } = await newOrder(owner);
    await db.notification.createMany({
      data: [
        { workspaceId: owner.workspaceId, userId: owner.userId, type: 'conversation_assigned' as never, title: {}, body: {} },
        { workspaceId: owner.workspaceId, userId: owner.userId, type: 'conversation_assigned' as never, title: {}, body: {}, readAt: new Date() },
      ],
    });
    // another workspace's rows never appear
    const other = await asOwner(app);
    await seedFees(app, other.workspaceId);
    await newOrder(other);

    const s = await connectWs(owner.token);
    const r = await resync(s, { since });
    expect(r.since).toBe(since);
    expect(r.conversations.map((c: any) => c.id)).toEqual([fresh.conversation.id]);
    expect(r.conversations[0]).toMatchObject({ id: fresh.conversation.id, status: 'active', aiPaused: false, unreadCount: 1, blocked: false, version: expect.any(Number) });
    expect(r.orders.map((o: any) => o.id)).toEqual([order.id]);
    expect(r.orders[0]).toMatchObject({ id: order.id, number: order.number, status: 'new', total: order.total, version: expect.any(Number) });
    expect(r.notificationsUnread).toBe(1);
    // no / invalid `since` ⇒ only the unread count (the client refetches its queries)
    const bare = await resync(s, {});
    expect(bare).toMatchObject({ since: null, conversations: [], orders: [], notificationsUnread: 1, at: expect.any(String) });
    expect((await resync(s, { since: 'hier' })).conversations).toEqual([]);
  });
});

describe('WebSocket typing (client → server)', () => {
  it('relayed as conversation.typing { conversationId, userId, at } to the other members only; unknown / foreign ids ignored; throttled', async () => {
    const owner = await asOwner(app);
    const page = await connectedPage(owner, app);
    const { conversation } = await receive(app, page, newSender(), { text: 'Salam' });
    const op = await asOperator(app, owner.workspaceId);
    const outsider = await asOwner(app);
    const foreign = await receive(app, await connectedPage(outsider, app), newSender(), { text: 'x' });
    const [sOwner, sOp, sOut] = await Promise.all([connectWs(owner.token), connectWs(op.token), connectWs(outsider.token)]);
    const got: Record<string, any[]> = { owner: [], op: [], out: [] };
    sOwner.on('conversation.typing', (p) => got.owner!.push(p));
    sOp.on('conversation.typing', (p) => got.op!.push(p));
    sOut.on('conversation.typing', (p) => got.out!.push(p));
    sOwner.emit('typing', { conversationId: conversation.id });
    sOwner.emit('typing', { conversationId: conversation.id }); // within 2 s: dropped
    sOwner.emit('typing', { conversationId: foreign.conversation.id }); // another workspace's thread
    sOwner.emit('typing', { conversationId: 'nope' });
    sOut.emit('typing', { conversationId: conversation.id });
    await wait(500);
    expect(got.op).toEqual([{ conversationId: conversation.id, userId: owner.userId, at: expect.any(String) }]);
    expect(got.owner).toEqual([]);
    expect(got.out).toEqual([]);
  });
});

describe('originSessionId on product.updated (M2 row)', () => {
  it('the session id of the request is carried by the WS event it causes; none without a session', async () => {
    const owner = await asOwner(app);
    const sid = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    const { token } = await app.app.get(TokenService).signAccess({ sub: owner.userId, wid: owner.workspaceId, role: 'owner', pr: 'none', sid });
    const p = await createProduct(owner, { stock: 5 });
    await request(app.http())
      .post('/api/v1/stock/adjustments')
      .set({ ...owner.headers, Authorization: `Bearer ${token}`, 'Idempotency-Key': key() })
      .send({ productId: p.id, type: 'in', quantity: 2, reason: 'correction' })
      .expect(201);
    const events = (await wsEvents(owner.workspaceId, 'product.updated')).filter((e) => e.payload.product.id === p.id);
    expect(events.at(-1)!.payload.originSessionId).toBe(sid);
    // the actor's token carries no `sid`
    await adjust(owner, { productId: p.id, type: 'in', quantity: 1, reason: 'correction' }).expect(201);
    expect((await wsEvents(owner.workspaceId, 'product.updated')).filter((e) => e.payload.product.id === p.id).at(-1)!.payload.originSessionId).toBeNull();
  });
});

describe('GET /clients/tags (M5 row)', () => {
  it('distinct tags of the live clients, count desc then tag, ?q filters, ≤ 100; every member; tenancy', async () => {
    const owner = await asOwner(app);
    const mk = (tags: string[], over: Record<string, unknown> = {}) => db.client.create({ data: { workspaceId: owner.workspaceId, name: 'C', tags, ...over } });
    await mk(['vip', 'oran']);
    await mk(['vip']);
    await mk(['VIP-2025', 'grossiste']);
    await mk(['vip'], { deletedAt: new Date() });
    await db.client.create({ data: { workspaceId: (await asOwner(app)).workspaceId, name: 'X', tags: ['vip', 'autre'] } });
    const op = await asOperator(app, owner.workspaceId);
    expect((await op.get('/clients/tags').expect(200)).body.data).toEqual([
      { tag: 'vip', count: 2 },
      { tag: 'grossiste', count: 1 },
      { tag: 'oran', count: 1 },
      { tag: 'VIP-2025', count: 1 },
    ]);
    expect((await owner.get('/clients/tags?q=vi').expect(200)).body.data).toEqual([{ tag: 'vip', count: 2 }, { tag: 'VIP-2025', count: 1 }]);
    expect((await owner.get('/clients/tags?q=50%').expect(200)).body.data).toEqual([]);
    await owner.get(`/clients/tags?q=${'x'.repeat(51)}`).expect(422);
    await owner.get('/clients/tags?other=1').expect(422);
    await db.client.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ workspaceId: owner.workspaceId, name: `T${i}`, tags: [`t-${i}`] })) });
    expect((await owner.get('/clients/tags').expect(200)).body.data).toHaveLength(100);
  });
});

describe('GET /products?supplierId= (M7 row)', () => {
  it('products in the purchase lines of the supplier (cancelled purchases excluded); same count as the supplier sheet; foreign supplier ⇒ empty', async () => {
    const owner = await advancedShop(app);
    const s1 = await supplier(owner);
    const s2 = await supplier(owner);
    const [a, b, c] = [await product(owner, { name: 'Alpha' }), await product(owner, { name: 'Bravo' }), await product(owner, { name: 'Charlie' })];
    await purchase(owner, { supplierId: s1.id, status: 'pending', items: [{ productId: a.id, quantity: 2, unitCost: 100 }, { productId: b.id, quantity: 1, unitCost: 100 }] });
    await purchase(owner, { supplierId: s1.id, status: 'pending', items: [{ productId: a.id, quantity: 3, unitCost: 100 }] });
    const cancelled = await purchase(owner, { supplierId: s1.id, status: 'pending', items: [{ productId: c.id, quantity: 1, unitCost: 100 }] });
    await owner.post(`/purchases/${cancelled.id}/cancel`, { reason: 'erreur' }).set('Idempotency-Key', key()).expect(200);
    await purchase(owner, { supplierId: s2.id, status: 'pending', items: [{ productId: c.id, quantity: 1, unitCost: 100 }] });
    const names = async (q: string) => ((await owner.get(`/products?${q}`).expect(200)).body.data as any[]).map((p) => p.name).sort();
    expect(await names(`supplierId=${s1.id}`)).toEqual(['Alpha', 'Bravo']);
    expect(await names(`supplierId=${s2.id}`)).toEqual(['Charlie']);
    expect((await owner.get(`/suppliers/${s1.id}`).expect(200)).body.data.productCount).toBe(2);
    expect(await names(`supplierId=${s1.id}&q=Bra`)).toEqual(['Bravo']);
    await owner.get('/products?supplierId=x').expect(422);
    const other = await asOwner(app);
    expect((await other.get(`/products?supplierId=${s1.id}`).expect(200)).body.data).toEqual([]);
    expect((await (await asAdmin(app, owner.workspaceId)).get(`/products?supplierId=${s2.id}`).expect(200)).body.data).toHaveLength(1);
  });
});
