'use client';
// Shared pieces of the server-rendered public pages (12 §27 / GLOBAL states): Markdown body of a CMS entry, locale
// fallback banner ("affiché en français"), admin preview banner, error state with "Réessayer" (offline aware),
// skeletons that match the content (no layout shift), the public 404 with search and links.
import { Banner, ErrorState, NotFoundState, SearchInput, Skeleton, buttonClass } from '@djaber/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { articleBlocks } from '@/features/help/logic';
import { Link, useRouter as useLocaleRouter } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';

/** Light Markdown of a CMS body (`#` headings, `- ` lists, paragraphs) rendered as text — never as HTML. */
export function CmsBody({ body, className, headingLevel = 2 }: { body: string; className?: string; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={className ?? 'flex flex-col gap-3'} data-testid="cms-body">
      {articleBlocks(body).map((b, i) =>
        b.kind === 'h' ? (
          <H key={i} className="mt-2 text-[15px] font-medium text-text-primary [overflow-wrap:anywhere]">
            {b.text}
          </H>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="ms-5 flex list-disc flex-col gap-1 text-[14px] leading-relaxed text-text-secondary">
            {b.items.map((it, j) => (
              <li key={j} className="[overflow-wrap:anywhere]">
                {it}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap text-[14px] leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}

/** "Cette page n’est pas encore disponible en العربية — version française affichée." (PUB-03 LANGUE MANQUANTE) */
export function FallbackBanner({ requested }: { requested: string }) {
  const t = useT();
  return (
    <Banner tone="warning" className="w-full">
      <span data-testid="cms-fallback">{t('public.fallback.banner', { language: t(`public.lang.${requested}`) })}</span>
    </Banner>
  );
}

export function PreviewBanner() {
  const t = useT();
  return (
    <Banner tone="info" className="w-full">
      <span data-testid="cms-preview">{t('public.preview.banner')}</span>
    </Banner>
  );
}

/** Error of a server read (API down / 5xx): offline aware, "Réessayer" re-renders the page on the server. */
export function PublicError({ refId }: { refId: string }) {
  const t = useT();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return (
    <div className="w-full" data-testid="public-error">
      <ErrorState
        title={t('public.error.title')}
        description={offline ? t('public.error.offline') : t('public.error.description', { ref: refId })}
        action={{ label: t('action.retry'), onClick: () => router.refresh() }}
      />
    </div>
  );
}

/** Whole-page error state of a public page. */
export function PublicErrorPage({ refId }: { refId: string }) {
  return (
    <ReadingColumn>
      <PublicError refId={refId} />
    </ReadingColumn>
  );
}

/** Narrow reading column of a CMS / help / legal page (designed content width, not the app's full width). */
export function ReadingColumn({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 py-10 md:py-12 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

/** Skeleton of a CMS page: title + 8 lines (12 §27 "SQUELETTE titre + 8 lignes"). */
export function CmsSkeleton() {
  const t = useT();
  return (
    <ReadingColumn>
      <div role="status" aria-label={t('common.loading')} aria-busy="true" className="flex flex-col gap-3" data-testid="public-skeleton">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-3 w-48" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={i % 3 === 2 ? 'h-4 w-2/3' : 'h-4 w-full'} />
        ))}
      </div>
    </ReadingColumn>
  );
}

/** Public 404 (PUB-04 "404 : « Page introuvable » + recherche + liens (accueil, aide, statut)"). */
export function PublicNotFound() {
  const t = useT();
  const router = useLocaleRouter();
  const [q, setQ] = useState('');
  return (
    <ReadingColumn className="items-center" data-testid="public-not-found">
      <NotFoundState title={t('public.notFound.title')} description={t('public.notFound.description')} className="w-full" />
      <form
        className="w-full max-w-[480px]"
        onSubmit={(e) => {
          e.preventDefault();
          // the field debounces its onChange: read what is typed right now
          const v = (e.currentTarget.querySelector('input[type=search]') as HTMLInputElement | null)?.value.trim() ?? q.trim();
          router.push(v ? `/help-center?q=${encodeURIComponent(v)}` : '/help-center');
        }}
      >
        <SearchInput value={q} onChange={setQ} label={t('public.help.search.label')} placeholder={t('public.help.search.placeholder')} clearLabel={t('list.clearSearch')} className="w-full" />
      </form>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonClass({ variant: 'primary' })}>
          {t('public.notFound.home')}
        </Link>
        <Link href="/help-center" className={buttonClass({})}>
          {t('public.notFound.help')}
        </Link>
        <Link href="/status" className={buttonClass({})}>
          {t('public.notFound.status')}
        </Link>
      </div>
    </ReadingColumn>
  );
}
