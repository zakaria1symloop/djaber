'use client';
// PublicLayout header (02-next-route-map §1, Figma "PUB — Legal (CMS) · Landing & help · Meta data-deletion status"
// page chrome): logo, locale switch FR · AR · EN, "Se connecter", "Essai gratuit 14 j". The marketing links
// (Fonctionnalités, Tarifs, Aide, Statut) arrive with their pages in M11 (assumptions-log M6).
import { buttonClass } from '@djaber/ui';
import { Suspense } from 'react';
import { LocaleSwitch } from '@/components/auth/auth-card';
import { Logo } from '@/components/shell/sidebar';
import { Link } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';

export function PublicHeader() {
  const t = useT();
  return (
    <header className="border-b border-line-hairline">
      <div className="mx-auto flex h-[88px] max-w-[1344px] items-center gap-6 px-4 md:px-12">
        <Link href="/login" aria-label="Djaber.ai" className="shrink-0">
          <Logo />
        </Link>
        <div className="ms-auto flex items-center gap-4 md:gap-8">
          <Suspense>
            <LocaleSwitch className="max-sm:hidden" />
          </Suspense>
          <Link href="/login" className="text-[15px] text-text-secondary hover:text-text-primary max-sm:hidden">
            {t('public.header.login')}
          </Link>
          <Link href="/signup" className={buttonClass({ variant: 'primary' })}>
            {t('public.header.trial')}
          </Link>
        </div>
      </div>
    </header>
  );
}
