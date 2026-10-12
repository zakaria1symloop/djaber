'use client';
// DeliveryTabs (02-next-route-map §1 `delivery/layout.tsx`): Vue d'ensemble · Grille des frais · Transporteurs.
// M5 serves the fee grid only; the overview and the couriers tabs open with courier sending and tracking.
import { cn, Tooltip } from '@djaber/ui';
import type { ReactNode } from 'react';
import { AppPage } from '@/components/app-page';
import { Link, usePathname } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';

type Tab = { key: 'overview' | 'fees' | 'couriers'; href: string; label: string; ready: boolean };

export function DeliveryShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const tabs: Tab[] = [
    // M6: /delivery overview (DLV-08) — shipments, failures, stale parcels
    { key: 'overview', href: '/delivery', label: t('nav.delivery.overview'), ready: false },
    { key: 'fees', href: '/delivery/fees', label: t('nav.delivery.fees'), ready: true },
    // M6: /delivery/couriers (DLV-03) — courier accounts, test, delete
    { key: 'couriers', href: '/delivery/couriers', label: t('nav.delivery.couriers'), ready: false },
  ];
  const current = tabs.find((x) => x.href !== '/delivery' && pathname.startsWith(x.href))?.key ?? 'fees';
  return (
    <AppPage wide eyebrow={t('nav.delivery')} title={t(`delivery.title.${current}`)} description={t(`delivery.description.${current}`)} permission="delivery.send">
      <nav aria-label={t('delivery.tabs')} className="flex flex-wrap gap-1.5">
        {tabs.map((tab) =>
          tab.ready ? (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch
              aria-current={tab.key === current ? 'page' : undefined}
              className={cn(
                'flex h-8 items-center rounded-card border px-3 text-[13px] transition-colors',
                tab.key === current ? 'border-white bg-white font-medium text-black' : 'border-line-edge bg-ink-surface text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </Link>
          ) : (
            <Tooltip key={tab.key} content={t('delivery.tab.soon')}>
              <button type="button" aria-disabled="true" title={t('delivery.tab.soon')} onClick={(e) => e.preventDefault()} className="flex h-8 cursor-not-allowed items-center rounded-card border border-line-edge bg-ink-surface px-3 text-[13px] text-text-muted opacity-60">
                {tab.label}
              </button>
            </Tooltip>
          ),
        )}
      </nav>
      {children}
    </AppPage>
  );
}
