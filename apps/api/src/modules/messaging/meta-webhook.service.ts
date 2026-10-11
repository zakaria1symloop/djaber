// MSG-01 / 05-integrations §1.2 — the receiving side of the Meta webhook. The handler does exactly one thing before the
// ack: one SQL statement that stores the raw events (`InboundEvent`, dedup on `externalId`) and, atomically, the outbox
// rows that make the relay add `meta-inbound / process-event` jobs (job id `inbound:<externalId>`). No read, no Meta call.
// This code only RECEIVES: it never registers, verifies or changes a webhook subscription at Meta.
import { Injectable } from '@nestjs/common';
import { Prisma, rawPrisma } from '@djaber/db';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { verifyWebhookSignature } from '../meta/meta-signature';
import { inboundExternalId, type MetaObject, type StoredInbound } from './inbound-parser';

const JOB_OPTS = JSON.stringify({ attempts: 5, backoff: { type: 'exponential', delay: 2000 } });
/** A single POST from Meta batches at most a few dozen events; anything bigger is cut (Meta redelivers what was not acked). */
const MAX_EVENTS = 500;

@Injectable()
export class MetaWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {}

  /** `hub.verify_token` check of the subscription handshake Meta performs (we only answer it). */
  verifyToken(token: unknown): boolean {
    const expected = this.config.get('META_VERIFY_TOKEN');
    return !!expected && typeof token === 'string' && this.crypto.safeEqual(token, expected);
  }

  /** `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256(app secret, raw body), compared in constant time. */
  verifySignature(rawBody: Buffer | undefined, header: unknown): boolean {
    return verifyWebhookSignature(this.config.get('META_APP_SECRET'), rawBody, header);
  }

  /** Events of a webhook body, with their dedup ids. `entry[].changes[]` (feed, mentions…) is not used. */
  static events(body: unknown): { externalId: string; payload: StoredInbound }[] {
    const b = body as { object?: string; entry?: unknown } | null;
    if (!b || (b.object !== 'page' && b.object !== 'instagram') || !Array.isArray(b.entry)) return [];
    const out: { externalId: string; payload: StoredInbound }[] = [];
    const seen = new Set<string>();
    for (const entry of b.entry as Record<string, any>[]) {
      const entryId = String(entry?.id ?? '');
      for (const item of Array.isArray(entry?.messaging) ? entry.messaging : []) {
        if (!item || typeof item !== 'object') continue;
        const externalId = inboundExternalId(entryId, item);
        if (seen.has(externalId)) continue;
        seen.add(externalId);
        out.push({ externalId, payload: { object: b.object as MetaObject, entryId, time: typeof entry.time === 'number' ? entry.time : null, item } });
        if (out.length >= MAX_EVENTS) return out;
      }
    }
    return out;
  }

  /** Stores the events and schedules their processing; returns how many were new (redeliveries count 0). */
  async ingest(body: unknown): Promise<number> {
    const events = MetaWebhookService.events(body);
    if (!events.length) return 0;
    const values = Prisma.join(events.map((e) => Prisma.sql`(uuid_generate_v7(), 'meta'::"InboundProvider", ${e.externalId}, ${JSON.stringify(e.payload)}::jsonb, now())`));
    return rawPrisma.$executeRaw`
      WITH ev AS (
        INSERT INTO "InboundEvent" ("id","provider","externalId","payload","receivedAt")
        VALUES ${values}
        ON CONFLICT ("externalId") DO NOTHING
        RETURNING "id","externalId"
      )
      INSERT INTO "Outbox" ("id","workspaceId","topic","key","payload","attempts","createdAt")
      SELECT uuid_generate_v7(), NULL, 'job', 'inbound:' || ev."externalId",
             jsonb_build_object('queue', 'meta-inbound', 'name', 'process-event', 'data', jsonb_build_object('inboundEventId', ev."id"), 'opts', ${JOB_OPTS}::jsonb),
             0, now()
      FROM ev
      ON CONFLICT ("topic","key") DO NOTHING`;
  }
}
