// Shared helpers of the M11 integrations module (API keys, webhooks, Google Sheets).
import { prisma, TenantContext } from '@djaber/db';
import type { ActionDescriptor } from '@djaber/shared';
import type { AuditEntry } from '../../core/audit/audit.service';

/**
 * Plan allowance of the current workspace (02 §5: no current subscription ⇒ the free plan). `-1` = unlimited.
 * Read on demand: the tenant context limits (`TenantLimits`) do not carry the integration limits.
 */
export const planAllowance = async (workspaceId: string) =>
  TenantContext.runSystem(async () => {
    const sub = await prisma.subscription.findFirst({ where: { workspaceId, status: { in: ['trial', 'active', 'dunning'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
    const plan = sub?.plan ?? (await prisma.plan.findUnique({ where: { slug: 'free' } }));
    return { features: plan?.features ?? [], maxApiKeys: plan?.maxApiKeys ?? 0, maxWebhooks: plan?.maxWebhooks ?? 0, planSlug: plan?.slug ?? 'free' };
  });

export const withinLimit = (limit: number, used: number) => limit < 0 || used < limit;

export const act = (key: string, enabled: boolean, reasonCode?: string, primary?: boolean): ActionDescriptor => ({
  key,
  enabled,
  ...(enabled || !reasonCode ? {} : { reasonCode }),
  ...(primary ? { primary } : {}),
});

/** Audit entry of the acting user / API key of the request (rule 9: every sensitive action is audited). */
export const auditActor = (): Pick<AuditEntry, 'workspaceId' | 'actorType' | 'actorId' | 'actorRole'> => {
  const t = TenantContext.get();
  return { workspaceId: t.workspaceId, actorType: t.apiKeyId ? 'api_key' : 'user', actorId: t.userId ?? t.apiKeyId ?? null, actorRole: t.role ?? null };
};

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
