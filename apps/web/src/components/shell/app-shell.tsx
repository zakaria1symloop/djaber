'use client';
// Generic shell frame (sidebar + top bar + banner stack + content) used by MerchantShell and AdminShell.
import { IconButton } from '@djaber/ui';
import { Menu as MenuIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAutoTitles } from '@/lib/auto-title';
import { useT } from '@/lib/i18n';
import { BannerStack, type ShellBanner } from './banner-stack';
import type { NavGroup, NavItem } from './nav';
import { Sidebar } from './sidebar';

export function AppShell({
  groups,
  footer,
  counters,
  sidebarHeader,
  topBar,
  banners,
  fixedBar,
  homeHref,
  children,
}: {
  groups: NavGroup[];
  footer: NavItem[];
  counters?: Partial<Record<string, number>>;
  sidebarHeader?: ReactNode;
  topBar?: ReactNode;
  banners?: ShellBanner[];
  /** fixed bar above everything (impersonation) */
  fixedBar?: ReactNode;
  homeHref?: string;
  children: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // truncated names / previews show their full text in a tooltip
  useAutoTitles();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K focuses the search of the current list (GLOBAL shortcuts)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const el = document.querySelector<HTMLInputElement>('[data-list-search]');
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      {fixedBar}
      <div className="flex min-h-0 flex-1">
        <Sidebar groups={groups} footer={footer} counters={counters} header={sidebarHeader} open={open} onClose={() => setOpen(false)} homeHref={homeHref} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-hairline px-4 md:px-8">
            <IconButton label={t('nav.menu')} variant="ghost" className="lg:hidden" onClick={() => setOpen(true)}>
              <MenuIcon className="size-5" />
            </IconButton>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">{topBar}</div>
          </header>
          <BannerStack banners={banners ?? []} dismissLabel={t('action.close')} />
          <main id="main" className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
