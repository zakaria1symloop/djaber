// Feature flags (ADM settings): percentage rollout per surface + per-workspace override. Cached 30 s.
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { prisma, TenantContext } from '@djaber/db';
import { RedisService } from '../redis/redis.provider';

type FlagRow = { key: string; webPct: number; mobilePct: number; isActive: boolean; overrides: Record<string, boolean> };

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

  async isEnabled(key: string, workspaceId: string, surface: 'web' | 'mobile' = 'web'): Promise<boolean> {
    const f = (await this.load())[key];
    if (!f || !f.isActive) return false;
    const o = f.overrides[workspaceId];
    if (o !== undefined) return o;
    return FlagsService.bucket(key, workspaceId) < (surface === 'web' ? f.webPct : f.mobilePct);
  }

  async allFor(workspaceId: string, surface: 'web' | 'mobile' = 'web'): Promise<Record<string, boolean>> {
    const flags = await this.load();
    const out: Record<string, boolean> = {};
    for (const key of Object.keys(flags)) out[key] = await this.isEnabled(key, workspaceId, surface);
    return out;
  }
}
