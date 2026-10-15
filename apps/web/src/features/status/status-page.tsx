'use client';
// `/status` — Figma "PUB — Public status page (status.djaber.ai)" (981:41510), 03 OPS-06, 12 §27 "Status page":
// header (logo, FR · AR · EN, "S'abonner aux incidents (e-mail)", "Ouvrir Djaber"), incident banner (updated n min ago)
// or all-operational note, component rows (state, 90-day %, daily bars when the API sends them), incident history
// EN COURS / RÉSOLU with updates, subscription dialog (`POST /status/subscribe { email, locale }`) → subscribed.
// States: skeleton · operational · incident open · resolved list · empty history · error (Réessayer) · subscribed.
import { StatusSubscribeSchema, type AppLocale } from '@djaber/shared';
import { Banner, Button, Card, Dialog, EmailInput, ErrorState, Field, FormAlert, IncidentEntry, Skeleton, StatusComponentRow, buttonClass } from '@djaber/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { PublicHeader } from '@/components/public-header';
import { Logo } from '@/components/shell/sidebar';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/document-title';
import { applyServerErrors, fieldError } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { statusApi, useStatus, type StatusPage } from './api';
import { clock, dayClock, formatUptime, minutesSince, openIncidents, sortIncidents, uptimeDays } from './logic';

export function PublicStatusPage() {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  useDocumentTitle(t('status.title'));
  const q = useStatus();
  const [subscribing, setSubscribing] = useState(false);
  // "Mis à jour il y a n min" ticks without a refetch
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const d = q.data;
  const open = openIncidents(d);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* PublicLayout header (M11): marketing links Fonctionnalités · Tarifs · Aide · Statut + the status page's own actions */}
      <PublicHeader
        wideActions
        actions={
          <>
            {/* on phones the link wraps on two short lines inside the 88 px header instead of four lines spilling out of it */}
            <button type="button" onClick={() => setSubscribing(true)} className="min-w-0 text-end text-[13px] leading-tight text-text-secondary hover:text-text-primary sm:text-start sm:text-[15px]" data-testid="status-subscribe-open">
              {t('status.subscribe.open')}
            </button>
            <Link href="/login" className={buttonClass({ variant: 'primary', className: 'shrink-0 !whitespace-nowrap' })}>
              {t('status.openApp')}
            </Link>
          </>
        }
      />
      <main id="main" className="flex flex-1 justify-center px-4 py-10">
        <div className="flex w-full max-w-[880px] flex-col gap-4" data-testid="status-page" data-state={q.isPending ? 'loading' : q.isError ? 'error' : d?.overall}>
          <h1 className="sr-only">{t('status.title')}</h1>
          {q.isPending ? (
            <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : q.isError || !d ? (
            <ErrorState
              title={t('state.list.error.title')}
              description={t('state.list.error.description', { ref: q.error instanceof ApiError ? q.error.body.ref || '—' : '—' })}
              action={{ label: t('action.retry'), onClick: () => void q.refetch() }}
            />
          ) : (
            <>
              <StatusBanner status={d} open={open.length > 0} now={now} />
              <Card className="divide-y divide-line-hairline overflow-hidden" data-testid="status-components">
                {d.components.map((c, i) => (
                  <StatusComponentRow
                    key={c.key}
                    name={c.name}
                    state={c.status}
                    pill={t(`status.component.${c.status}`)}
                    uptime={i === 0 ? t('status.uptime.first', { pct: formatUptime(c.uptime90d, locale) }) : formatUptime(c.uptime90d, locale)}
                    days={uptimeDays(c)}
                    barsLabel={t('status.uptime.bars', { name: c.name, pct: formatUptime(c.uptime90d, locale) })}
                  />
                ))}
              </Card>
              <h2 className="mt-4 ts-label-section text-text-muted">{t('status.history')}</h2>
              {d.incidents.length === 0 ? (
                <Card className="px-4 py-6 text-center ts-label-meta text-text-muted" data-testid="status-history-empty">
                  {t('status.history.empty')}
                </Card>
              ) : (
                <Card className="divide-y divide-line-hairline overflow-hidden" data-testid="status-history">
                  {sortIncidents(d.incidents).map((i) => {
                    const resolved = !!i.resolvedAt || i.status === 'resolved';
                    const meta = resolved
                      ? t('status.incident.resolvedMeta', { from: dayClock(i.startedAt, locale), to: clock(i.resolvedAt ?? i.startedAt) })
                      : t('status.incident.openMeta', { from: dayClock(i.startedAt, locale) });
                    const updates = [...i.updates].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
                    return (
                      <IncidentEntry
                        key={i.id}
                        open={!resolved}
                        meta={meta}
                        title={i.title}
                        details={updates.length ? updates.map((u) => t('status.update.line', { label: t(`status.update.${u.status}`), time: clock(u.at), body: u.body })).join(' · ') : undefined}
                      />
                    );
                  })}
                </Card>
              )}
            </>
          )}
        </div>
      </main>
      <SubscribeDialog open={subscribing} onClose={() => setSubscribing(false)} />
    </div>
  );
}

function StatusBanner({ status, open, now }: { status: StatusPage; open: boolean; now: number }) {
  const t = useT();
  const ago = minutesSince(status.updatedAt, now);
  const updated = t('status.updatedAgo', { count: ago });
  if (!open && status.overall === 'operational' && !status.banner) {
    return (
      <Banner tone="success">
        <span data-testid="status-banner" data-state="operational">
          {t('status.allOperational')} <span className="text-text-muted">{updated}</span>
        </span>
      </Banner>
    );
  }
  const current = openIncidents(status)[0];
  const text = status.banner ?? (current ? current.title : t('status.degraded'));
  return (
    <div role="status" className="rounded-card border border-accent-starred bg-ink-surface px-4 py-3 text-[14px]" data-testid="status-banner" data-state="incident">
      {t('status.incidentBanner', { text })} {updated}
    </div>
  );
}

type SubscribeValues = z.input<typeof StatusSubscribeSchema>;
function SubscribeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const form = useForm<SubscribeValues>({ resolver: zodResolver(StatusSubscribeSchema), defaultValues: { email: '', locale } });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const sub = useMutation({ mutationFn: statusApi.subscribe });
  useEffect(() => {
    if (open) {
      setError(null);
      setDone(null);
      form.reset({ email: '', locale });
    }
  }, [open, locale, form]);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await sub.mutateAsync({ email: v.email, locale });
      setDone(v.email);
    } catch (e) {
      const msg = applyServerErrors(form, e, t, { fields: ['email'] });
      if (msg) setError(msg);
    }
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('status.subscribe.title')}
      description={done ? undefined : t('status.subscribe.description')}
      closeLabel={t('action.close')}
      size="sm"
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            {t('action.close')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void onSubmit()} loading={sub.isPending} data-testid="status-subscribe-submit">
              {t('status.subscribe.submit')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-[14px] text-text-secondary" data-testid="status-subscribed">
          {t('status.subscribe.done', { email: done })}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <Field label={t('status.subscribe.email')} htmlFor="status-email" error={fieldError(t, form.formState.errors.email?.message)}>
            <EmailInput id="status-email" {...form.register('email')} data-testid="status-subscribe-email" />
          </Field>
          {error ? <FormAlert>{error}</FormAlert> : null}
        </form>
      )}
    </Dialog>
  );
}

/**
 * `/status/confirm/[token]` (double opt-in of the subscription) and `/status/unsubscribe/[token]` — links of the status
 * e-mails: `GET /status/confirm|unsubscribe/:token` → done / link invalid / error.
 */
export function StatusTokenPage({ token, kind }: { token: string; kind: 'confirm' | 'unsubscribe' }) {
  const t = useT();
  useDocumentTitle(t('status.title'));
  const [state, setState] = useState<'loading' | 'done' | 'invalid' | 'error'>('loading');
  useEffect(() => {
    let alive = true;
    (kind === 'confirm' ? statusApi.confirm(token) : statusApi.unsubscribe(token))
      .then(() => alive && setState('done'))
      .catch((e: unknown) => alive && setState(e instanceof ApiError && (e.status === 404 || e.status === 410) ? 'invalid' : 'error'));
    return () => {
      alive = false;
    };
  }, [token, kind]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <Logo />
      <Card className="w-full max-w-md p-6 text-center" data-testid={`status-${kind}`} data-state={state}>
        {state === 'loading' ? <Skeleton className="mx-auto h-5 w-48" /> : <p className="text-[14px] text-text-secondary">{t(`status.${kind}.${state}`)}</p>}
        <Link href="/status" className={buttonClass({ variant: 'ghost', size: 'sm', className: 'mt-4' })}>
          {t('status.unsubscribe.back')}
        </Link>
      </Card>
    </div>
  );
}
