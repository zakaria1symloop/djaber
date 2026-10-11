// 09-code-conventions §2.3 — TenantContext lives in @djaber/db (not in apps/api) so the Prisma tenant
// extension can read it without a package → app dependency; apps/api re-exports it from core/tenancy.
import { AsyncLocalStorage } from 'node:async_hooks';

export type MembershipRole = 'owner' | 'admin' | 'operator';

export type TenantLimits = {
  maxPages: number;
  maxAgents: number;
  maxProducts: number;
  maxConversationsPerMonth: number;
  maxMembers: number;
  monthlyCredits: number;
};

export type TenantInfo = {
  workspaceId: string;
  userId?: string;
  apiKeyId?: string;
  role?: MembershipRole;
  readOnly: boolean;
  platformRole?: string;
  locale: 'fr' | 'ar' | 'en';
  stockMode: 'simple' | 'advanced';
  suspended: boolean;
  deletionScheduledAt?: Date | null;
  emailVerified?: boolean;
  limits: TenantLimits;
  impersonation?: { sessionId: string; adminId: string };
  /** When true the tenant extension lets queries through without a workspace filter (platform/system code only). */
  bypass?: boolean;
};

const als = new AsyncLocalStorage<TenantInfo>();

export const NO_LIMITS: TenantLimits = {
  maxPages: 0,
  maxAgents: 0,
  maxProducts: 0,
  maxConversationsPerMonth: 0,
  maxMembers: 0,
  monthlyCredits: 0,
};

export const TenantContext = {
  run: <T>(info: TenantInfo, fn: () => T) => als.run(info, fn),
  get: (): TenantInfo => {
    const t = als.getStore();
    if (!t) throw new Error('TenantContextMissing');
    return t;
  },
  maybe: () => als.getStore(),
  workspaceId: () => TenantContext.get().workspaceId,
  /** System / platform code that must read across workspaces (schedulers, admin lists, auth before a workspace is known). */
  runSystem: <T>(fn: () => T) =>
    als.run(
      { workspaceId: '', readOnly: false, locale: 'fr', stockMode: 'simple', suspended: false, limits: NO_LIMITS, bypass: true },
      fn,
    ),
  /** Runs `fn` scoped to one workspace (worker jobs, admin acting on a target workspace). */
  runAs: <T>(workspaceId: string, fn: () => T, extra: Partial<TenantInfo> = {}) =>
    als.run(
      { workspaceId, readOnly: false, locale: 'fr', stockMode: 'simple', suspended: false, limits: NO_LIMITS, ...extra },
      fn,
    ),
};
