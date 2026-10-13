'use client';
// IntegrationsTabs (02-next-route-map §1 `settings/integrations/layout.tsx`): Google Sheets · Clés API · Webhooks, under
// the page header of Figma "SET — Settings — Integrations (Sheets · API keys · webhooks)" ("Intégrations" + the couriers
// pointer) with the link to the generated API documentation (`/api/docs`, API-04). Permission `integrations.manage`.
import { buttonClass, cn } from '@djaber/ui';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { SettingsPage } from '@/features/settings/common';
import { Link, usePathname } from '@/i18n/navigation';
import { API_URL } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { INTEGRATION_TABS } from './tabs';

export function IntegrationsShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const current = INTEGRATION_TABS.find((tab) => pathname === `/settings/integrations/${tab}`) ?? null;
  return (
    <SettingsPage
      title={t('settings.integrations.title')}
      description={t('settings.integrations.description')}
      permission="integrations.manage"
      actions={
        <a href={`${API_URL}/api/docs`} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'secondary' })} data-testid="api-docs-link">
          {t('settings.integrations.apiDocs')}
          <ExternalLink className="size-3.5 rtl:-scale-x-100" aria-hidden />
        </a>
      }
    >
      <p className="ts-label-meta -mt-2 text-text-muted">
        {t('settings.integrations.couriersHint')}{' '}
        <Link href="/delivery/couriers" className="text-text-secondary underline underline-offset-2 hover:text-text-primary">
          {t('settings.integrations.couriersLink')}
        </Link>
      </p>
      <nav aria-label={t('settings.integrations.tabs')} className="flex flex-wrap gap-1.5" data-testid="integrations-tabs">
        {INTEGRATION_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/settings/integrations/${tab}`}
            prefetch
            aria-current={tab === current ? 'page' : undefined}
            data-tab={tab}
            className={cn(
              'flex h-8 items-center rounded-card border px-3 text-[13px] transition-colors',
              tab === current ? 'border-white bg-white font-medium text-black' : 'border-line-edge bg-ink-surface text-text-secondary hover:text-text-primary',
            )}
          >
            {t(`settings.integrations.tab.${tab}`)}
          </Link>
        ))}
      </nav>
      {children}
    </SettingsPage>
  );
}
