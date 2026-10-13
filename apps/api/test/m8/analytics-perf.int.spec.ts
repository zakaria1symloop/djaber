// M8 exit criterion (00-build-order): analytics endpoints p95 < 500 ms on 100 k orders with the pre-aggregated daily
// rollups. Seeds one workspace with 100 000 orders (+ lines, parcels, conversations, messages, AI runs) spread over a
// year with set-based SQL, runs the nightly rollup once, then times the overview + the 8 tabs over 365 days.
import { rawPrisma as db } from '@djaber/db';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { DailyStatsService } from '../../src/modules/analytics/daily-stats.service';
import { addDays } from '../../src/modules/analytics/range';
import { aiModel, channel, todayAlgiers } from '../support/m8';
import { product } from '../support/m7';

jest.setTimeout(600_000);

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

const ORDERS = 100_000;
const CONVERSATIONS = 30_000;
const TABS = ['overview', 'conversations', 'responses', 'consumption', 'agents', 'channels', 'products', 'orders', 'delivery'];
const RUNS = 8;

it('overview + 8 tabs over 365 days on 100 000 orders: p95 < 500 ms with the rollups', async () => {
  const owner = await asOwner(app);
  const ws = owner.workspaceId;
  const ch = await channel(ws, owner.userId);
  const p = await product(owner, { name: 'Perf', price: 2000, stock: 0 });
  const model = await aiModel();
  const t0 = Date.now();
  const [client] = await db.$queryRaw<{ id: string }[]>`
    INSERT INTO "Client" ("workspaceId", "name", "phone", "updatedAt") VALUES (${ws}::uuid, 'Client perf', '0550001122', now()) RETURNING "id"`;
  await db.$executeRaw`
    INSERT INTO "Order" ("workspaceId", "number", "clientId", "source", "status", "clientName", "clientPhone", "subtotal", "deliveryFee", "total", "amountPaid",
                         "orderedAt", "confirmedAt", "shippedAt", "deliveredAt", "cancelledAt", "cancelReason", "channelId", "wilayaId", "paymentMethod", "updatedAt")
    SELECT ${ws}::uuid, 'P-' || g, ${client!.id}::uuid, (CASE WHEN g % 3 = 0 THEN 'ai' ELSE 'manual' END)::"OrderSource", x.st::"OrderStatus", 'Client perf', '0550001122',
           2000, 400, 2400, CASE WHEN x.st = 'delivered' THEN 2400 ELSE 0 END,
           x.t, CASE WHEN x.st IN ('confirmed','shipped','delivered') THEN x.t + interval '1 hour' END,
           CASE WHEN x.st IN ('shipped','delivered') THEN x.t + interval '1 day' END,
           CASE WHEN x.st = 'delivered' THEN LEAST(x.t + interval '2 days', now()) END,
           CASE WHEN x.st = 'cancelled' THEN x.t + interval '3 hours' END,
           CASE WHEN x.st = 'cancelled' THEN 'unreachable'::"CancelReason" END,
           ${ch.id}::uuid, 1 + g % 58, 'cash', now()
    FROM generate_series(1, ${ORDERS}) g,
         LATERAL (SELECT now() - ((g % 365) || ' days')::interval - ((g % 1440) || ' minutes')::interval AS t,
                         (ARRAY['new','confirmed','shipped','delivered','delivered','cancelled'])[1 + g % 6] AS st) x`;
  await db.$executeRaw`
    INSERT INTO "OrderItem" ("orderId", "productId", "productName", "unitPrice", "costPrice", "quantity", "total")
    SELECT o."id", ${p.id}::uuid, 'Perf', 2000, 800, 1, 2000 FROM "Order" o WHERE o."workspaceId" = ${ws}::uuid`;
  await db.$executeRaw`
    INSERT INTO "Shipment" ("workspaceId", "orderId", "provider", "status", "publicTrackingToken", "codAmount", "courierCost", "createdAt", "lastEventAt", "updatedAt")
    SELECT ${ws}::uuid, o."id", 'manual', (CASE WHEN o."status" = 'delivered' THEN 'delivered' ELSE 'in_transit' END)::"ShipmentStatus", 'pt-' || o."number", 2400, 350,
           o."shippedAt", COALESCE(o."deliveredAt", o."shippedAt"), now()
    FROM "Order" o WHERE o."workspaceId" = ${ws}::uuid AND o."shippedAt" IS NOT NULL`;
  await db.$executeRaw`
    INSERT INTO "Conversation" ("workspaceId", "channelId", "externalSenderId", "createdAt", "lastMessageAt", "updatedAt", "lastAiIntent")
    SELECT ${ws}::uuid, ${ch.id}::uuid, 'perf-' || g, now() - ((g % 365) || ' days')::interval, now(), now(), (CASE WHEN g % 4 = 0 THEN 'sale' END)::"AiIntent"
    FROM generate_series(1, ${CONVERSATIONS}) g`;
  await db.$executeRaw`
    INSERT INTO "Message" ("workspaceId", "conversationId", "direction", "author", "text", "sentAt")
    SELECT ${ws}::uuid, c."id", d.dir::"MessageDirection", d.au::"MessageAuthor", 'x', c."createdAt" + (d.n || ' minutes')::interval
    FROM "Conversation" c CROSS JOIN (VALUES ('in', 'customer', 0), ('out', 'ai', 1), ('in', 'customer', 2)) AS d(dir, au, n)
    WHERE c."workspaceId" = ${ws}::uuid`;
  await db.$executeRaw`
    INSERT INTO "AiRun" ("workspaceId", "conversationId", "kind", "modelId", "providerId", "status", "inputTokens", "outputTokens", "latencyMs", "batchKey", "startedAt")
    SELECT ${ws}::uuid, c."id", 'reply', ${model.id}::uuid, ${model.providerId}::uuid, (CASE WHEN c."externalSenderId" LIKE '%7' THEN 'handoff' ELSE 'ok' END)::"AiRunStatus",
           1200, 150, 1800, 'perf', c."createdAt" + interval '1 minute'
    FROM "Conversation" c WHERE c."workspaceId" = ${ws}::uuid`;
  await db.$executeRaw`ANALYZE`;
  const seeded = Date.now() - t0;

  const stats = app.app.get(DailyStatsService);
  const r0 = Date.now();
  const rolled = await stats.rollupWorkspace(ws, addDays(todayAlgiers(), -1));
  const rollupMs = Date.now() - r0;
  expect(rolled.written).toBeGreaterThanOrEqual(365);

  const to = todayAlgiers();
  const from = addDays(to, -364);
  const samples: number[] = [];
  const perTab: Record<string, number[]> = {};
  // one warm-up call per tab (JIT / connection pool), then RUNS timed calls each
  for (const tab of TABS) await owner.get(`/analytics/${tab}?from=${from}&to=${to}`).expect(200);
  for (let i = 0; i < RUNS; i++) {
    for (const tab of TABS) {
      const s = Date.now();
      const res = await owner.get(`/analytics/${tab}?from=${from}&to=${to}`).expect(200);
      const ms = Date.now() - s;
      samples.push(ms);
      (perTab[tab] ??= []).push(ms);
      if (tab === 'orders' && i === 0) {
        expect(res.body.data.kpis.orders.value).toBeGreaterThanOrEqual(ORDERS - 300);
        expect(res.body.data.range.source.rollupDays).toBeGreaterThanOrEqual(364);
      }
    }
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!;
  const p50 = samples[Math.floor(samples.length / 2)]!;
  console.log(JSON.stringify({ seededMs: seeded, rollupMs, samples: samples.length, p50, p95, max: samples[samples.length - 1], perTabP50: Object.fromEntries(Object.entries(perTab).map(([k, v]) => [k, v.sort((a, b) => a - b)[Math.floor(v.length / 2)]])) }));
  expect(p95).toBeLessThan(500);
});
