import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

/** Shared ioredis connection (cache, idempotency, locks). BullMQ uses its own connections (see queue module). */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  constructor(config: ConfigService) {
    this.client = new Redis(config.get('REDIS_URL'), { maxRetriesPerRequest: null, lazyConnect: false });
  }
  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }

  /** Runs `fn` while holding a best-effort lock; returns undefined when the lock is already held. */
  async withLock<T>(name: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | undefined> {
    const key = `lock:${name}`;
    const token = `${process.pid}:${Date.now()}:${Math.random()}`;
    const ok = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');
    if (!ok) return undefined;
    try {
      return await fn();
    } finally {
      if ((await this.client.get(key)) === token) await this.client.del(key);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    return v ? (JSON.parse(v) as T) : null;
  }
  async setJson(key: string, value: unknown, ttlSeconds: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}
