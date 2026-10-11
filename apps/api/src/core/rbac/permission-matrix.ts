// 01-nest-module-map §3.2 — the single permission table. Mirrors 02-actors-roles §3, 06 §9, 07 §1.1.
import type { MembershipRole } from '@djaber/db';

const ALL: MembershipRole[] = ['owner', 'admin', 'operator'];
const ADMIN_UP: MembershipRole[] = ['owner', 'admin'];
const OWNER: MembershipRole[] = ['owner'];

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
} as const satisfies Record<string, readonly MembershipRole[]>;

export type MerchantPermission = keyof typeof MERCHANT_PERMISSIONS;

export type PlatformRoleName = 'super_admin' | 'support' | 'moderator' | 'finance' | 'read';
const P_ALL: PlatformRoleName[] = ['super_admin', 'support', 'moderator', 'finance', 'read'];
const SA: PlatformRoleName[] = ['super_admin'];

export const PLATFORM_AREAS = [
  'overview',
  'workspaces',
  'users',
  'billing',
  'ai',
  'presets',
  'cms',
  'audit',
  'health',
  'settings',
  'moderation',
  'safety',
  'support',
  'team',
  'deletion',
] as const;
export type PlatformArea = (typeof PLATFORM_AREAS)[number];

const readKeys = Object.fromEntries(PLATFORM_AREAS.map((a) => [`admin.${a}.read`, P_ALL])) as Record<
  `admin.${PlatformArea}.read`,
  PlatformRoleName[]
>;

export const PLATFORM_PERMISSIONS = {
  ...readKeys,
  'admin.overview.write': SA,
  'admin.workspaces.write': SA,
  'admin.workspaces.credits': ['super_admin', 'support', 'finance'],
  'admin.workspaces.impersonate': ['super_admin', 'support'],
  'admin.workspaces.unmask': SA,
  'admin.users.write': SA,
  'admin.billing.write': ['super_admin', 'finance'],
  'admin.ai.write': SA,
  'admin.presets.write': SA,
  'admin.cms.write': SA,
  'admin.audit.export': ['super_admin', 'finance'],
  'admin.health.write': SA,
  'admin.health.replay': ['super_admin', 'support'],
  'admin.settings.write': SA,
  'admin.moderation.write': ['super_admin', 'moderator'],
  'admin.safety.write': ['super_admin', 'moderator'],
  'admin.support.write': ['super_admin', 'support'],
  'admin.team.write': SA,
  'admin.deletion.write': ['super_admin', 'support'],
} as const satisfies Record<string, readonly PlatformRoleName[]>;

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS;

export const can = (role: MembershipRole | undefined, key: MerchantPermission) =>
  !!role && (MERCHANT_PERMISSIONS[key] as readonly MembershipRole[]).includes(role);
export const canPlatform = (role: string | undefined, key: PlatformPermission) =>
  !!role && (PLATFORM_PERMISSIONS[key] as readonly string[]).includes(role);
