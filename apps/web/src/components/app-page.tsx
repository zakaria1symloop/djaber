'use client';
// Frame of a merchant page: optional back link, eyebrow (STOCK), title, description, header actions and the permission
// gate (a role without the key gets the 403 page; the API refuses too). Used by every (app) route outside Settings.
import { roleCan, type MerchantPermission } from '@djaber/shared';
import { PageHeader } from '@djaber/ui';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Page403 } from '@/components/global-states';
import { Link } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

export function AppPage({
  eyebrow,
  title,
  description,
  actions,
  permission,
  back,
  breadcrumb,
  badges,
  children,
  wide,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** every key must be held */
  permission?: MerchantPermission | MerchantPermission[];
  back?: { href: string; label: string };
  /** trail above the title of a detail page (Produits / Parfums / Parfum Oud) */
  breadcrumb?: ReactNode;
  /** pills next to the title */
  badges?: ReactNode;
  children: ReactNode;
  /** no max width (lists); forms and details are capped */
  wide?: boolean;
}) {
  const t = useT();
  const locale = useLocaleCode();
  const { role } = useSession();
  const keys = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  if (keys.some((k) => !roleCan(role, k))) return <Page403 role={role ? t(`enum.Membership.role.${role}`) : '—'} homeHref={`/${locale}/home`} />;
  return (
    <div className={wide ? 'flex flex-col gap-5' : 'mx-auto flex w-full max-w-6xl flex-col gap-5'}>
      {back ? (
        <Link href={back.href} className="inline-flex w-fit items-center gap-1.5 ts-label-meta uppercase text-text-muted hover:text-text-primary">
          <ArrowLeft className="size-3 rtl:-scale-x-100" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      {breadcrumb}
      {badges ? (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <div className="ts-label-meta mb-2 uppercase text-text-muted">{eyebrow}</div> : null}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="ts-display-m min-w-0 truncate">{title}</h1>
              {badges}
            </div>
            {description ? <p className="ts-body mt-2 text-text-secondary">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : (
        <PageHeader eyebrow={eyebrow} title={title} description={typeof description === 'string' ? description : undefined} actions={actions} />
      )}
      {!badges && description && typeof description !== 'string' ? <div className="ts-body -mt-3 text-text-secondary">{description}</div> : null}
      {children}
    </div>
  );
}
