// 14-mobile-app §6 / api-contract §3.14 — GET /app/version?platform&version (public)
import { Controller, Get, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { prisma, TenantContext } from '@djaber/db';
import { Public } from '../../core/auth/decorators';
import { notFound } from '../../core/errors/app.exception';
import { I18nService } from '../../core/i18n/i18n.service';

const Query_ = z.object({
  platform: z.enum(['android', 'ios']),
  version: z.string().regex(/^\d+(\.\d+){0,3}$/).optional(),
});
class AppVersionQueryDto extends createZodDto(Query_) {}

/** Compares dotted versions: negative when a < b. */
export const compareVersions = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

@Controller('app')
export class AppVersionController {
  constructor(private readonly i18n: I18nService) {}

  @Public()
  @Get('version')
  async check(@Query() q: AppVersionQueryDto, @Req() req: any) {
    const { row, maintenance } = await TenantContext.runSystem(async () => ({
      row: await prisma.appVersion.findUnique({ where: { platform: q.platform } }),
      maintenance: await prisma.platformSetting.findUnique({ where: { key: 'maintenance' } }),
    }));
    if (!row) throw notFound();
    const forced = !!q.version && compareVersions(q.version, row.minVersion) < 0;
    const forceUpdate = forced && (!row.forceUpdateAt || row.forceUpdateAt <= new Date());
    const m = maintenance?.value as { from?: string; to?: string; text?: Record<string, string> } | null | undefined;
    const now = Date.now();
    const inMaintenance = !!m?.from && new Date(m.from).getTime() <= now && (!m.to || now < new Date(m.to).getTime());
    return {
      minVersion: row.minVersion,
      recommendedVersion: row.recommendedVersion,
      latestVersion: row.latestVersion,
      forceUpdate,
      recommendUpdate: !!q.version && !forceUpdate && compareVersions(q.version, row.recommendedVersion) < 0,
      message: this.i18n.pick(row.updateMessage, req.locale),
      storeUrl: row.storeUrl,
      maintenance: inMaintenance ? { until: m?.to ?? null, text: this.i18n.pick(m?.text ?? {}, req.locale) } : null,
    };
  }
}
