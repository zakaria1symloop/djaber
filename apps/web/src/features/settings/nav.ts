// SettingsShell sub-nav (02-next-route-map §2.2), entries filtered by permission.
import type { MerchantPermission } from '@djaber/shared';

export type SettingsNavItem = { key: string; href: string; permission?: MerchantPermission };

export const SETTINGS_NAV: SettingsNavItem[] = [
  { key: 'nav.settings.profile', href: '/settings/profile' },
  { key: 'nav.settings.workspace', href: '/settings/workspace', permission: 'workspace.settings' },
  { key: 'nav.settings.members', href: '/settings/members', permission: 'members.read' },
  { key: 'nav.settings.stockMode', href: '/settings/stock-mode', permission: 'workspace.settings' },
  { key: 'nav.settings.quickReplies', href: '/settings/quick-replies', permission: 'workspace.settings' },
  { key: 'nav.settings.systemMessages', href: '/settings/system-messages', permission: 'workspace.settings' },
  // M8: Notifications (/settings/notifications, `notifications.own`)
  { key: 'nav.settings.security', href: '/settings/security' },
  // M11: Intégrations (/settings/integrations, `integrations.manage`)
  // M9: Plan & facturation (/settings/billing, `billing.read`)
  { key: 'nav.settings.credits', href: '/settings/credits', permission: 'billing.read_credits' },
  { key: 'nav.settings.danger', href: '/settings/danger', permission: 'workspace.delete' },
];

/** Entries a member may open. Read-only members keep the pages they can read (controls are disabled there). */
export const visibleSettingsNav = (can: (key: MerchantPermission) => boolean, items: SettingsNavItem[] = SETTINGS_NAV) =>
  items.filter((i) => !i.permission || can(i.permission));
