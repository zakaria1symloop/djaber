// Loi 26-06 (69 wilayas): migration `20261015120000_wilayas_69` on a database seeded with the 58 historical wilayas.
// The "old" state is rebuilt inside a transaction (communes back under their parent, fee rows of 59–69 removed, an open
// order and its client address on the parent), the migration runs twice (idempotent), then everything is rolled back.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { closeOutbox } from '../support/m4';
import { seedFees } from '../support/m5';
import { confirmedOrder, db } from '../support/m6';

const MIGRATION = resolve(__dirname, '../../../../packages/db/prisma/migrations/20261015120000_wilayas_69/migration.sql');
const statements = readFileSync(MIGRATION, 'utf8')
  .split(/;\s*$/m)
  .map((s) => s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
  .filter(Boolean);
const PARENT = 'CASE "wilayaId" WHEN 59 THEN 3 WHEN 60 THEN 5 WHEN 61 THEN 7 WHEN 62 THEN 12 WHEN 63 THEN 13 WHEN 64 THEN 14 WHEN 65 THEN 17 WHEN 66 THEN 17 WHEN 67 THEN 26 WHEN 68 THEN 28 WHEN 69 THEN 32 END';
const ROLLBACK = 'rollback';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await closeOutbox();
  await app.close();
});

describe('migration wilayas_69 (existing databases)', () => {
  it('adds the 11 wilayas, moves 108 communes, copies the parent fee row, moves open orders and addresses; twice = once', async () => {
    const owner = await asOwner(app);
    await seedFees(app, owner.workspaceId);
    // a custom price on Djelfa must follow to Messaad (66) and Aïn Oussera (65)
    await db.deliveryFeeRule.update({ where: { workspaceId_wilayaId: { workspaceId: owner.workspaceId, wilayaId: 17 } }, data: { homePrice: 777, stopdeskPrice: 555, source: 'custom' } });
    const { order } = await confirmedOrder(owner, { delivery: { wilayaId: 66, communeId: 636, isStopdesk: false, address: 'Cité 200 logements, Bt 4' } });
    const before = await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { version: true, clientId: true } });

    await expect(
      db.$transaction(
        async (tx) => {
          // the state of a database seeded before the reform
          await tx.$executeRawUnsafe(`UPDATE "Commune" SET "wilayaId" = ${PARENT} WHERE "wilayaId" BETWEEN 59 AND 69`);
          await tx.$executeRaw`UPDATE "Order" SET "wilayaId" = 17 WHERE "id" = ${order.id}::uuid`;
          await tx.$executeRaw`UPDATE "ClientAddress" SET "wilayaId" = 17 WHERE "clientId" = ${before.clientId}::uuid`;
          await tx.$executeRaw`DELETE FROM "DeliveryFeeRule" WHERE "workspaceId" = ${owner.workspaceId}::uuid AND "wilayaId" BETWEEN 59 AND 69`;
          expect(await tx.commune.count({ where: { wilayaId: { gte: 59 } } })).toBe(0);

          for (let run = 0; run < 2; run++) for (const sql of statements) await tx.$executeRawUnsafe(sql);

          expect(await tx.wilaya.count()).toBe(69);
          expect(await tx.commune.count({ where: { wilayaId: { gte: 59 } } })).toBe(108);
          const per = await tx.commune.groupBy({ by: ['wilayaId'], where: { wilayaId: { in: [17, 28, 65, 66, 67, 68] } }, _count: { _all: true }, orderBy: { wilayaId: 'asc' } });
          expect(Object.fromEntries(per.map((p) => [p.wilayaId, p._count._all]))).toEqual({ 17: 18, 28: 24, 65: 10, 66: 8, 67: 21, 68: 23 });
          expect(await tx.deliveryFeeRule.count({ where: { workspaceId: owner.workspaceId } })).toBe(69);
          expect(await tx.deliveryFeeRule.findUnique({ where: { workspaceId_wilayaId: { workspaceId: owner.workspaceId, wilayaId: 66 } } })).toMatchObject({ homePrice: 777, stopdeskPrice: 555, source: 'custom', isActive: true });
          expect(await tx.deliveryFeeRule.findUnique({ where: { workspaceId_wilayaId: { workspaceId: owner.workspaceId, wilayaId: 68 } } })).toMatchObject({ homePrice: 650, source: 'default' });
          // the open order and the client's address follow their commune (version bumped once)
          expect(await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { wilayaId: true, version: true } })).toEqual({ wilayaId: 66, version: before.version + 1 });
          expect((await tx.clientAddress.findMany({ where: { clientId: before.clientId, communeId: 636 } })).every((a) => a.wilayaId === 66)).toBe(true);
          throw new Error(ROLLBACK);
        },
        { timeout: 60_000, maxWait: 30_000 },
      ),
    ).rejects.toThrow(ROLLBACK);

    // rolled back: the seeded state (69 wilayas, communes in place) is untouched
    expect(await db.commune.count({ where: { wilayaId: { gte: 59 } } })).toBe(108);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).wilayaId).toBe(66);
  });
});
