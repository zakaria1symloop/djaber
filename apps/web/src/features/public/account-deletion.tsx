'use client';
// `/account/deletion` — Figma "PUB — Public account deletion page (djaber.ai/compte/suppression)" (981:41968), PUB-06,
// DEL-01, FL-22, AT-PUB-04. Without `?token`: explanation of the 3 steps + owner note, e-mail + consent, "Recevoir le
// lien de confirmation" → the same neutral "e-mail envoyé" answer always (also when rate-limited, 429). With the e-mail
// link `?token=`: confirm (export option) → deactivated + final date + export / "Annuler la suppression" → cancelled;
// LIEN EXPIRÉ (410 `ACCOUNT_DELETION_TOKEN_EXPIRED`); blocked (`ACCOUNT_OWNS_WORKSPACE`, `WORKSPACE_HAS_DEBT`,
// `ACCOUNT_DELETION_PENDING`); partial deletion ⇒ support link. After confirmation the URL carries the cancel token
// (valid until the date) so a reload keeps the page.
import { AccountDeletionPublicRequestSchema, formatDate, formatNumber, type AccountDeletionPublicDto, type AppLocale } from '@djaber/shared';
import { Banner, Button, Card, Checkbox, EmailInput, ErrorState, Field, FormAlert, Input, NumberedSteps, ProgressBar, Skeleton, StateBlock, buttonClass } from '@djaber/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Lock, MailCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useLocaleCode, useT } from '@/lib/i18n';
import { deletionView, exportPollMs, isBlockingCode, isDeletionToken } from './logic';

type Dto = AccountDeletionPublicDto;
type Blocked = { code: 'ACCOUNT_OWNS_WORKSPACE' | 'WORKSPACE_HAS_DEBT' | 'ACCOUNT_DELETION_PENDING'; params: Record<string, string | number> };

const deletionApi = {
  request: (b: { email: string; consent: true; locale: string }) => api<{ sent: true }>('/account-deletion/request', { method: 'POST', body: b }),
  state: (token: string) => api<Dto>(`/account-deletion/confirm/${encodeURIComponent(token)}`),
  confirm: (token: string, exportData: boolean) => api<Dto>(`/account-deletion/confirm/${encodeURIComponent(token)}`, { method: 'POST', body: { exportData } }),
  cancel: (token: string) => api<Dto>(`/account-deletion/cancel/${encodeURIComponent(token)}`, { method: 'POST', body: {} }),
};

const Column = ({ children }: { children: ReactNode }) => <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-10">{children}</div>;

export function AccountDeletionPage() {
  const t = useT();
  const token = useSearchParams().get('token');
  return (
    <Column>
      <h1 className="ts-display-m">{t('public.deletion.title')}</h1>
      {token !== null ? <TokenFlow token={token} /> : <RequestFlow />}
    </Column>
  );
}

/* ---------- step 1: e-mail + consent ---------- */
function RequestFlow() {
  const t = useT();
  const locale = useLocaleCode();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; consent?: string }>({});
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (b: { email: string; consent: true }) => deletionApi.request({ ...b, locale }),
    onSuccess: (_d, b) => setSentTo(b.email),
    onError: (e, b) => {
      // 429 RATE_LIMITED keeps the neutral answer (no hint that the address exists, 3 / h / IP)
      if (e instanceof ApiError && e.status === 429) return setSentTo(b.email);
      if (e instanceof ApiError && e.status === 422 && Object.keys(e.body.fields ?? {}).length) {
        const f = e.body.fields;
        return setErrors({ email: f.email ? t(f.email) : undefined, consent: f.consent ? t(f.consent) : undefined });
      }
      setFailure(e instanceof ApiError ? t('public.error.description', { ref: e.body.ref || '—' }) : t('toast.noConnection'));
    },
  });
  const submit = () => {
    setFailure(null);
    const parsed = AccountDeletionPublicRequestSchema.safeParse({ email, consent: consent || undefined });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      return setErrors({ email: f.email?.[0] ? t(f.email[0]) : undefined, consent: f.consent?.[0] ? t(f.consent[0]) : undefined });
    }
    setErrors({});
    send.mutate({ email: parsed.data.email, consent: true });
  };

  return (
    <>
      <p className="ts-label-meta text-text-secondary">{t('public.deletion.intro')}</p>
      <NumberedSteps
        aria-label={t('public.deletion.steps')}
        data-testid="deletion-steps"
        steps={[
          { id: '1', marker: '1', title: t('public.deletion.step1.title'), sub: t('public.deletion.step1.sub') },
          { id: '2', marker: '2', title: t('public.deletion.step2.title'), sub: t('public.deletion.step2.sub') },
          { id: '3', marker: '3', title: t('public.deletion.step3.title'), sub: t('public.deletion.step3.sub') },
          { id: 'owner', marker: '!', tone: 'warning', title: t('public.deletion.owner.title'), sub: t('public.deletion.owner.sub') },
        ]}
      />
      {sentTo ? (
        <Card className="flex flex-col gap-3 px-5 py-[18px]" data-testid="deletion-sent">
          <StateBlock icon={<MailCheck className="size-5" />} title={t('public.deletion.sent.title')} description={t('public.deletion.sent.text', { email: sentTo })} className="!border-0 !p-0" />
          <Button
            variant="ghost"
            className="self-center"
            onClick={() => {
              setSentTo(null);
              setEmail('');
              setConsent(false);
            }}
          >
            {t('public.deletion.sent.again')}
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 px-5 py-[18px]" data-testid="deletion-form">
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label={t('public.deletion.form.email')} htmlFor="del-email" error={errors.email}>
              <EmailInput id="del-email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email || undefined} />
            </Field>
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 text-[13px] text-text-secondary">
                <Checkbox className="mt-0.5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="del-consent" aria-invalid={!!errors.consent || undefined} />
                <span>{t('public.deletion.form.consent')}</span>
              </label>
              {errors.consent ? (
                <p role="alert" className="text-[12px] text-accent-alert">
                  {errors.consent}
                </p>
              ) : null}
            </div>
            {failure ? <FormAlert>{failure}</FormAlert> : null}
            <Button type="submit" loading={send.isPending} className="w-full justify-start !border-accent-alert !text-accent-alert" data-testid="del-submit">
              {t('public.deletion.form.submit')}
            </Button>
          </form>
        </Card>
      )}
      <PartialLink />
    </>
  );
}

function PartialLink() {
  const t = useT();
  return (
    <div className="flex flex-col gap-0.5 rounded-card bg-ink-raised px-3 py-2" data-testid="deletion-partial">
      <Link href="/help/contact" className="text-[13px] text-text-primary underline decoration-line-lit underline-offset-4 hover:decoration-white">
        {t('public.deletion.partial')}
      </Link>
      <span className="ts-label-meta text-text-muted">{t('public.deletion.partial.sub')}</span>
    </div>
  );
}

/* ---------- steps 2–3: the e-mail link ---------- */
function TokenFlow({ token: initial }: { token: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState(initial);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [exportData, setExportData] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const valid = isDeletionToken(token);
  const q = useQuery({
    queryKey: ['public', 'account-deletion', token],
    queryFn: () => deletionApi.state(token),
    enabled: valid,
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1,
    refetchInterval: (query) => exportPollMs(query.state.data?.export?.status),
  });
  const [after, setAfter] = useState<Dto | null>(null);
  const d = after ?? q.data ?? null;
  const fail = (e: unknown) => {
    if (e instanceof ApiError && isBlockingCode(e.code)) return setBlocked({ code: e.code, params: e.body.params ?? {} });
    if (e instanceof ApiError && e.code === 'ACCOUNT_DELETION_TOKEN_EXPIRED') return setAfter(null), void q.refetch();
    setActionError(e instanceof ApiError ? e.message || t('public.error.description', { ref: e.body.ref || '—' }) : t('toast.noConnection'));
  };
  const confirm = useMutation({
    mutationFn: () => deletionApi.confirm(token, exportData),
    onSuccess: (r) => {
      setAfter(r);
      if (r.cancelToken) {
        // the confirmation link is single use: the page continues with the cancel token (reload-safe)
        setToken(r.cancelToken);
        router.replace(`${pathname}?token=${encodeURIComponent(r.cancelToken)}`, { scroll: false });
        setAfter(null);
      }
    },
    onError: fail,
  });
  const cancel = useMutation({ mutationFn: () => deletionApi.cancel(token), onSuccess: (r) => setAfter(r), onError: fail });

  const expired = !valid || (q.error instanceof ApiError && (q.error.code === 'ACCOUNT_DELETION_TOKEN_EXPIRED' || q.error.status === 410 || q.error.status === 404));
  if (blocked) return <BlockedView blocked={blocked} />;
  if (expired) return <ExpiredView />;
  if (q.isPending && !after) return <TokenSkeleton />;
  if (q.isError && !after) {
    const ref = q.error instanceof ApiError ? q.error.body.ref || '—' : '—';
    return (
      <Card className="p-5" data-testid="deletion-state" data-state="error">
        <ErrorState className="!border-0 !p-0" title={t('public.error.title')} description={t('public.error.description', { ref })} action={{ label: t('action.retry'), onClick: () => void q.refetch() }} />
      </Card>
    );
  }
  if (!d) return <TokenSkeleton />;
  const view = deletionView(d.status);
  if (view === 'blocked') return <BlockedView blocked={{ code: d.blockedReason ?? 'ACCOUNT_OWNS_WORKSPACE', params: {} }} />;
  if (view === 'cancelled') return <CancelledView />;
  if (view === 'done') return <ExpiredView />;
  if (view === 'grace') return <GraceView d={d} busy={cancel.isPending} error={actionError} onCancel={() => (setActionError(null), cancel.mutate())} />;
  return <ConfirmView d={d} exportData={exportData} setExportData={setExportData} busy={confirm.isPending} error={actionError} onConfirm={() => (setActionError(null), confirm.mutate())} />;
}

function TokenSkeleton() {
  const t = useT();
  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]" data-testid="deletion-state" data-state="loading">
      <div role="status" aria-label={t('common.loading')} aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  );
}

function ConfirmView({ d, exportData, setExportData, busy, error, onConfirm }: { d: Dto; exportData: boolean; setExportData: (v: boolean) => void; busy: boolean; error: string | null; onConfirm: () => void }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  return (
    <Card className="flex flex-col gap-4 px-5 py-[18px]" data-testid="deletion-state" data-state="confirm">
      <h2 className="text-[15px] font-medium">{t('public.deletion.confirm.title')}</h2>
      <p className="text-[13px] text-text-secondary">
        {t('public.deletion.confirm.text', { email: d.emailMasked, date: formatDate(d.requestedAt, locale), expires: d.linkExpiresAt ? formatDate(d.linkExpiresAt, locale) : '—' })}
      </p>
      {d.ownedWorkspaces.length ? <Banner tone="warning">{t('public.deletion.confirm.owned', { names: d.ownedWorkspaces.map((w) => w.name).join(', ') })}</Banner> : null}
      <label className="flex items-start gap-2 text-[13px] text-text-secondary">
        <Checkbox className="mt-0.5 shrink-0" checked={exportData} onChange={(e) => setExportData(e.target.checked)} data-testid="del-export" />
        <span>{t('public.deletion.confirm.export')}</span>
      </label>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button variant="danger" loading={busy} onClick={onConfirm} className="w-full" data-testid="del-confirm">
        {t('public.deletion.confirm.submit')}
      </Button>
    </Card>
  );
}

function GraceView({ d, busy, error, onCancel }: { d: Dto; busy: boolean; error: string | null; onCancel: () => void }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const x = d.export;
  return (
    <Card className="flex flex-col gap-4 px-5 py-[18px]" data-testid="deletion-state" data-state="grace">
      <StateBlock icon={<Clock className="size-5" />} title={t('public.deletion.grace.title')} description={t('public.deletion.grace.text', { date: d.scheduledAt ? formatDate(d.scheduledAt, locale) : '—' })} className="!border-0 !p-0" />
      {x ? (
        <div className="flex flex-col gap-2 rounded-card border border-line-edge bg-ink-raised p-3" data-testid="deletion-export" data-status={x.status}>
          <p className="ts-label-meta text-text-muted">{t('public.deletion.export.title')}</p>
          {x.status === 'done' && x.url ? (
            <div className="flex flex-wrap items-center gap-3">
              <a href={x.url} className={buttonClass({ variant: 'primary' })} data-testid="deletion-export-link">
                {t('public.deletion.export.download')}
              </a>
              {x.expiresAt ? <span className="ts-label-meta text-text-muted">{t('public.deletion.export.expires', { date: formatDate(x.expiresAt, locale) })}</span> : null}
            </div>
          ) : x.status === 'queued' || x.status === 'running' ? (
            <>
              <ProgressBar value={x.progress} label={t('public.deletion.export.running', { progress: formatNumber(x.progress) })} />
              <p className="text-[13px] text-text-secondary">{t('public.deletion.export.running', { progress: formatNumber(x.progress) })}</p>
            </>
          ) : (
            <p className="text-[13px] text-accent-alert">{t('public.deletion.export.failed')}</p>
          )}
        </div>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} onClick={onCancel} data-testid="del-cancel">
          {t('public.deletion.grace.cancel')}
        </Button>
        <Link href="/login" className="text-[13px] text-text-secondary underline decoration-line-lit underline-offset-4 hover:text-text-primary">
          {t('public.deletion.grace.login')}
        </Link>
      </div>
    </Card>
  );
}

function CancelledView() {
  const t = useT();
  return (
    <Card className="flex flex-col gap-4 px-5 py-[18px]" data-testid="deletion-state" data-state="cancelled">
      <StateBlock icon={<CheckCircle2 className="size-5" />} title={t('public.deletion.cancelled.title')} description={t('public.deletion.cancelled.text')} className="!border-0 !p-0" />
      <Link href="/login" className={buttonClass({ variant: 'primary', className: 'self-center' })}>
        {t('public.header.login')}
      </Link>
    </Card>
  );
}

function ExpiredView() {
  const t = useT();
  return (
    <Card className="flex flex-col gap-4 px-5 py-[18px]" data-testid="deletion-state" data-state="expired">
      <StateBlock icon={<Clock className="size-5" />} title={t('public.deletion.expired.title')} description={t('public.deletion.expired.text')} className="!border-0 !p-0" />
      <Link href="/account/deletion" className={buttonClass({ variant: 'primary', className: 'self-center' })} data-testid="del-restart">
        {t('public.deletion.expired.action')}
      </Link>
    </Card>
  );
}

function BlockedView({ blocked }: { blocked: Blocked }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const kind = blocked.code === 'ACCOUNT_OWNS_WORKSPACE' ? 'owner' : blocked.code === 'WORKSPACE_HAS_DEBT' ? 'debt' : 'pending';
  const amount = Number(blocked.params.amount ?? 0);
  const date = typeof blocked.params.scheduledAt === 'string' && blocked.params.scheduledAt ? formatDate(blocked.params.scheduledAt, locale) : '—';
  return (
    <Card className="flex flex-col gap-4 px-5 py-[18px]" data-testid="deletion-state" data-state="blocked" data-code={blocked.code}>
      <StateBlock
        icon={<Lock className="size-5" />}
        tone="danger"
        title={t(`public.deletion.blocked.${kind}.title`)}
        description={t(`public.deletion.blocked.${kind}.text`, { amount: formatNumber(amount), date })}
        className="!border-0 !p-0"
      />
      <div className="flex flex-wrap justify-center gap-2">
        {kind !== 'pending' ? (
          <Link href="/settings/danger" className={buttonClass({ variant: 'primary' })}>
            {t('public.deletion.blocked.settings')}
          </Link>
        ) : null}
        <Link href="/help/contact" className={buttonClass({})}>
          {t('public.help.contact')}
        </Link>
      </div>
    </Card>
  );
}
