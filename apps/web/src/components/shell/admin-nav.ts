// AdminShell sidebar (02-next-route-map §2.3): items and order exactly as frame `ADM-01 — Platform admin — overview`
// + "Équipe plateforme" (route map §2.3 / ADM-16). Every item is visible to every platform role (each role holds every
// `admin.<area>.read` key); write controls are hidden per page with the matching `admin.<area>.write` key.
import {
  Activity,
  Store,
  Bot,
  CreditCard,
  FileText,
  Flag,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Building2,
} from 'lucide-react';
import type { PlatformPermission } from '@djaber/shared';
import type { NavGroup, NavItem } from './nav';

export type AdminNavItem = NavItem & { permission: PlatformPermission; icon: LucideIcon };

/** Badge counters fed by the WS admin room (`moderation.queue`, `reports.queue`, `tickets.queue`). */
export type AdminBadge = 'moderation' | 'reports' | 'support';

export const ADMIN_NAV: AdminNavItem[] = [
  { key: 'nav.admin.overview', href: '/admin', icon: LayoutDashboard, permission: 'admin.overview.read' },
  { key: 'nav.admin.workspaces', href: '/admin/workspaces', icon: Building2, permission: 'admin.workspaces.read' },
  { key: 'nav.admin.users', href: '/admin/users', icon: Users, permission: 'admin.users.read' },
  { key: 'nav.admin.moderation', href: '/admin/moderation', icon: ShieldCheck, permission: 'admin.moderation.read', badge: 'moderation' },
  { key: 'nav.admin.reports', href: '/admin/reports', icon: Flag, permission: 'admin.safety.read', badge: 'reports' },
  { key: 'nav.admin.support', href: '/admin/support', icon: LifeBuoy, permission: 'admin.support.read', badge: 'support' },
  { key: 'nav.admin.plans', href: '/admin/plans', icon: Layers, permission: 'admin.billing.read' },
  { key: 'nav.admin.subscriptions', href: '/admin/subscriptions', icon: Receipt, permission: 'admin.billing.read' },
  { key: 'nav.admin.credits', href: '/admin/credits', icon: CreditCard, permission: 'admin.billing.read' },
  { key: 'nav.admin.ai', href: '/admin/ai', icon: Sparkles, permission: 'admin.ai.read' },
  { key: 'nav.admin.presets', href: '/admin/presets', icon: Bot, permission: 'admin.presets.read' },
  { key: 'nav.admin.cms', href: '/admin/cms', icon: FileText, permission: 'admin.cms.read' },
  { key: 'nav.admin.audit', href: '/admin/audit', icon: ScrollText, permission: 'admin.audit.read' },
  { key: 'nav.admin.health', href: '/admin/health', icon: Activity, permission: 'admin.health.read' },
  { key: 'nav.admin.settings', href: '/admin/settings', icon: Settings2, permission: 'admin.settings.read' },
  { key: 'nav.admin.team', href: '/admin/team', icon: UserCog, permission: 'admin.team.read' },
];

export const ADMIN_FOOTER_NAV: NavItem[] = [{ key: 'nav.admin.backToWorkspace', href: '/home', icon: Store }];

export const adminNavGroups = (can: (key: PlatformPermission) => boolean): NavGroup[] => [{ items: ADMIN_NAV.filter((i) => can(i.permission)) }];

