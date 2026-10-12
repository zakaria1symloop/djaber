// 04 §10 / 01-nest-module-map §4.4 — per-workspace row-locked counters: orders `CMD-1001…`, sales `VNT-…`, purchases
// `ACH-…`. Never reused. The first call of a workspace starts after the highest number already present (legacy rows
// migrated from V1 keep their `ORD-…` numbers, which cannot collide with `CMD-`).
import { Injectable } from '@nestjs/common';
import { TenantContext, type Tx } from '@djaber/db';

export type CounterKey = 'order' | 'sale' | 'purchase';
const PREFIX: Record<CounterKey, string> = { order: 'CMD', sale: 'VNT', purchase: 'ACH' };
/** First number handed out = START + 1 (`CMD-1001`). */
const START = 1000;

@Injectable()
export class CounterService {
  /** Next number inside the caller's transaction (the counter row stays locked until it commits). */
  async next(tx: Tx, key: CounterKey): Promise<string> {
    const ws = TenantContext.workspaceId();
    const prefix = PREFIX[key];
    const table = key === 'order' ? 'Order' : key === 'sale' ? 'Sale' : 'Purchase';
    const pattern = `^${prefix}-[0-9]+$`;
    const [row] = await tx.$queryRawUnsafe<{ value: number }[]>(
      `INSERT INTO "Counter" ("id","workspaceId","key","value")
       VALUES (uuid_generate_v7(), $1::uuid, $2,
         GREATEST(${START}, COALESCE((SELECT max(substring("number" from ${prefix.length + 2})::int) FROM "${table}" WHERE "workspaceId" = $1::uuid AND "number" ~ $3), 0)) + 1)
       ON CONFLICT ("workspaceId","key") DO UPDATE SET "value" = "Counter"."value" + 1
       RETURNING "value"`,
      ws,
      key,
      pattern,
    );
    return `${prefix}-${row!.value}`;
  }
}
