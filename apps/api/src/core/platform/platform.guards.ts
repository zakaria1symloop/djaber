// Platform-level request gates (04 §15, PFS-01…03), registered after the legal guard in AppModule:
//   MaintenanceGuard — during the maintenance window every mutation ⇒ 503 MAINTENANCE_MODE { until } (reads allowed);
//   AppVersionGuard  — mobile `X-App-Version` < AppVersion.minVersion ⇒ 426 APP_UPDATE_REQUIRED; < recommended ⇒ header
//                      `X-App-Update: recommended`;
//   FeatureGuard     — `@RequireFeature(key)` routes ⇒ 403 FEATURE_DISABLED { feature } when the flag is off for the workspace.
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma, TenantContext, type AppVersion } from '@djaber/db';
import { AppException } from '../errors/app.exception';
import { FlagsService } from '../flags/flags.service';
import { I18nService } from '../i18n/i18n.service';
import { maintenanceNow } from './maintenance';

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
const VERSION_RE = /^\d+(\.\d+){0,3}$/;
const mobilePlatform = (req: any): 'android' | 'ios' | null => {
  const p = String(req.headers?.['x-app-platform'] ?? '').toLowerCase();
  return p === 'android' || p === 'ios' ? p : null;
};
const stripPrefix = (path: string) => path.replace(/^\/api\/v\d+/, '');

/** Routes that stay writable during maintenance: auth, inbound webhooks (acknowledged and stored), the admin, dev tools, legal acceptance. */
const MAINTENANCE_EXEMPT = [/^\/auth\//, /^\/webhooks(\/|$)/, /^\/admin(\/|$)/, /^\/dev(\/|-)/, /^\/legal\/accept$/];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
    const path = stripPrefix(req.path ?? '');
    if (MAINTENANCE_EXEMPT.some((re) => re.test(path))) return true;
    const m = await maintenanceNow();
    if (!m.active) return true;
    if (m.scope !== 'all') {
      const surface = mobilePlatform(req) ? 'mobile' : 'web';
      if (surface !== m.scope) return true;
    }
    throw new AppException('MAINTENANCE_MODE', { until: m.until ?? '' });
  }
}

const VERSIONS_TTL_MS = 30_000;
let versions: { at: number; rows: AppVersion[] } | null = null;
export const resetAppVersionCache = () => {
  versions = null;
};
const appVersions = async () => {
  if (versions && Date.now() - versions.at < VERSIONS_TTL_MS) return versions.rows;
  const rows = await TenantContext.runSystem(() => prisma.appVersion.findMany());
  versions = { at: Date.now(), rows };
  return rows;
};

@Injectable()
export class AppVersionGuard implements CanActivate {
  constructor(private readonly i18n: I18nService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.id) return true; // authenticated calls only (GET /app/version stays reachable)
    const platform = mobilePlatform(req);
    const version = String(req.headers?.['x-app-version'] ?? '');
    if (!platform || !VERSION_RE.test(version)) return true;
    const row = (await appVersions()).find((r) => r.platform === platform);
    if (!row) return true;
    if (compareVersions(version, row.minVersion) < 0 && (!row.forceUpdateAt || row.forceUpdateAt.getTime() <= Date.now())) {
      throw new AppException('APP_UPDATE_REQUIRED', { minVersion: row.minVersion, storeUrl: row.storeUrl, message: this.i18n.pick(row.updateMessage, req.locale ?? 'fr') });
    }
    if (compareVersions(version, row.recommendedVersion) < 0) ctx.switchToHttp().getResponse().setHeader('X-App-Update', 'recommended');
    return true;
  }
}

export const REQUIRED_FEATURE = 'requiredFeature';
/** 04 §15: the route answers `403 FEATURE_DISABLED { feature }` when the flag is off for the current workspace. */
export const RequireFeature = (key: string) => SetMetadata(REQUIRED_FEATURE, key);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FlagsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const key = this.reflector.getAllAndOverride<string>(REQUIRED_FEATURE, [ctx.getHandler(), ctx.getClass()]);
    if (!key) return true;
    const req = ctx.switchToHttp().getRequest();
    const ws = TenantContext.maybe()?.workspaceId;
    if (!ws) throw new AppException('FEATURE_DISABLED', { feature: key });
    if (!(await this.flags.isEnabled(key, ws, mobilePlatform(req) ? 'mobile' : 'web'))) throw new AppException('FEATURE_DISABLED', { feature: key });
    return true;
  }
}
