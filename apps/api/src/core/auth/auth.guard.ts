// Pipeline step "AuthGuard (JWT | API key | public)" — 01-nest-module-map §3.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app.exception';
import { ApiKeyAuthService, rawApiKeyOf } from './api-key-auth.service';
import { IS_PUBLIC } from './decorators';
import { SessionDenylistService } from './session-denylist.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly apiKeys: ApiKeyAuthService,
    private readonly denylist: SessionDenylistService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const header: string | undefined = req.headers.authorization;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);

    // API key (06 §5, api-contract §1.2): `X-API-Key: dj_live_…` / `dj_test_…` (or `Authorization: Bearer dj_…`), stored as SHA-256.
    // A public route ignores a key it does not need.
    const rawKey = rawApiKeyOf(req.headers);
    if (rawKey) {
      if (isPublic) return true;
      req.apiKey = await this.apiKeys.authenticate(rawKey, typeof req.ip === 'string' ? req.ip : null, (k, v) => res.setHeader?.(k, v));
      return true;
    }

    if (header?.startsWith('Bearer ')) {
      try {
        const claims = await this.tokens.verifyAccess(header.slice('Bearer '.length).trim());
        // a revoked session (logout, "Déconnecter toutes les sessions", block) stops its access token at once
        if (await this.denylist.isDenied(claims.sid)) throw new Error('session revoked');
        req.user = { id: claims.sub, platformRole: claims.pr ?? 'none', sessionId: claims.sid };
        req.claims = claims;
        return true;
      } catch {
        if (isPublic) return true;
        // D21-bis: an impersonation token past its 30 min window
        if (req.headers['x-impersonation-session']) throw new AppException('ADMIN_IMPERSONATION_EXPIRED');
        throw new AppException('UNAUTHORIZED');
      }
    }
    if (isPublic) return true;
    throw new AppException('UNAUTHORIZED');
  }
}
