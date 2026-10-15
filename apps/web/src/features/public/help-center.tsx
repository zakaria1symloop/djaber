'use client';
// Public help centre `/help-center` + guide `/help/[slug]` (route map §3.1 "public help centre", PUB-04,
// Figma "PUB — … Landing & help" + "HELP — Help & support (merchant)" public part): search (`?q=`), the 8 categories
// with their guide counts (`?category=`), the guides list, a guide = `CmsEntry(help)` (same content as the in-app help
// center, which opens guides in its side sheet). States: published · search results · [FE] no match · none published ·
// error (Réessayer) · guide 404 · locale fallback banner.
import { formatDate, HELP_CATEGORIES, type AppLocale, type HelpArticleDto, type HelpCategory } from '@djaber/shared';
import { EmptyState, FilteredEmptyState, MarketingHeading, SearchInput, buttonClass, cn } from '@djaber/ui';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { countByCategory } from '@/features/help/logic';
import { Link, useRouter } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import type { Read } from '@/lib/public-fetch';
import { helpHref, searchable, supportMailto, type HelpQuery } from './logic';
import { CmsBody, FallbackBanner, PreviewBanner, PublicError, ReadingColumn } from './shared';

function GuideList({ items, testid }: { items: HelpArticleDto[]; testid: string }) {
  const locale = useLocaleCode();
  return (
    <ul className="divide-y divide-line-hairline overflow-hidden rounded-card border border-line-edge bg-ink-surface" data-testid={testid}>
      {items.map((a) => (
        <li key={a.key}>
          <Link href={`/help/${encodeURIComponent(a.key)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-raised" data-testid="help-guide" lang={a.locale !== locale ? a.locale : undefined}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14px] text-text-primary [overflow-wrap:anywhere]">{a.title}</span>
              {a.excerpt ? <span className="ts-label-micro text-text-muted [overflow-wrap:anywhere]">{a.excerpt}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-text-muted rtl:rotate-180" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SearchForm({ initial, category }: { initial: string; category: HelpCategory | null }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [short, setShort] = useState(false);
  return (
    <form
      className="mx-auto flex w-full max-w-[640px] flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        // the field debounces its onChange: read what is typed right now
        const v = (e.currentTarget.querySelector('input[type=search]') as HTMLInputElement | null)?.value.trim() ?? q.trim();
        if (v && !searchable(v)) return setShort(true);
        setShort(false);
        router.push(helpHref({ q: v, category }));
      }}
    >
      <div className="flex gap-2">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setShort(false);
            if (!v) router.push(helpHref({ category }));
          }}
          label={t('public.help.search.label')}
          placeholder={t('public.help.search.placeholder')}
          clearLabel={t('list.clearSearch')}
          className="min-w-0 flex-1"
        />
        <button type="submit" className={buttonClass({ variant: 'primary' })} data-testid="help-search-submit">
          {t('public.help.search.submit')}
        </button>
      </div>
      {short ? <p className="ts-label-meta text-accent-alert">{t('public.help.search.short')}</p> : null}
    </form>
  );
}

export function PublicHelpCenter({ query, all, results }: { query: HelpQuery; all: Read<HelpArticleDto[]>; results: Read<HelpArticleDto[]> | null }) {
  const t = useT();
  const locale = useLocaleCode();
  const counts = all.ok ? countByCategory(all.data) : null;
  const filtering = results !== null;
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-10 md:py-12" data-testid="public-help">
      <MarketingHeading title={t('public.help.title')} sub={t('public.help.sub')} />
      <SearchForm initial={query.q} category={query.category} />
      {!all.ok ? (
        <PublicError refId={all.ref} />
      ) : (
        <>
          <nav aria-label={t('public.help.categories')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="help-categories">
            {HELP_CATEGORIES.map((c) => {
              const active = query.category === c;
              return (
                <Link
                  key={c}
                  href={helpHref({ q: query.q, category: active ? null : c })}
                  aria-current={active ? 'true' : undefined}
                  data-testid={`help-category-${c}`}
                  className={cn(
                    'flex min-h-[70px] w-full flex-col gap-1.5 rounded-card border bg-ink-surface px-4 py-3 text-start transition-colors hover:border-line-lit',
                    active ? 'border-line-lit bg-ink-raised' : 'border-line-edge',
                  )}
                >
                  <span className="flex w-full items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-text-primary">{t(`help.category.${c}`)}</span>
                    <span className="shrink-0 ts-label-micro text-text-muted">{t('help.category.count', { count: counts?.[c] ?? 0 })}</span>
                  </span>
                  <span className="ts-label-micro text-text-muted">{t(`help.category.${c}.description`)}</span>
                </Link>
              );
            })}
          </nav>
          <section className="flex flex-col gap-3" aria-labelledby="help-list-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="help-list-title" className="text-[15px] font-medium">
                {query.q && searchable(query.q) ? t('public.help.results', { q: query.q }) : query.category ? t(`help.category.${query.category}`) : t('public.help.all')}
              </h2>
              {filtering ? (
                <Link href="/help-center" className={buttonClass({ variant: 'ghost', size: 'sm' })} data-testid="help-clear">
                  {t('action.clearFilters')}
                </Link>
              ) : null}
            </div>
            {filtering && !results.ok ? (
              <PublicError refId={results.ref} />
            ) : (filtering && results.ok ? results.data : all.data).length === 0 ? (
              filtering ? (
                <FilteredEmptyState title={t('public.help.empty.title')} description={t('public.help.empty.description')} action={{ label: t('action.clearFilters'), href: `/${locale}/help-center` }} />
              ) : (
                <EmptyState icon={<BookOpen className="size-5" />} title={t('public.help.none')} />
              )
            ) : (
              <GuideList items={filtering && results.ok ? results.data : all.data} testid={filtering ? 'help-results' : 'help-all'} />
            )}
          </section>
        </>
      )}
      <ContactCard />
    </div>
  );
}

function ContactCard() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-edge bg-ink-surface px-4 py-3">
      <p className="min-w-0 flex-1 basis-60 text-[13px] text-text-secondary">{t('public.help.contact.sub')}</p>
      <a href={supportMailto(t('public.contact.subject'))} className={buttonClass({})} data-testid="help-contact">
        {t('public.help.contact')}
      </a>
    </div>
  );
}

export function PublicHelpArticle({ article, related }: { article: HelpArticleDto & { preview?: boolean }; related: HelpArticleDto[] }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const cat = (HELP_CATEGORIES as readonly string[]).includes(article.category ?? '') ? (article.category as HelpCategory) : null;
  return (
    <ReadingColumn data-testid="public-help-article" data-key={article.key}>
      <nav aria-label={t('public.help.article.back')} className="flex flex-wrap items-center gap-1 ts-label-meta text-text-muted">
        <Link href="/help-center" className="inline-flex items-center gap-1 hover:text-text-primary">
          <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t('public.help.article.back')}
        </Link>
        {cat ? (
          <>
            <span aria-hidden>·</span>
            <Link href={helpHref({ category: cat })} className="hover:text-text-primary">
              {t(`help.category.${cat}`)}
            </Link>
          </>
        ) : null}
      </nav>
      {article.preview ? <PreviewBanner /> : null}
      {article.fallback ? <FallbackBanner requested={article.requestedLocale} /> : null}
      <header className="flex flex-col gap-2">
        <h1 className="ts-display-m [overflow-wrap:anywhere]" lang={article.locale !== locale ? article.locale : undefined}>
          {article.title}
        </h1>
        {article.publishedAt ? <p className="ts-label-meta text-text-muted">{t('help.article.updated', { date: formatDate(article.publishedAt, locale) })}</p> : null}
      </header>
      <div lang={article.locale !== locale ? article.locale : undefined}>
        <CmsBody body={article.body ?? article.excerpt} />
      </div>
      {related.length ? (
        <section className="flex flex-col gap-3 pt-4" aria-labelledby="help-related">
          <h2 id="help-related" className="text-[15px] font-medium">
            {t('public.help.article.related')}
          </h2>
          <GuideList items={related} testid="help-related" />
        </section>
      ) : null}
      <ContactCard />
    </ReadingColumn>
  );
}
