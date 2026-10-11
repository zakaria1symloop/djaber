// 04 §15 — after a major legal publication every protected call answers `403 LEGAL_REACCEPT_REQUIRED {document, version}`
// until the user accepted; auth and legal endpoints stay reachable (plus `GET /me`, which carries `pendingLegal`).
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../../core/auth/decorators';
import { AppException } from '../../core/errors/app.exception';
import { LegalService } from './legal.service';

const EXEMPT = [/^\/api\/v1\/auth\//, /^\/api\/v1\/legal\//, /^\/api\/v1\/me$/];

@Injectable()
export class LegalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly legal: LegalService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.id) return true; // public routes and API keys
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    if (EXEMPT.some((re) => re.test(req.path))) return true;
    const pending = await this.legal.firstPending(req.user.id);
    if (pending) throw new AppException('LEGAL_REACCEPT_REQUIRED', { document: pending.key, version: pending.version });
    return true;
  }
}
