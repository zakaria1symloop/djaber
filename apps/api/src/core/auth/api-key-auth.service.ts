// API-01 / api-contract §1.2 + §1.9 — API key authentication: `X-API-Key: dj_live_…` (or `Authorization: Bearer dj_…`),
// stored as SHA-256, bound to one workspace, 600 requests / min / key with `X-RateLimit-*` headers, `lastUsedAt/Ip` kept
// (written at most once a minute per key so a busy integration does not write on every call).
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { API_KEY_RATE_LIMIT_PER_MIN } from '@djaber/shared';
import { prisma, TenantContext, type ApiKey } from '@djaber/db';
import { AppException } from '../errors/app.exception';
import { RedisService } from '../redis/redis.provider';

export const API_KEY_RE = /^dj_(live|test)_[A-Za-z0-9_-]{20,}$/;
export const hashApiKey = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** The raw key of a request: `X-API-Key` first, then `Authorization: Bearer dj_…`; null when the request carries none. */
export const rawApiKeyOf = (headers: Record<string, unknown>): string | null => {
  const x = headers['x-api-key'];
  if (typeof x === 'string' && x.trim()) return x.trim();
  const auth = headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer dj_')) return auth.slice('Bearer '.length).trim();
  return null;
};

@Injectable()
export class ApiKeyAuthService {
  constructor(private readonly redis: RedisService) {}

  /** Resolves and meters a key. 401 `UNAUTHORIZED` (unknown), 401 `API_KEY_REVOKED`, 429 `RATE_LIMITED`. */
  async authenticate(raw: string, ip: string | null, setHeader: (k: string, v: string) => void): Promise<ApiKey> {
    if (!API_KEY_RE.test(raw)) throw new AppException('UNAUTHORIZED');
    const key = await TenantContext.runSystem(() => prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } }));
    if (!key) throw new AppException('UNAUTHORIZED');
    if (key.revokedAt) throw new AppException('API_KEY_REVOKED');

    const windowStart = Math.floor(Date.now() / 60_000) * 60;
    const rlKey = `rl:api-key:${key.id}:${windowStart}`;
    const n = await this.redis.client.incr(rlKey);
    if (n === 1) await this.redis.client.expire(rlKey, 61);
    const reset = windowStart + 60;
    setHeader('X-RateLimit-Limit', String(API_KEY_RATE_LIMIT_PER_MIN));
    setHeader('X-RateLimit-Remaining', String(Math.max(0, API_KEY_RATE_LIMIT_PER_MIN - n)));
    setHeader('X-RateLimit-Reset', String(reset));
    if (n > API_KEY_RATE_LIMIT_PER_MIN) {
      const retryAfter = Math.max(1, reset - Math.floor(Date.now() / 1000));
      throw new AppException('RATE_LIMITED', { retryAfter });
    }

    const touched = await this.redis.client.set(`api-key:touch:${key.id}`, '1', 'EX', 60, 'NX');
    if (touched) {
      await TenantContext.runSystem(() => prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date(), lastUsedIp: ip?.slice(0, 64) ?? null } })).catch(() => undefined);
    }
    return key;
  }
}
