// 04 §15 "Maintenance" / PFS-03 — the `PlatformSetting(key='maintenance')` value, read by the API guard, the worker (inbound
// events delayed, schedulers skipped) and `GET /app/version`. Process-local cache (10 s): no DI so the worker runner and the
// guards share one helper. Stored value: `{ enabled, from, to, scope: all|web|mobile, text }` (`from`/`to` ISO or null).
import { prisma, TenantContext } from '@djaber/db';

export type MaintenanceValue = { enabled?: boolean; from?: string | null; to?: string | null; scope?: 'all' | 'web' | 'mobile'; text?: Record<string, string> | null };
export type MaintenanceNow = { active: boolean; until: string | null; scope: 'all' | 'web' | 'mobile'; value: MaintenanceValue | null };

const TTL_MS = 10_000;
let cache: { at: number; value: MaintenanceValue | null } | null = null;

/** Active when enabled and now ∈ [from, to) (a missing bound is open). A legacy value without `enabled` but with `from` counts as enabled. */
export const isMaintenanceActive = (v: MaintenanceValue | null | undefined, now = Date.now()): boolean => {
  if (!v) return false;
  const enabled = v.enabled ?? !!v.from;
  if (!enabled) return false;
  if (v.from && new Date(v.from).getTime() > now) return false;
  if (v.to && new Date(v.to).getTime() <= now) return false;
  return true;
};

export const readMaintenance = async (fresh = false): Promise<MaintenanceValue | null> => {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await TenantContext.runSystem(() => prisma.platformSetting.findUnique({ where: { key: 'maintenance' } }));
  const value = (row?.value ?? null) as MaintenanceValue | null;
  cache = { at: Date.now(), value };
  return value;
};

export const maintenanceNow = async (fresh = false): Promise<MaintenanceNow> => {
  const value = await readMaintenance(fresh);
  return { active: isMaintenanceActive(value), until: value?.to ?? null, scope: value?.scope ?? 'all', value };
};

/** Drop the process cache (after `PUT /admin/maintenance`, tests). */
export const resetMaintenanceCache = () => {
  cache = null;
};
