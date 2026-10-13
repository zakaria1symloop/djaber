'use client';
// PublicLayout footer (PUB-01; Figma "PUB — Pricing page" footer row: © Djaber.ai 2026 · Conditions · Confidentialité ·
// Supprimer mon compte · Statut · Contact; "PUB — Legal (CMS) …": legal links, account deletion, status, store badges).
// The FR · AR · EN switch is repeated here on phones (the header hides it below 640 px).
import { Suspense } from 'react';
import { LocaleSwitch } from '@/components/auth/auth-card';
import { LEGAL_FOOTER_KEYS } from '@/features/public/logic';
import { Link } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';

const link = 'whitespace-nowrap hover:text-text-primary';

export function PublicFooter() {
  const t = useT();
  return (
    <footer className="mt-auto border-t border-line-hairline" data-testid="public-footer">
      <div className="mx-auto flex max-w-[1344px] flex-col gap-4 px-4 py-5 md:px-12">
        <nav aria-label={t('public.footer.label')} className="flex flex-wrap items-center gap-x-[18px] gap-y-2 ts-label-meta text-text-muted">
          <span className="whitespace-nowrap">{t('public.footer.copyright', { year: new Date().getFullYear() })}</span>
          {LEGAL_FOOTER_KEYS.map((k) => (
            <Link key={k} href={`/legal/${k}`} className={link}>
              {t(`public.footer.${k}`)}
            </Link>
          ))}
          <Link href="/account/deletion" className={link}>
            {t('public.footer.deleteAccount')}
          </Link>
          <Link href="/status" className={link}>
            {t('public.footer.status')}
          </Link>
          <Link href="/help/contact" className={link}>
            {t('public.footer.contact')}
          </Link>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" aria-label={t('public.footer.stores')} role="group">
            {(['googlePlay', 'appStore'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-card border border-line-edge px-2.5 py-1 ts-label-micro text-text-secondary" data-testid={`store-${s}`}>
                {t(`public.footer.${s}`)}
                <span className="text-text-muted">· {t('public.footer.storesSoon')}</span>
              </span>
            ))}
          </div>
          <Suspense>
            <LocaleSwitch className="sm:hidden" />
          </Suspense>
        </div>
      </div>
    </footer>
  );
}
