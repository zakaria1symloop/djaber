'use client';
// /home — M1 part of "ANA-01 — Home — new workspace + banners": greeting, date and the Get Started checklist (ONB-02).
// The queue, KPI tiles, quick actions and "Vos pages" blocks arrive with M3–M5 (no placeholder numbers before that).
import { ChecklistRow, SectionLabel, Skeleton } from '@djaber/ui';
import { ChevronRight } from 'lucide-react';
import { QueryError } from '@/components/global-states';
import { useOnboarding } from '@/features/workspace/api';
import { Link } from '@/i18n/navigation';
import { CHECKLIST_KEYS, checklistOf, type ChecklistKey } from '@/lib/contracts';
import { greetingKey, longDate } from '@/features/home/greeting';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

const HREF: Record<ChecklistKey, string> = { channel: '/channels', product: '/products', agent: '/agents', sale: '/orders' };

export default function HomePage() {
  const t = useT();
  const locale = useLocaleCode();
  const { me } = useSession();
  const home = useOnboarding();
  const now = new Date();
  const list = checklistOf(home.data);
  const done = CHECKLIST_KEYS.filter((k) => list[k]).length;

  return (
    <div className="mx-auto flex w-full max-w-[1136px] flex-col gap-8">
      <header>
        <div className="ts-label-meta uppercase text-text-muted">{longDate(now, locale)}</div>
        <h1 className="ts-display-m mt-2">{t(greetingKey(now), { name: me?.firstName ?? '' })}</h1>
        <p className="ts-body mt-2 text-text-secondary">{t('home.subtitle')}</p>
      </header>

      <section aria-labelledby="get-started" className="w-full max-w-[380px]">
        <div className="flex items-center justify-between px-5">
          <SectionLabel id="get-started">{t('home.getStarted.title')}</SectionLabel>
          {home.isSuccess ? (
            <bdi dir="ltr" className="ts-label-meta tabular-nums text-text-primary" data-testid="checklist-count">
              {done} / {CHECKLIST_KEYS.length}
            </bdi>
          ) : null}
        </div>
        <div className="mt-3">
          {home.isPending ? (
            <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3 px-3">
              {CHECKLIST_KEYS.map((k) => (
                <Skeleton key={k} className="h-12" />
              ))}
            </div>
          ) : home.isError ? (
            <QueryError error={home.error} onRetry={() => home.refetch()} />
          ) : (
            <ol className="flex flex-col">
              {CHECKLIST_KEYS.map((k, i) => (
                <li key={k} data-step={k}>
                  <Link href={HREF[k]} className="block rounded-card px-3 hover:bg-ink-raised">
                    <ChecklistRow
                      done={list[k]}
                      index={i + 1}
                      title={t(`home.getStarted.${k}.title`)}
                      description={t(`home.getStarted.${k}.description`)}
                      action={<ChevronRight className="mt-1 size-4 shrink-0 text-text-muted rtl:-scale-x-100" aria-hidden />}
                    />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
