// 01-nest-module-map §5 "Rate limiting": named limits backed by Redis; 429 RATE_LIMITED { retryAfter } + Retry-After.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app.exception';
import { RATE_LIMIT, type RateLimitOptions } from '../auth/decorators';
import { RedisService } from '../redis/redis.provider';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const o = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT, [ctx.getHandler(), ctx.getClass()]);
    if (!o) return true;
    const req = ctx.switchToHttp().getRequest();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const subject =
      o.by === 'ip'
        ? req.ip
        : o.by === 'ip+email'
          ? `${req.ip}:${email}`
          : o.by === 'email'
            ? email
            : o.by === 'workspace'
              ? (req.headers['x-workspace-id'] ?? req.ip)
              : (req.user?.id ?? req.ip);
    await this.hit(o.name, String(subject), o.max, o.windowSeconds);
    return true;
  }

  /** Increments the counter and throws RATE_LIMITED when above `max`. Usable from services too. */
  async hit(name: string, subject: string, max: number, windowSeconds: number) {
    const key = `rl:${name}:${subject}`;
    const n = await this.redis.client.incr(key);
    if (n === 1) await this.redis.client.expire(key, windowSeconds);
    if (n > max) {
      const ttl = await this.redis.client.ttl(key);
      throw new AppException('RATE_LIMITED', { retryAfter: ttl > 0 ? ttl : windowSeconds });
    }
  }

  /** Throws RATE_LIMITED when the counter already reached `max` (no increment): used with failure-only counters (login). */
  async assertBelow(name: string, subject: string, max: number, windowSeconds: number) {
    const key = `rl:${name}:${subject}`;
    const n = Number((await this.redis.client.get(key)) ?? 0);
    if (n >= max) {
      const ttl = await this.redis.client.ttl(key);
      throw new AppException('RATE_LIMITED', { retryAfter: ttl > 0 ? ttl : windowSeconds });
    }
  }

  /** Seconds until the counter expires (0 when absent): cooldown hints such as `resendAvailableAt`. */
  async ttl(name: string, subject: string) {
    const t = await this.redis.client.ttl(`rl:${name}:${subject}`);
    return t > 0 ? t : 0;
  }

  async reset(name: string, subject: string) {
    await this.redis.client.del(`rl:${name}:${subject}`);
  }
}
