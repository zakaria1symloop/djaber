// Feature flags (ADM-13, 04 §15 "Feature flags"): evaluated per workspace and per surface — `workspaceId ∈ targeting.workspaceIds`
// or (`plan ∈ targeting.planSlugs` when set ∧ `hash(flag, workspaceId) % 100 < pct`); a per-workspace override wins.
// Flags cached 30 s, workspace plan cached 60 s.
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { prisma, TenantContext } from '@djaber/db';
import { RedisService } from '../redis/redis.provider';

type FlagRow = {
  key: string;
  webPct: number;
  mobilePct: number;
  isActive: boolean;
  overrides: Record<string, boolean>;
  targeting?: { planSlugs?: string[]; workspaceIds?: string[]; abTest?: boolean };
};
export type FlagEvaluation = { enabled: boolean; reason: 'inactive' | 'override' | 'workspace_list' | 'plan_mismatch' | 'bucket' | 'unknown_flag'; bucket: number; pct: number };

@Injectable()
export class FlagsService {
  constructor(private readonly redis: RedisService) {}

  private async load(): Promise<Record<string, FlagRow>> {
    const cached = await this.redis.getJson<Record<string, FlagRow>>('flags:all');
    if (cached) return cached;
    const rows = await TenantContext.runSystem(() => prisma.featureFlag.findMany({ include: { overrides: true } }));
    const out: Record<string, FlagRow> = {};
    for (const r of rows) {
      out[r.key] = {
        key: r.key,
        webPct: r.webPct,
        mobilePct: r.mobilePct,
        isActive: r.isActive,
        overrides: Object.fromEntries(r.overrides.map((o) => [o.workspaceId, o.enabled])),
        targeting: (r.targeting ?? {}) as FlagRow['targeting'],
      };
    }
    await this.redis.setJson('flags:all', out, 30);
    return out;
  }

  async invalidate() {
    await this.redis.client.del('flags:all');
  }

  /** Stable bucket 0–99 per (flag, workspace) so a workspace does not flip between requests. */
  static bucket(key: string, workspaceId: string) {
    return createHash('sha256').update(`${key}:${workspaceId}`).digest().readUInt16BE(0) % 100;
  }

  /** Current plan slug of a workspace (cached 60 s); `free` when none. */
  private async planOf(workspaceId: string): Promise<string> {
    const k = `flags:plan:${workspaceId}`;
    const cached = await this.redis.client.get(k);
    if (cached) return cached;
    const sub = await TenantContext.runSystem(() =>
      prisma.subscription.findFirst({ where: { workspaceId, status: { in: ['trial', 'active', 'dunning'] } }, include: { plan: { select: { slug: true } } }, orderBy: { createdAt: 'desc' } }),
    );
    const slug = sub?.plan.slug ?? 'free';
    await this.redis.client.set(k, slug, 'EX', 60);
    return slug;
  }

  /** Full evaluation with its reason (`GET /admin/feature-flags/:key/evaluate`). */
  async evaluate(key: string, workspaceId: string, surface: 'web' | 'mobile' = 'web'): Promise<FlagEvaluation> {
    const f = (await this.load())[key];
    const bucket = FlagsService.bucket(key, workspaceId);
    if (!f) return { enabled: false, reason: 'unknown_flag', bucket, pct: 0 };
    const pct = surface === 'web' ? f.webPct : f.mobilePct;
    if (!f.isActive) return { enabled: false, reason: 'inactive', bucket, pct };
    const o = f.overrides[workspaceId];
    if (o !== undefined) return { enabled: o, reason: 'override', bucket, pct };
    if (f.targeting?.workspaceIds?.includes(workspaceId)) return { enabled: true, reason: 'workspace_list', bucket, pct };
    if (f.targeting?.planSlugs?.length && !f.targeting.planSlugs.includes(await this.planOf(workspaceId))) return { enabled: false, reason: 'plan_mismatch', bucket, pct };
    return { enabled: bucket < pct, reason: 'bucket', bucket, pct };
  }

  async isEnabled(key: string, workspaceId: string, surface: 'web' | 'mobile' = 'web'): Promise<boolean> {
    return (await this.evaluate(key, workspaceId, surface)).enabled;
  }

  /** Like `isEnabled`, but a flag that does not exist (not created on ADM-13 yet) answers `fallback`. */
  async isEnabledOr(key: string, workspaceId: string, fallback: boolean, surface: 'web' | 'mobile' = 'web'): Promise<boolean> {
    const f = (await this.load())[key];
    return f ? this.isEnabled(key, workspaceId, surface) : fallback;
  }

  async allFor(workspaceId: string, surface: 'web' | 'mobile' = 'web'): Promise<Record<string, boolean>> {
    const flags = await this.load();
    const out: Record<string, boolean> = {};
    for (const key of Object.keys(flags)) out[key] = await this.isEnabled(key, workspaceId, surface);
    return out;
  }
}
