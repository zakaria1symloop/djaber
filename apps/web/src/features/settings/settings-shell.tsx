'use client';
// SettingsShell (02-next-route-map §2.2): left sub-nav, entries filtered by permission.
import { roleCan } from '@djaber/shared';
import { SubNav, subNavLinkClass } from '@djaber/ui';
import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { visibleSettingsNav } from './nav';

const FULL_PAGES = ['/settings/billing/return'];

export function SettingsShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const { role } = useSession();
  // the sub-nav follows the role (a read-only owner still sees every page; mutations are disabled inside)
  const items = visibleSettingsNav((key) => roleCan(role, key));
  // the checkout return page is a full-width page (Figma "Retour de paiement — page plein écran")
  if (FULL_PAGES.some((p) => pathname === p)) return <div className="w-full">{children}</div>;
  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:gap-8">
      <SubNav title={t('nav.settings')} className="lg:w-52 lg:shrink-0">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <Link key={i.href} href={i.href} className={subNavLinkClass(active)} aria-current={active ? 'page' : undefined}>
              {t(i.key)}
            </Link>
          );
        })}
      </SubNav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
