// Pipeline step "AuthGuard (JWT | API key | public)" — 01-nest-module-map §3.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { prisma, TenantContext } from '@djaber/db';
import { AppException } from '../errors/app.exception';
import { IS_PUBLIC } from './decorators';
import { TokenService } from './token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);

    if (header?.startsWith('Bearer dj_')) {
      // API key (06 §5): `dj_live_…` / `dj_test_…`, stored as SHA-256
      const raw = header.slice('Bearer '.length).trim();
      const keyHash = createHash('sha256').update(raw).digest('hex');
      const key = await TenantContext.runSystem(() => prisma.apiKey.findUnique({ where: { keyHash } }));
      if (!key) throw new AppException('UNAUTHORIZED');
      if (key.revokedAt) throw new AppException('API_KEY_REVOKED');
      req.apiKey = key;
      return true;
    }

    if (header?.startsWith('Bearer ')) {
      try {
        const claims = await this.tokens.verifyAccess(header.slice('Bearer '.length).trim());
        req.user = { id: claims.sub, platformRole: claims.pr ?? 'none', sessionId: claims.sid };
        req.claims = claims;
        return true;
      } catch {
        if (isPublic) return true;
        throw new AppException('UNAUTHORIZED');
      }
    }
    if (isPublic) return true;
    throw new AppException('UNAUTHORIZED');
  }
}
