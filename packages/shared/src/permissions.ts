// 01-nest-module-map §3.2 — merchant permission table mirrored for the web / mobile clients
// (source of truth enforced by the API: apps/api/src/core/rbac/permission-matrix.ts — keep both in sync).
import type { MemberRole } from './enums';

const ALL: readonly MemberRole[] = ['owner', 'admin', 'operator'];
const ADMIN_UP: readonly MemberRole[] = ['owner', 'admin'];
const OWNER: readonly MemberRole[] = ['owner'];

export const MERCHANT_PERMISSIONS = {
  'inbox.read': ALL,
  'inbox.delete': ADMIN_UP,
  'channels.read': ALL,
  'channels.manage': ADMIN_UP,
  'agents.read': ALL,
  'agents.manage': ADMIN_UP,
  'agents.test': ALL,
  'insights.manage': ALL,
  'catalog.read': ALL,
  'catalog.write': ADMIN_UP,
  'stock.read': ALL,
  'stock.adjust': ADMIN_UP,
  'stock.count': ALL,
  'clients.read': ALL,
  'clients.write': ALL,
  'clients.delete': ADMIN_UP,
  'orders.read': ALL,
  'orders.write': ALL,
  'orders.money': ADMIN_UP,
  'orders.import': ADMIN_UP,
  'delivery.send': ALL,
  'delivery.manage': ADMIN_UP,
  'gds.read': ADMIN_UP,
  'gds.write': ADMIN_UP,
  'reports.read': ADMIN_UP,
  'reports.schedule': ADMIN_UP,
  'analytics.read': ALL,
  'notifications.own': ALL,
  'views.share': ADMIN_UP,
  'members.read': ALL,
  'members.write': OWNER,
  'workspace.read': ALL,
  'workspace.settings': ADMIN_UP,
  'workspace.transfer': OWNER,
  'workspace.delete': OWNER,
  'integrations.manage': ADMIN_UP,
  'billing.read': ADMIN_UP,
  'billing.read_credits': ALL,
  'billing.write': ADMIN_UP,
  'billing.plan': OWNER,
  'safety.block': ALL,
  'safety.manage': ADMIN_UP,
  'support.write': ALL,
  'support.read_all': ADMIN_UP,
} as const satisfies Record<string, readonly MemberRole[]>;

export type MerchantPermission = keyof typeof MERCHANT_PERMISSIONS;

export const isMerchantPermission = (key: string): key is MerchantPermission => key in MERCHANT_PERMISSIONS;

/** Role check only. */
export const roleCan = (role: MemberRole | null | undefined, key: MerchantPermission): boolean =>
  !!role && (MERCHANT_PERMISSIONS[key] as readonly MemberRole[]).includes(role);

/** Read keys stay usable by read-only members (plan limit); every other key guards a mutation. */
export const isReadPermission = (key: MerchantPermission): boolean => /\.(read|read_credits|read_all|own)$/.test(key);

/**
 * UI helper mirroring the API: the role must hold the key, and a `readOnly` member (plan `maxMembers`,
 * `READ_ONLY_MEMBER`) keeps only the read keys.
 */
export const memberCan = (m: { role: MemberRole | null | undefined; readOnly?: boolean }, key: MerchantPermission): boolean =>
  roleCan(m.role, key) && (!m.readOnly || isReadPermission(key));
