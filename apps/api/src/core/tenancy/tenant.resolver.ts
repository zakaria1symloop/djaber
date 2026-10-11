// 01-nest-module-map §3.1 — resolves the TenantInfo of a request / job.
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext, NO_LIMITS, type TenantInfo, type TenantLimits, type MembershipRole } from '@djaber/db';
import { AppException } from '../errors/app.exception';
import { RedisService } from '../redis/redis.provider';
import type { AuthUser } from '../auth/decorators';

type WorkspaceCtx = {
  workspaceId: string;
  status: 'active' | 'suspended' | 'deletion_scheduled';
  deletionScheduledAt: string | null;
  locale: 'fr' | 'ar' | 'en';
  stockMode: 'simple' | 'advanced';
  limits: TenantLimits;
  planSlug: string;
  subscriptionStatus: string;
};

const CURRENT = ['trial', 'active', 'dunning'] as const;
const SUSPENDED_ALLOWED = [/^\/api\/v1\/workspace$/, /^\/api\/v1\/billing\//, /^\/api\/v1\/credits$/, /^\/api\/v1\/me(\/|$)/, /^\/api\/v1\/help\//, /^\/api\/v1\/support\//];

@Injectable()
export class TenantResolver {
  constructor(private readonly redis: RedisService) {}

  static ctxKey = (workspaceId: string) => `ws:${workspaceId}:ctx`;

  /** Call after any membership / subscription / workspace status / plan change. */
  async invalidate(workspaceId: string) {
    await this.redis.client.del(TenantResolver.ctxKey(workspaceId));
  }

  /** Workspace-level context (status, plan limits). Cached 30 s. */
  async workspaceCtx(workspaceId: string): Promise<WorkspaceCtx | null> {
    const cached = await this.redis.getJson<WorkspaceCtx>(TenantResolver.ctxKey(workspaceId));
    if (cached) return cached;
    const ctx = await TenantContext.runSystem(async () => {
      const ws = await prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null } });
      if (!ws) return null;
      const sub = await prisma.subscription.findFirst({
        where: { workspaceId, status: { in: [...CURRENT] } },
        include: { plan: true },
      });
      // Expired / no subscription ⇒ free-plan limits (02 §5): nothing is deleted, extras are paused by plan.
      const plan = sub?.plan ?? (await prisma.plan.findUnique({ where: { slug: 'free' } }));
      const limits: TenantLimits = plan
        ? {
            maxPages: plan.maxPages,
            maxAgents: plan.maxAgents,
            maxProducts: plan.maxProducts,
            maxConversationsPerMonth: plan.maxConversationsPerMonth,
            maxMembers: plan.maxMembers,
            monthlyCredits: plan.monthlyCredits,
          }
        : NO_LIMITS;
      const out: WorkspaceCtx = {
        workspaceId: ws.id,
        status: ws.status,
        deletionScheduledAt: ws.deletionScheduledAt ? ws.deletionScheduledAt.toISOString() : null,
        locale: ws.locale,
        stockMode: ws.stockMode,
        limits,
        planSlug: plan?.slug ?? 'free',
        subscriptionStatus: sub?.status ?? 'expired',
      };
      return out;
    });
    if (ctx) await this.redis.setJson(TenantResolver.ctxKey(workspaceId), ctx, 30);
    return ctx;
  }

  private toInfo(ctx: WorkspaceCtx, extra: Partial<TenantInfo>): TenantInfo {
    return {
      workspaceId: ctx.workspaceId,
      readOnly: false,
      locale: ctx.locale,
      stockMode: ctx.stockMode,
      suspended: ctx.status === 'suspended',
      deletionScheduledAt: ctx.deletionScheduledAt ? new Date(ctx.deletionScheduledAt) : null,
      limits: ctx.limits,
      ...extra,
    };
  }

  /**
   * Merchant request: `X-Workspace-Id` header, else the owned workspace, else `User.lastWorkspaceId`,
   * else `400 WORKSPACE_REQUIRED`. Header without membership ⇒ null (caller answers 404).
   */
  async forUser(user: AuthUser, headerWorkspaceId: unknown): Promise<TenantInfo | null> {
    return TenantContext.runSystem(async () => {
      const u = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null } });
      if (!u || u.status !== 'active') throw new AppException('UNAUTHORIZED');
      let workspaceId = typeof headerWorkspaceId === 'string' && headerWorkspaceId ? headerWorkspaceId : undefined;
      if (workspaceId && !/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;
      workspaceId ??= u.ownedWorkspaceId ?? u.lastWorkspaceId ?? undefined;
      if (!workspaceId) throw new AppException('WORKSPACE_REQUIRED');
      const membership = await prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: u.id } },
      });
      if (!membership) return null;
      const ctx = await this.workspaceCtx(workspaceId);
      if (!ctx) return null;
      return this.toInfo(ctx, {
        userId: u.id,
        role: membership.role as MembershipRole,
        readOnly: membership.readOnly,
        platformRole: u.platformRole === 'none' ? undefined : u.platformRole,
        emailVerified: !!u.emailVerifiedAt,
      });
    });
  }

  /** `@Authenticated()` and `@Platform()` routes: no workspace, tenant models need an explicit `TenantContext.runAs`. */
  async forAccount(user: AuthUser): Promise<TenantInfo> {
    return TenantContext.runSystem(async () => {
      const u = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null } });
      if (!u || u.status === 'blocked') throw new AppException('UNAUTHORIZED');
      return {
        workspaceId: '',
        userId: u.id,
        readOnly: false,
        platformRole: u.platformRole === 'none' ? undefined : u.platformRole,
        locale: u.locale,
        stockMode: 'simple' as const,
        suspended: false,
        limits: NO_LIMITS,
        emailVerified: !!u.emailVerifiedAt,
        bypass: true,
      };
    });
  }

  async forApiKey(apiKey: { id: string; workspaceId: string }): Promise<TenantInfo | null> {
    const ctx = await this.workspaceCtx(apiKey.workspaceId);
    return ctx ? this.toInfo(ctx, { apiKeyId: apiKey.id }) : null;
  }

  /** Worker jobs: `TenantContext.run(await tenants.forWorker(workspaceId), …)`. */
  async forWorker(workspaceId: string): Promise<TenantInfo> {
    const ctx = await this.workspaceCtx(workspaceId);
    if (!ctx) throw new Error(`Workspace ${workspaceId} not found`);
    return this.toInfo(ctx, {});
  }

  isSuspendedAllowed(path: string) {
    return SUSPENDED_ALLOWED.some((re) => re.test(path));
  }
}
