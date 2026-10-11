// 09-code-conventions §2.3 / 01-nest-module-map §3.1
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContext, type TenantInfo } from '@djaber/db';
import { AppException } from '../errors/app.exception';
import { IS_AUTHENTICATED_ONLY, IS_PLATFORM, IS_PUBLIC } from '../auth/decorators';
import { TenantResolver } from './tenant.resolver';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: TenantResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    if (isPublic && !req.user && !req.apiKey) return true;

    let info: TenantInfo | null;
    if (
      isPublic ||
      this.reflector.getAllAndOverride<boolean>(IS_PLATFORM, targets) ||
      this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY, targets)
    ) {
      info = await this.resolver.forAccount(req.user);
    } else if (req.apiKey) {
      info = await this.resolver.forApiKey(req.apiKey);
    } else {
      info = await this.resolver.forUser(req.user, req.headers['x-workspace-id']);
    }
    if (!info) throw new AppException('NOT_FOUND');

    if (info.workspaceId) {
      if (info.suspended && !this.resolver.isSuspendedAllowed(req.path)) {
        throw new AppException('WORKSPACE_SUSPENDED');
      }
      if (info.deletionScheduledAt && req.method !== 'GET' && !/\/workspace\/deletion\/cancel$/.test(req.path)) {
        throw new AppException('WORKSPACE_DELETION_SCHEDULED', { at: info.deletionScheduledAt.toISOString() });
      }
    }
    // Fill the store opened by RequestContextMiddleware so the whole request runs with this tenant.
    const store = TenantContext.get();
    for (const k of Object.keys(store)) delete (store as Record<string, unknown>)[k];
    Object.assign(store, info);
    req.tenant = store;
    return true;
  }
}
