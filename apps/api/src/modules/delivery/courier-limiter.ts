// Per courier account rate limiter (DLV-04 "per-account rate limiter", 03-events §3 `courier` queue: create 5 / s,
// tracking 2 / s per account). Fixed one-second windows in Redis, shared by every worker process: `take` waits for a
// free slot instead of failing, so a 10 k-shipment batch is spread over the budget instead of hammering the courier.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service';
import { RedisService } from '../../core/redis/redis.provider';

export type LimitKind = 'send' | 'track' | 'other';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class CourierLimiter {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  rps(kind: LimitKind): number {
    return kind === 'send' ? this.config.get('COURIER_SEND_RPS') : kind === 'track' ? this.config.get('COURIER_TRACK_RPS') : this.config.get('COURIER_SEND_RPS');
  }

  /** Waits until the account has a free slot in the current second (at most `maxWaitMs`, then proceeds). */
  async take(accountKey: string, kind: LimitKind, maxWaitMs = 120_000) {
    const limit = this.rps(kind);
    const started = Date.now();
    for (;;) {
      const sec = Math.floor(Date.now() / 1000);
      const key = `cl:${kind}:${accountKey}:${sec}`;
      const n = await this.redis.client.incr(key);
      if (n === 1) await this.redis.client.expire(key, 3);
      if (n <= limit || Date.now() - started > maxWaitMs) return;
      await sleep(1000 - (Date.now() % 1000) + 5);
    }
  }
}
