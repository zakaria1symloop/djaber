'use client';
// Development gallery of the shell + GLOBAL states (also covered by Storybook in packages/ui). Not linked from the app.
import { ActionsMenu, Banner, Button, Card, PageHeader, Pagination, Pill, SectionLabel, StatTile, toast } from '@djaber/ui';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import {
  ConflictDialog,
  LeaveGuardDialog,
  ListEmpty,
  ListFilteredEmpty,
  ListLoading,
  OfflineBanner,
  Page403,
  Page404,
  PageSessionExpired,
  PageSuspended,
  QueryError,
} from '@/components/global-states';
import { AppShell } from '@/components/shell/app-shell';
import { FOOTER_NAV, MAIN_NAV } from '@/components/shell/nav';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function StatesGallery() {
  const t = useT();
  const [leave, setLeave] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [page, setPage] = useState(1);
  // never served by a production deployment; the e2e build opts in (playwright.config.ts)
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEV_GALLERY !== '1') notFound();
  const err = new ApiError(500, { code: 'INTERNAL', message: 'x', params: {}, fields: {}, details: null, ref: '8f2a-19' });

  return (
    <AppShell
      groups={MAIN_NAV}
      footer={FOOTER_NAV}
      counters={{ queue: 3, inbox: 8 }}
      banners={[{ id: 'emailUnverified', tone: 'info', content: t('banner.emailUnverified'), action: { label: t('action.resend') } }]}
      topBar={<Pill>{t('topbar.credits', { used: '3 760', limit: '5 000' })}</Pill>}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <PageHeader eyebrow="GLOBAL" title="États globaux" description="Squelette · vide · vide filtré · erreur · hors ligne · 403 · 404 · conflit · quitter" />

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <ListLoading />
          </Card>
          <ListEmpty title={t('state.list.empty.orders.title')} description={t('state.list.empty.orders.description')} action={{ label: t('action.newOrder') }} />
          <ListFilteredEmpty entity={t('nav.orders')} filters="Source : API · Sétif" onClear={() => toast(t('action.clearFilters'))} />
          <QueryError error={err} onRetry={() => toast({ tone: 'info', message: t('action.retry') })} />
        </section>
        <OfflineBanner since="05 oct. 11:40" onRetry={() => undefined} />

        <SectionLabel>Pages système</SectionLabel>
        <section className="grid gap-4 md:grid-cols-2">
          <Page403 role="Opérateur" homeHref="#" />
          <Page404 homeHref="#" />
          <PageSuspended reason="Acomptes demandés hors Djaber" supportHref="#" />
          <PageSessionExpired path="/commandes/CMD-1042" loginHref="#" />
        </section>

        <SectionLabel>Bandeaux</SectionLabel>
        <section className="flex flex-col gap-2">
          <Banner tone="danger" action={{ label: t('action.buyCredits') }}>
            {t('banner.credits100', { used: '5 000', limit: '5 000', date: '12 oct.' })}
          </Banner>
          <Banner tone="warning" action={{ label: t('action.view') }}>
            {t('banner.credits80', { used: '4 000', limit: '5 000', date: '09 oct.' })}
          </Banner>
          <Banner tone="neutral">{t('banner.readOnly')}</Banner>
        </section>

        <SectionLabel>Toasts · dialogues · actions</SectionLabel>
        <section className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => toast(t('state.form.saved'))}>
            Toast
          </Button>
          <Button onClick={() => toast({ tone: 'danger', message: t('error.FORBIDDEN') })}>Toast erreur</Button>
          <Button onClick={() => setLeave(true)}>{t('state.form.leave.title')}</Button>
          <Button onClick={() => setConflict(true)}>{t('state.form.conflict.title')}</Button>
          <ActionsMenu
            label={t('action.actions')}
            actions={[
              { key: 'confirm', label: t('action.confirm'), primary: true },
              { key: 'send', label: t('action.sendToCourier'), disabledReason: t('error.FORBIDDEN') },
              { key: 'delete', label: t('action.delete'), destructive: true },
            ]}
          />
          <Pill tone="success" dot>
            IA
          </Pill>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="PAGES CONNECTÉES" value="2" />
          <StatTile label="PRODUITS" value="128" hint="2 stock faible" />
          <StatTile label="CHIFFRE D'AFFAIRES (30J)" value="0" unit="DA" />
          <StatTile label="VALEUR DU STOCK" value="1,24" unit="M DA" />
        </section>
        <Card>
          <Pagination
            page={page}
            pageSize={25}
            total={128}
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            labels={{
              previous: t('action.previousPage'),
              next: t('action.nextPage'),
              perPage: (n) => t('common.perPage', { count: n }),
              range: (from, to, total) => t('common.rangeOf', { from, to, total }),
            }}
          />
        </Card>
      </div>
      <LeaveGuardDialog open={leave} name="La Robe satin" onStay={() => setLeave(false)} onLeave={() => setLeave(false)} />
      <ConflictDialog open={conflict} name="Nadia F." ago="20 s" onOverwrite={() => setConflict(false)} onReload={() => setConflict(false)} onClose={() => setConflict(false)} />
    </AppShell>
  );
}
