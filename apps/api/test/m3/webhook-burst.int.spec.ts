// M3 exit criterion (00-build-order, 07-non-functional §2): the webhook acknowledges a 1 000-message burst with
// p99 < 200 ms. Measured in-process against the real HTTP pipeline (keep-alive connections, 10 in flight: this machine also runs the dev servers during the suites), each request
// carrying its own signed delivery; the ack path is one SQL statement (raw event + outbox row), nothing else.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { signWebhookBody } from '../../src/modules/meta/meta-signature';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { APP_SECRET, connectedPage, db, delivery, messageItem, newSender } from '../support/m3';

let app: TestApp;
let port: number;
const IN_FLIGHT = 10;
const agent = new http.Agent({ keepAlive: true, maxSockets: IN_FLIGHT });
beforeAll(async () => {
  app = await createTestApp();
  await app.app.listen(0);
  port = (app.http().address() as AddressInfo).port;
});
afterAll(async () => {
  agent.destroy();
  await app.close();
});

const post = (raw: string) =>
  new Promise<{ status: number; ms: number; body: string }>((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = http.request(
      { host: '127.0.0.1', port, path: '/api/v1/webhooks/meta', method: 'POST', agent, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw), 'X-Hub-Signature-256': signWebhookBody(APP_SECRET, raw) } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, ms: Number(process.hrtime.bigint() - t0) / 1e6, body }));
      },
    );
    req.on('error', reject);
    req.end(raw);
  });
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;

describe('webhook ack under a burst', () => {
  it('1 000 webhook POSTs are acknowledged with p99 < 200 ms and every event is persisted once', async () => {
    const owner = await asOwner(app);
    const channel = await connectedPage(owner, app);
    const total = 1000;
    const sender = newSender();
    const bodies = Array.from({ length: total }, (_, i) => JSON.stringify(delivery(channel, [messageItem(channel, sender, { text: `burst ${i}` })])));
    const mids = bodies.map((b) => JSON.parse(b).entry[0].messaging[0].message.mid as string);
    for (let i = 0; i < 20; i++) await post(JSON.stringify(delivery(channel, [messageItem(channel, newSender(), { text: 'warm-up' })]))); // connections + query plans

    const latencies: number[] = [];
    let next = 0;
    let failed = 0;
    const started = Date.now();
    const worker = async () => {
      while (next < total) {
        const r = await post(bodies[next++]!);
        if (r.status !== 200 || r.body !== 'EVENT_RECEIVED') failed++;
        latencies.push(r.ms);
      }
    };
    await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
    const elapsed = Date.now() - started;

    latencies.sort((a, b) => a - b);
    const [p50, p95, p99, max] = [percentile(latencies, 50), percentile(latencies, 95), percentile(latencies, 99), latencies[latencies.length - 1]!];
    // the figures of this run, for the progress note
    process.stdout.write(`\n[webhook burst] ${total} POSTs, ${IN_FLIGHT} in flight, in ${elapsed} ms · p50 ${p50.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · p99 ${p99.toFixed(1)} ms · max ${max.toFixed(1)} ms\n`);
    expect(failed).toBe(0);
    expect(latencies).toHaveLength(total);
    expect(p99).toBeLessThan(200);
    // nothing lost, nothing duplicated: one raw event and one queued job per delivery
    expect(await db.inboundEvent.count({ where: { externalId: { in: mids } } })).toBe(total);
    expect(await db.outbox.count({ where: { topic: 'job', key: { in: mids.map((m) => `inbound:${m}`) } } })).toBe(total);
    // the ack path did no processing
    expect(await db.message.count({ where: { externalId: { in: mids } } })).toBe(0);
    // leave no work behind for the other suites
    await db.outbox.updateMany({ where: { topic: 'job', key: { startsWith: 'inbound:' }, processedAt: null }, data: { processedAt: new Date() } });
  }, 120_000);
});
