// Helpers shared by the ops & safety admin modules (ADM-10…14): actor of a platform request, reason rule, masking, refs.
import { prisma, TenantContext, type Prisma, type Tx } from '@djaber/db';
import type { InboxUserRef } from '@djaber/shared';
import { AuditService } from '../../core/audit/audit.service';
import { AppException } from '../../core/errors/app.exception';

/** Platform actor captured from the request scope (admin services then read across workspaces with `runSystem`). */
export type PlatformActor = { userId: string; platformRole: string; ip: string | null; userAgent: string | null };

export const actorOf = (req: { ip?: string; headers?: Record<string, unknown> }): PlatformActor => {
  const t = TenantContext.get();
  return {
    userId: t.userId!,
    platformRole: t.platformRole ?? 'none',
    ip: req.ip ?? null,
    userAgent: typeof req.headers?.['user-agent'] === 'string' ? (req.headers['user-agent'] as string) : null,
  };
};

/** 06 §9: every admin write touching a merchant takes `reason ≥ 10 chars` (422 ADMIN_REASON_REQUIRED). */
export const requireReason = (reason: string | null | undefined): string => {
  const r = (reason ?? '').trim();
  if (r.length < 10) throw new AppException('ADMIN_REASON_REQUIRED', {}, { reason: 'validation.length' });
  return r;
};

/** Cross-workspace read/write of platform code. */
export const sys = <T>(fn: () => Promise<T>) => TenantContext.runSystem(fn);
export const sysTx = <T>(fn: (tx: Tx) => Promise<T>) => TenantContext.runSystem(() => prisma.$transaction((db) => fn(db as Tx), { timeout: 30_000 }));

export const userRefSelect = { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } as const;
export const toUserRef = (u: { id: string; firstName: string | null; lastName: string | null; avatarUrl: string | null } | null | undefined): InboxUserRef | null =>
  u ? { id: u.id, firstName: u.firstName ?? '', lastName: u.lastName ?? '', avatarUrl: u.avatarUrl ?? null } : null;

/** 04 §13 "Evidence": customer phone masked `05•• •• •• 56`. */
export const maskPhone = (p: string | null | undefined) => (p && p.length >= 6 ? `${p.slice(0, 2)}•• •• •• ${p.slice(-2)}` : p ? '••' : null);
export const maskEmail = (e: string | null | undefined) => (e ? e.replace(/^(.).*(@.*)$/, '$1•••$2') : null);

/** Audit row of an admin action (`actorType=admin`, reason kept). */
export const auditAdmin = (audit: AuditService, a: PlatformActor, e: { action: string; entity: string; entityId?: string | null; workspaceId?: string | null; before?: unknown; after?: unknown; reason?: string | null }) =>
  audit.write({ ...e, actorType: 'admin', actorId: a.userId, actorRole: a.platformRole, ip: a.ip, userAgent: a.userAgent });

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
export const pick = (text: unknown, locale: string): string => {
  if (!text || typeof text !== 'object') return typeof text === 'string' ? text : '';
  const t = text as Record<string, string | undefined>;
  return t[locale] || t.fr || t.en || t.ar || '';
};
export type JsonInput = Prisma.InputJsonValue;
