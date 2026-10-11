'use client';
// Moderation, merchant side, on the product page — Figma "MOD — Product — rejected view + appeal dialog (merchant)"
// and the "Validation Djaber" block of "CAT-09 — Product page — full": rejected banner, status block (validé / en
// attente / refusé / contestation en cours), validation timeline, one-shot appeal dialog (message ≤ 500).
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDate, formatDateTime, ProductAppealSchema } from '@djaber/shared';
import { Button, buttonClass, cn, Dialog, Field, FormAlert, Textarea, toast, toneDot } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { applyServerErrors, fieldError } from '@/lib/forms';
import { useLocaleCode, useT, type TFunction } from '@/lib/i18n';
import { catalogApi, useCatalogRefresh } from '../api';
import type { Product } from '../contracts';
import { ModerationPill } from '../ui';
import { appealExpired, rejectedField, timelineTone, type ModerationView } from './logic';
import { Block, Note, Row, Rows } from './parts';

type Locale = 'fr' | 'ar' | 'en';
const APPEAL_MAX = 500;

const decisionLabel = (t: TFunction, decision: string | null) => {
  if (!decision) return t('products.moderation.decision.other');
  const key = `products.moderation.decision.${decision}`;
  return t.has(key) ? t(key) : decision;
};
const fieldLabel = (t: TFunction, raw: string) => {
  const f = rejectedField(raw);
  if (f.field === 'image') return f.index ? t('products.moderation.field.imageN', { n: f.index }) : t('products.moderation.field.image');
  return f.field ? t(`products.moderation.field.${f.field}`) : f.raw;
};

/** Banner on top of a rejected product: reason, message of the moderator, rules, the two ways out. */
export function RejectedBanner({ product, view, canWrite, onAppeal }: { product: Pick<Product, 'id'>; view: ModerationView; canWrite: boolean; onAppeal: () => void }) {
  const t = useT();
  return (
    <div role="alert" data-testid="rejected-banner" className="flex flex-wrap items-start gap-3 rounded-[6px] border-s-2 border-s-accent-alert bg-ink-raised px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{t('products.moderation.banner.title', { reason: decisionLabel(t, view.decision) })}</div>
        {view.message ? <p className="mt-1.5 text-[13px] text-text-secondary">{view.message}</p> : null}
        {view.rejectedFields.length ? (
          <p className="mt-1 ts-label-meta text-text-secondary">{t('products.moderation.banner.fields', { fields: view.rejectedFields.map((f) => fieldLabel(t, f)).join(', ') })}</p>
        ) : null}
        <p className="mt-1 ts-label-meta text-text-muted">
          {view.rules.length ? `${t('products.moderation.banner.rules', { rules: view.rules.join(' · ') })} ` : ''}
          {t('products.moderation.banner.hidden')} {t('products.moderation.sla')}
        </p>
      </div>
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          {view.canAppeal ? (
            <Button size="sm" variant="ghost" onClick={onAppeal} data-testid="appeal-open">
              {t('products.moderation.appeal.once')}
            </Button>
          ) : null}
          <Link href={`/products/${product.id}/edit`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
            {t('products.moderation.editResubmit')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Timeline({ view }: { view: ModerationView }) {
  const t = useT();
  const locale = useLocaleCode() as Locale;
  // newest first, as the frame
  const entries = [...view.history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const note = (e: ModerationView['history'][number]) => {
    if (!e.note) return null;
    const source = `products.moderation.source.${e.note}`;
    return e.status === 'pending' && t.has(source) ? t(source) : e.note;
  };
  const windowLine =
    view.kind === 'rejected' && view.appeal?.deadlineAt
      ? appealExpired(view)
        ? { tone: 'neutral' as const, title: `${t('error.MODERATION_APPEAL_WINDOW_EXPIRED')} (MODERATION_APPEAL_WINDOW_EXPIRED)`, sub: null }
        : { tone: 'warning' as const, title: t('products.moderation.appeal.until', { date: formatDate(view.appeal.deadlineAt, locale) }), sub: t('products.moderation.appeal.rules') }
      : null;
  if (!entries.length && !windowLine) return null;
  return (
    <div data-testid="moderation-history">
      <h3 className="ts-label-section mb-2 text-text-muted">{t('products.moderation.history.title')}</h3>
      <ol className="flex flex-col gap-2.5">
        {entries.map((e, i) => {
          const label = `products.moderation.history.${e.status}`;
          const sub = note(e);
          return (
            <li key={`${e.at}-${i}`} className="flex gap-2.5">
              <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', toneDot[timelineTone(e.status)])} />
              <div className="min-w-0">
                <div className="text-[13px]">{t.has(label) ? t(label) : e.status}</div>
                <div className="ts-label-micro uppercase text-text-muted">
                  <bdi>{formatDateTime(e.at, locale)}</bdi>
                  {sub ? ` · ${sub}` : ''}
                </div>
              </div>
            </li>
          );
        })}
        {windowLine ? (
          <li className="flex gap-2.5" data-testid="appeal-window">
            <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', toneDot[windowLine.tone])} />
            <div className="min-w-0">
              <div className="text-[13px]">{windowLine.title}</div>
              {windowLine.sub ? <div className="ts-label-micro uppercase text-text-muted">{windowLine.sub}</div> : null}
            </div>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

/** "Validation Djaber" block. */
export function ValidationBlock({
  product,
  view,
  canWrite,
  onAppeal,
  onResubmit,
  resubmitting,
}: {
  product: Pick<Product, 'id' | 'contentVersion' | 'archived'>;
  view: ModerationView;
  canWrite: boolean;
  onAppeal: () => void;
  onResubmit: () => void;
  resubmitting: boolean;
}) {
  const t = useT();
  const locale = useLocaleCode() as Locale;
  const date = (iso: string | null) => (iso ? formatDate(iso, locale) : '—');
  const version = t('products.moderation.version', { n: product.contentVersion ?? 1 });
  const editable = canWrite && !product.archived;
  return (
    <Block title={t('products.moderation.title')} testId="block-moderation" action={<ModerationPill status={view.kind === 'none' ? null : view.kind} />}>
      <Rows>
        {view.kind === 'approved' ? (
          <>
            <Row label={t('common.status')} testId="moderation-status">
              <span className="text-accent-money">
                {view.decidedAt ? t('products.moderation.approvedOn', { date: date(view.decidedAt) }) : t('products.moderation.approved')} · {version}
              </span>
            </Row>
            <Row label={t('products.moderation.nextReview')}>{t('products.moderation.nextReview.rule')}</Row>
          </>
        ) : view.kind === 'pending' ? (
          <>
            <Row label={t('common.status')} testId="moderation-status">
              <span className="text-accent-starred">{view.submittedAt ? t('products.moderation.pendingSince', { date: formatDateTime(view.submittedAt, locale) }) : t('products.moderation.pending')}</span>
            </Row>
            <Row label={t('products.moderation.delay')}>{t('products.moderation.sla')}</Row>
          </>
        ) : view.kind === 'rejected' || view.kind === 'appealed' ? (
          <>
            <Row label={t('common.status')} testId="moderation-status">
              <span className={view.kind === 'rejected' ? 'text-accent-alert' : 'text-accent-clients'}>
                {view.kind === 'rejected' ? (view.decidedAt ? t('products.moderation.rejectedOn', { date: date(view.decidedAt) }) : t('products.moderation.rejected')) : t('products.moderation.appealed')}
              </span>
            </Row>
            <Row label={t('common.reason')}>{decisionLabel(t, view.decision)}</Row>
            {view.message ? <Row label={t('products.moderation.message')}>{view.message}</Row> : null}
            {view.rules.length ? <Row label={t('products.moderation.rules')}>{view.rules.join(' · ')}</Row> : null}
            {view.rejectedFields.length ? (
              <Row label={t('products.moderation.fields')}>
                <ul className="flex flex-wrap gap-1.5" data-testid="rejected-fields">
                  {view.rejectedFields.map((f) => (
                    <li key={f} className="rounded-[4px] border border-accent-alert/60 px-1.5 py-0.5 ts-label-meta uppercase text-accent-alert">
                      {fieldLabel(t, f)}
                    </li>
                  ))}
                </ul>
              </Row>
            ) : null}
          </>
        ) : (
          <Row label={t('common.status')} testId="moderation-status">
            <span className="text-text-secondary">{t('products.moderation.notRequired')}</span>
          </Row>
        )}
      </Rows>
      <Timeline view={view} />
      {view.kind === 'rejected' && editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/products/${product.id}/edit`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
            {t('products.moderation.editResubmit')}
          </Link>
          <Button size="sm" onClick={onResubmit} loading={resubmitting} data-testid="resubmit">
            {t('products.moderation.resubmit')}
          </Button>
          {view.canAppeal ? (
            <Button size="sm" variant="ghost" onClick={onAppeal}>
              {t('products.moderation.appeal.action')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.kind === 'appealed' ? <Note>{t('products.moderation.appealed.note')}</Note> : null}
    </Block>
  );
}

type AppealValues = z.input<typeof ProductAppealSchema>;

/** "Contester le refus" — once per product, within 7 days; errors stay inside the dialog, the message is kept. */
export function AppealDialog({ product, open, onClose, onSent }: { product: Pick<Product, 'id' | 'name'>; open: boolean; onClose: () => void; onSent: () => void }) {
  const t = useT();
  const refresh = useCatalogRefresh();
  const form = useForm<AppealValues>({ resolver: zodResolver(ProductAppealSchema), defaultValues: { message: '' } });
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({ mutationFn: (v: { message: string }) => catalogApi.appeal(product.id, { message: v.message }) });
  useEffect(() => {
    if (open) {
      form.reset({ message: '' });
      setError(null);
    }
  }, [open, form]);
  const message = form.watch('message') ?? '';
  const busy = send.isPending;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await send.mutateAsync({ message: values.message.trim() });
      onSent();
      await refresh({ productId: product.id });
      toast(t('products.moderation.appeal.sent'));
      onClose();
    } catch (e) {
      const text = applyServerErrors(form, e, t, { fields: ['message'] });
      if (text) setError(e instanceof ApiError ? `${text} (${e.code})` : text);
      // the appeal is no longer possible: the page hides the button once the product is refreshed
      if (e instanceof ApiError && (e.code === 'MODERATION_APPEAL_ALREADY_USED' || e.code === 'MODERATION_APPEAL_WINDOW_EXPIRED' || e.code === 'MODERATION_NOT_REJECTED')) void refresh({ productId: product.id });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t('products.moderation.appeal.title')}
      description={product.name}
      closeLabel={t('action.close')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('action.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={busy} data-testid="appeal-submit">
            {t('products.moderation.appeal.submit')}
          </Button>
        </>
      }
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <p className="text-[13px] text-text-secondary">{t('products.moderation.appeal.intro')}</p>
        <Field label={t('products.moderation.appeal.message', { max: APPEAL_MAX })} htmlFor="appeal-message" required error={fieldError(t, form.formState.errors.message?.message, { max: APPEAL_MAX })}>
          <Textarea id="appeal-message" rows={5} maxLength={APPEAL_MAX} disabled={busy} aria-invalid={!!form.formState.errors.message} aria-describedby="appeal-count" {...form.register('message')} />
        </Field>
        <div id="appeal-count" className="-mt-2 text-end ts-label-meta tabular-nums text-text-muted">
          <bdi dir="ltr">{`${message.length} / ${APPEAL_MAX}`}</bdi>
        </div>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <p className="ts-label-meta text-text-muted">{t('products.moderation.appeal.after')}</p>
      </form>
    </Dialog>
  );
}
