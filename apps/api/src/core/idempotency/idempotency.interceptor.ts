// 09-code-conventions §2.5 / 01-nest-module-map §3.3
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { from, lastValueFrom, Observable } from 'rxjs';
import { prisma, TenantContext } from '@djaber/db';
import { IDEMPOTENT } from '../auth/decorators';
import { AppException } from '../errors/app.exception';
import { RedisService } from '../redis/redis.provider';

const TTL_S = 24 * 3600;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const opt = this.reflector.getAllAndOverride<{ required: boolean }>(IDEMPOTENT, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    if (!opt || req.method !== 'POST') return next.handle();
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key) {
      if (opt.required) throw new AppException('IDEMPOTENCY_KEY_MISSING');
      return next.handle();
    }
    return from(this.run(key, req, res, next));
  }

  private async run(key: string, req: any, res: any, next: CallHandler): Promise<unknown> {
    const t = TenantContext.get();
    const ws = t.workspaceId || 'none';
    const actorKey = t.userId ?? t.apiKeyId ?? 'anonymous';
    const hash = createHash('sha256')
      .update(`${req.method}:${req.path}:${JSON.stringify(req.body ?? {})}`)
      .digest('hex');
    const rkey = `idem:${ws}:${key}`;
    const client = this.redis.client;

    const cached = await client.get(rkey);
    if (cached === 'inflight') throw new AppException('CONFLICT');
    if (cached) {
      const c = JSON.parse(cached) as { hash: string; status: number; body: unknown };
      if (c.hash !== hash) throw new AppException('IDEMPOTENCY_MISMATCH');
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(c.status);
      return c.body;
    }
    const ok = await client.set(rkey, 'inflight', 'EX', 60, 'NX');
    if (!ok) throw new AppException('CONFLICT');
    try {
      const body = await lastValueFrom(next.handle(), { defaultValue: undefined });
      await client.set(rkey, JSON.stringify({ hash, status: res.statusCode, body: body ?? null }), 'EX', TTL_S);
      if (t.workspaceId) {
        await prisma.idempotencyKey
          .create({
            data: {
              workspaceId: t.workspaceId,
              key,
              actorKey,
              requestHash: hash,
              responseCode: res.statusCode,
              responseBody: (body ?? null) as object,
              expiresAt: new Date(Date.now() + TTL_S * 1000),
            },
          })
          .catch(() => undefined); // duplicate row on a race is harmless: Redis is the source for replays
      }
      return body;
    } catch (e) {
      await client.del(rkey);
      throw e;
    }
  }
}
