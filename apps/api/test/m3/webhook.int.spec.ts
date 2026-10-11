// M3 — MSG-01 / MSG-03 / MSG-08: Meta webhook (verify handshake, raw-body signature, immediate ack, raw InboundEvent,
// dedup), data-deletion callback + public status, and the dev simulator. Only the fake adapter runs; no network.
import request from 'supertest';
import { StorageService } from '../../src/core/storage/storage.service';
import { InboundProcessor } from '../../src/modules/messaging/inbound.processor';
import { buildSignedRequest, signWebhookBody } from '../../src/modules/meta/meta-signature';
import { asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { APP_SECRET, connectedPage, db, delivery, forbidNetwork, messageItem, newSender, postWebhook, receive, VERIFY_TOKEN, work } from '../support/m3';

let app: TestApp;
let net: ReturnType<typeof forbidNetwork>;
beforeAll(async () => {
  net = forbidNetwork();
  app = await createTestApp();
});
afterAll(async () => {
  expect(net.spy).not.toHaveBeenCalled();
  net.restore();
  await app.close();
});

const midOf = (item: { message: unknown }) => (item.message as { mid: string }).mid;

describe('GET /webhooks/meta — subscription handshake (we only answer it)', () => {
  it('echoes the challenge for the right verify token, 403 otherwise', async () => {
    const ok = await request(app.http()).get('/api/v1/webhooks/meta').query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': '1158201444' }).expect(200);
    expect(ok.text).toBe('1158201444');
    expect(ok.headers['content-type']).toContain('text/plain');
    await request(app.http()).get('/api/v1/webhooks/meta').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '1' }).expect(403);
    await request(app.http()).get('/api/v1/webhooks/meta').query({ 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': '1' }).expect(403);
    await request(app.http()).get('/api/v1/webhooks/meta').expect(403);
  });
});

describe('POST /webhooks/meta', () => {
  it('AT-MSG-01 webhook with bad signature ⇒ 401, nothing stored; good ⇒ 200 < 200 ms, event persisted', async () => {
    const owner = await asOwner(app);
    const channel = await connectedPage(owner, app);
    const item = messageItem(channel, newSender(), { text: 'Salam' });
    const body = delivery(channel, [item]);
    const raw = JSON.stringify(body);
    const stored = () => db.inboundEvent.count({ where: { externalId: midOf(item) } });

    // invalid: wrong secret, signature of another body, malformed header, missing header
    for (const signature of [signWebhookBody('another-secret', raw), signWebhookBody(APP_SECRET, `${raw} `), 'sha1=abcdef', 'sha256=', null]) {
      const res = await postWebhook(app, raw, signature).expect(401);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    }
    expect(await stored()).toBe(0);
    expect(await db.outbox.count({ where: { topic: 'job', key: `inbound:${midOf(item)}` } })).toBe(0);

    // valid: acknowledged at once, raw event persisted, processing queued with its deterministic id
    await postWebhook(app, delivery(channel, [messageItem(channel, newSender(), { text: 'warm-up' })])).expect(200);
    const t0 = process.hrtime.bigint();
    const ok = await postWebhook(app, raw).expect(200);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    expect(ok.text).toBe('EVENT_RECEIVED');
    expect(ms).toBeLessThan(200);
    const ev = await db.inboundEvent.findUniqueOrThrow({ where: { externalId: midOf(item) } });
    expect(ev).toMatchObject({ provider: 'meta', processedAt: null });
    expect(ev.payload).toMatchObject({ object: 'page', entryId: channel.externalId, item: { message: { text: 'Salam' } } });
    const job = await db.outbox.findUniqueOrThrow({ where: { topic_key: { topic: 'job', key: `inbound:${midOf(item)}` } } });
    expect(job.payload).toMatchObject({ queue: 'meta-inbound', name: 'process-event', data: { inboundEventId: ev.id }, opts: { attempts: 5 } });
    // the ack did not process anything: the message appears only once the worker ran
    expect(await db.message.count({ where: { externalId: midOf(item) } })).toBe(0);
    await work(app, [owner.workspaceId]);
    expect(await db.message.count({ where: { externalId: midOf(item) } })).toBe(1);
    expect((await db.inboundEvent.findUniqueOrThrow({ where: { id: ev.id } })).processedAt).not.toBeNull();
  });

  it('AT-MSG-02 same mid delivered twice ⇒ one Message, one reply', async () => {
    const owner = await asOwner(app);
    const channel = await connectedPage(owner, app);
    const sender = newSender();
    const item = messageItem(channel, sender, { text: 'Bonjour, prix ?' });
    await postWebhook(app, delivery(channel, [item])).expect(200);
    await postWebhook(app, delivery(channel, [item])).expect(200); // Meta redelivery before processing
    expect(await db.inboundEvent.count({ where: { externalId: midOf(item) } })).toBe(1);
    expect(await db.outbox.count({ where: { topic: 'job', key: `inbound:${midOf(item)}` } })).toBe(1);
    await work(app, [owner.workspaceId]);
    await postWebhook(app, delivery(channel, [item])).expect(200); // and again after processing
    await work(app, [owner.workspaceId]);

    const conversation = await db.conversation.findFirstOrThrow({ where: { channelId: channel.id, externalSenderId: sender } });
    expect(await db.message.count({ where: { conversationId: conversation.id } })).toBe(1);
    expect(conversation.unreadCount).toBe(1);
    // the job itself is safe to run twice (BullMQ at-least-once)
    const ev = await db.inboundEvent.findUniqueOrThrow({ where: { externalId: midOf(item) } });
    expect(await app.app.get(InboundProcessor).process(ev.id)).toBe('noop');
    await db.inboundEvent.update({ where: { id: ev.id }, data: { processedAt: null } });
    expect(await app.app.get(InboundProcessor).process(ev.id)).toBe('duplicate');
    expect(await db.message.count({ where: { conversationId: conversation.id } })).toBe(1);
    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).unreadCount).toBe(1);
    // one client, one identity for that sender
    expect(await db.clientIdentity.count({ where: { channelId: channel.id, externalSenderId: sender } })).toBe(1);
  });

  it('events for an unknown page, other objects and `changes` are acknowledged and produce nothing', async () => {
    const ghost = { platform: 'facebook', externalId: `9${Date.now()}` };
    const item = messageItem(ghost, newSender(), { text: 'who?' });
    await postWebhook(app, delivery(ghost, [item])).expect(200);
    await work(app, []);
    expect(await db.inboundEvent.findUniqueOrThrow({ where: { externalId: midOf(item) } })).toMatchObject({ error: 'channel_not_found' });
    expect(await db.message.count({ where: { externalId: midOf(item) } })).toBe(0);

    const before = await db.inboundEvent.count();
    await postWebhook(app, { object: 'page', entry: [{ id: ghost.externalId, time: Date.now(), changes: [{ field: 'feed', value: { item: 'comment' } }] }] }).expect(200);
    await postWebhook(app, { object: 'user', entry: [{ id: '1', messaging: [item] }] }).expect(200);
    await postWebhook(app, {}).expect(200);
    expect(await db.inboundEvent.count()).toBe(before);
  });

  it('a workspace is never taken from the payload: the page id decides, and the other workspace sees nothing (tenancy)', async () => {
    const a = await asOwner(app);
    const b = await asOwner(app);
    const channelA = await connectedPage(a, app);
    await connectedPage(b, app);
    const { conversation } = await receive(app, channelA, newSender(), { text: 'pour A' });
    expect(conversation.workspaceId).toBe(a.workspaceId);
    expect((await a.get('/conversations').expect(200)).body.data.map((c: { id: string }) => c.id)).toEqual([conversation.id]);
    expect((await b.get('/conversations').expect(200)).body.data).toEqual([]);
    await b.get(`/conversations/${conversation.id}`).expect(404);
  });
});

describe('MSG-08 Meta data deletion', () => {
  const callbackUrl = '/api/v1/webhooks/meta/data-deletion';

  it('AT-MSG-07 Meta data-deletion request ⇒ all conversations of that sender hard-deleted, status URL returns done', async () => {
    const a = await asOwner(app);
    const b = await asOwner(app);
    const channelA = await connectedPage(a, app);
    const channelB = await connectedPage(b, app);
    const sender = newSender();
    const keep = newSender();
    const first = await receive(app, channelA, sender, { text: 'photo', attachments: [{ type: 'image', payload: { url: 'https://fake.meta.local/a.jpg' } }] });
    await receive(app, channelB, sender, { text: 'même personne, autre boutique' });
    const other = await receive(app, channelA, keep, { text: 'je reste' });
    await a.post(`/conversations/${first.conversation.id}/notes`, { body: 'note interne' }).expect(201);
    const stored = (await db.message.findUniqueOrThrow({ where: { id: first.message!.id } })).attachments as { storageKey: string }[];
    const storage = app.app.get(StorageService);
    await storage.get(stored[0]!.storageKey); // the media was copied to our storage

    // invalid signed_request ⇒ 401, nothing registered
    const before = await db.dataDeletionRequest.count();
    for (const signed of ['garbage', buildSignedRequest('another-secret', { user_id: sender }), '']) {
      const res = await request(app.http()).post(callbackUrl).type('form').send({ signed_request: signed }).expect(401);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    }
    expect(await db.dataDeletionRequest.count()).toBe(before);

    const res = await request(app.http()).post(callbackUrl).type('form').send({ signed_request: buildSignedRequest(APP_SECRET, { user_id: sender }) }).expect(200);
    const code: string = res.body.confirmation_code;
    expect(res.body.url).toMatch(new RegExp(`/meta/data-deletion/${code}$`));
    expect((await request(app.http()).get(`/api/v1/data-deletion/${code}`).expect(200)).body.data).toMatchObject({ code, status: 'pending', completedAt: null });
    // Meta repeating the callback gets the same pending request
    const again = await request(app.http()).post(callbackUrl).type('form').send({ signed_request: buildSignedRequest(APP_SECRET, { user_id: sender }) }).expect(200);
    expect(again.body.confirmation_code).toBe(code);

    expect(await work(app, [a.workspaceId, b.workspaceId])).toContain('meta-data-deletion');
    expect(await db.conversation.count({ where: { externalSenderId: sender } })).toBe(0);
    expect(await db.message.count({ where: { conversationId: first.conversation.id } })).toBe(0);
    expect(await db.conversationNote.count({ where: { conversationId: first.conversation.id } })).toBe(0);
    expect(await db.clientIdentity.count({ where: { externalSenderId: sender } })).toBe(0);
    expect(await db.client.count({ where: { id: { in: [first.conversation.clientId!] } } })).toBe(0); // placeholder without orders
    await expect(storage.get(stored[0]!.storageKey)).rejects.toBeTruthy(); // stored media gone
    // the other customer is untouched
    expect(await db.message.count({ where: { conversationId: other.conversation.id } })).toBe(1);
    const done = (await request(app.http()).get(`/api/v1/data-deletion/${code}`).expect(200)).body.data;
    expect(done).toMatchObject({ code, status: 'done' });
    expect(done.completedAt).not.toBeNull();
    expect((await db.dataDeletionRequest.findUniqueOrThrow({ where: { confirmationCode: code } })).affectedWorkspaces).toBe(2);
    // unknown code: a state, not an error
    expect((await request(app.http()).get('/api/v1/data-deletion/NOPE').expect(200)).body.data).toEqual({ code: 'NOPE', status: 'not_found', requestedAt: null, completedAt: null });
  });
});

describe('dev simulator (fake adapter, outside production only)', () => {
  it('injects a signed delivery with an image for a connected fake page; the message lands in the inbox', async () => {
    const owner = await asOwner(app);
    const channel = await connectedPage(owner, app);
    const res = await owner.post('/dev/meta/inbound', { channelId: channel.id, text: 'Photo du produit', image: true }).expect(200);
    expect(res.body.data).toMatchObject({ signed: true, stored: 1 });
    await work(app, [owner.workspaceId]);
    const list = (await owner.get('/conversations').expect(200)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ lastMessagePreview: 'Photo du produit', unreadCount: 1, lastMessageDirection: 'in' });
    const thread = (await owner.get(`/conversations/${list[0].id}/messages`).expect(200)).body.data;
    expect(thread[0]).toMatchObject({ direction: 'in', type: 'image', author: 'customer', text: 'Photo du produit' });
    expect(thread[0].attachments[0]).toMatchObject({ type: 'image', mime: 'image/jpeg', width: 640, height: 480, pending: false });
    expect(thread[0].attachments[0].url).toContain('/api/v1/files/ws/');
    // guards: tenant, role
    const stranger = await asOwner(app);
    await stranger.post('/dev/meta/inbound', { channelId: channel.id }).expect(404);
    const op = await asOperator(app, owner.workspaceId);
    await op.post('/dev/meta/inbound', { channelId: channel.id }).expect(403);
  });
});
