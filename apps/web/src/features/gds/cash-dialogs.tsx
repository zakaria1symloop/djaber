'use client';
// Cash register dialogs — Figma DLG GDS "Mouvement de caisse manuel" (Entrée / Sortie, montant, mode, type, date,
// libellé, justificatif; closed day ⇒ `CASH_DAY_CLOSED`), GDS-09 "Clôturer le 05 octobre" (theoretical cash vs counted,
// gap, note required when ≠ 0, creates a CORRECTION row and locks the day), DLG GDS II "Caisse — ligne manuelle &
// verrous" (edit ≤ 24 h `CASH_ENTRY_EDIT_WINDOW_EXPIRED`, delete = simple confirmation, auto rows locked) and the
// "Rouvrir la journée" dialog (Admin+, reason, audited).
import { formatMoney } from '@djaber/shared';
import { Dialog, Field, FormAlert, Input, Ltr, MoneyInput, Select, toast } from '@djaber/ui';
import { useState } from 'react';
import { algiersDay } from '@/features/catalog/stock/logic';
import { DialogFooter, RadioList, useDialogSubmit, useOnOpen } from '@/features/orders/dialogs/common';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { digitsToInt, moneyDigits } from '@/lib/money';
import { uploadWithProgress } from '@/lib/upload';
import { gdsApi, useGdsRefresh } from './api';
import { CASH_MANUAL_IN, CASH_MANUAL_OUT, PAYMENT_METHODS, type CashCategory, type CashMethod, type CashRow, type CashType } from './contracts';
import { closingGap } from './logic';
import { useDayLabel } from './ui';

export type ManualMode = { kind: 'new' } | { kind: 'edit'; row: CashRow } | { kind: 'duplicate'; row: CashRow } | { kind: 'correct'; row: CashRow };

/** Time of day kept when the date of a row changes (Africa/Algiers noon when the row is new). */
const dateIso = (day: string, keep?: string) => (keep && algiersDay(keep) === day ? keep : new Date(`${day}T${day === algiersDay() ? new Date().toISOString().slice(11, 19) : '12:00:00'}Z`).toISOString());

export function ManualEntryDialog({ mode, onClose, defaultDay }: { mode: ManualMode | null; onClose: () => void; defaultDay: string }) {
  const t = useT();
  const refresh = useGdsRefresh();
  const row = mode && mode.kind !== 'new' ? mode.row : null;
  const [type, setType] = useState<CashType>('expense');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CashMethod>('cash');
  const [category, setCategory] = useState<CashCategory>('shipping');
  const [day, setDay] = useState(defaultDay);
  const [label, setLabel] = useState('');
  const [proof, setProof] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);
  useOnOpen(!!mode, () => {
    const r = mode && mode.kind !== 'new' ? mode.row : null;
    if (mode?.kind === 'correct' && r) {
      // a correction of an automatic row: the inverse direction, the same amount and method, linked to the row
      setType(r.type === 'income' ? 'expense' : 'income');
      setCategory('correction');
      setLabel(t('cash.manual.correctionOf', { label: r.description ?? r.reference?.label ?? '' }));
    } else {
      setType(r?.type ?? 'expense');
      setCategory(r?.category ?? 'shipping');
      setLabel(r?.description ?? '');
    }
    setAmount(r ? moneyDigits(r.amount) : '');
    setMethod(r?.method ?? 'cash');
    setDay(mode?.kind === 'edit' && r ? algiersDay(r.date) : defaultDay);
    setProof(null);
    setTouched(false);
  });
  const categories: readonly CashCategory[] = category === 'correction' ? ['correction'] : type === 'income' ? CASH_MANUAL_IN : CASH_MANUAL_OUT;
  const value = digitsToInt(amount);
  const errs = { amount: !value ? t('validation.required') : undefined, label: label.trim().length < 2 ? t('validation.required') : undefined };
  const body = {
    type,
    amount: value ?? 0,
    category,
    method,
    description: label.trim(),
    date: dateIso(day, mode?.kind === 'edit' ? row?.date : undefined),
    proofUploadId: proof?.id ?? undefined,
  };
  const s = useDialogSubmit((key) =>
    mode?.kind === 'edit' && row
      ? gdsApi.updateCash(row.id, { type: body.type, amount: body.amount, category: body.category === 'correction' ? undefined : (body.category as never), method, description: body.description, date: body.date, proofUploadId: body.proofUploadId })
      : gdsApi.createCash({ ...body, correctsTransactionId: mode?.kind === 'correct' && row ? row.id : null }, key),
  );
  const submit = async () => {
    setTouched(true);
    if (errs.amount || errs.label) return;
    const r = await s.submit();
    if (!r) return;
    toast(t(mode?.kind === 'edit' ? 'cash.manual.saved' : 'cash.manual.created', { amount: formatMoney(r.amount) }));
    await refresh();
    onClose();
  };
  const upload = async (file: File) => {
    setUploading(true);
    s.setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'cash_proof');
      const r = await uploadWithProgress<{ id: string }>('/uploads', fd);
      setProof({ id: r.data.id, name: file.name });
    } catch (e) {
      s.setError(e instanceof ApiError ? `${e.message || t('error.INTERNAL')} (${e.code})` : t('error.INTERNAL'));
    } finally {
      setUploading(false);
    }
  };
  const closedError = s.error?.includes('CASH_DAY_CLOSED');
  return (
    <Dialog
      open={!!mode}
      onOpenChange={(o) => !o && !s.busy && onClose()}
      title={mode?.kind === 'edit' ? t('cash.manual.editTitle') : mode?.kind === 'correct' ? t('cash.manual.correctTitle') : t('cash.manual.title')}
      closeLabel={t('action.close')}
      size="md"
      footer={<DialogFooter onClose={onClose} busy={s.busy || uploading} onSubmit={() => void submit()} label={t('action.save')} note={t('cash.manual.closedNote')} />}
    >
      <div className="flex flex-col gap-4" data-testid="cash-manual-dialog">
        {category !== 'correction' ? (
          <RadioList<CashType>
            label={t('cash.manual.direction')}
            value={type}
            onChange={(v) => {
              setType(v);
              setCategory(v === 'income' ? 'deposit' : 'shipping');
            }}
            options={[
              { value: 'income', label: t('cash.manual.in') },
              { value: 'expense', label: t('cash.manual.out') },
            ]}
          />
        ) : (
          <p className="text-[13px] text-text-secondary">{t(type === 'income' ? 'cash.manual.correctionIn' : 'cash.manual.correctionOut')}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('gds.amount')} htmlFor="cm-amount" required error={touched ? errs.amount : s.fieldError('amount')}>
            <MoneyInput id="cm-amount" value={amount} onValueChange={setAmount} />
          </Field>
          <Field label={t('gds.method')} htmlFor="cm-method">
            <Select id="cm-method" value={method} onChange={(e) => setMethod(e.target.value as CashMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`orders.payment.method.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('cash.col.type')} htmlFor="cm-category" error={s.fieldError('category')}>
            <Select id="cm-category" value={category} onChange={(e) => setCategory(e.target.value as CashCategory)} disabled={category === 'correction'}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(`enum.Cash.category.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.date')} htmlFor="cm-date" error={s.fieldError('date')}>
            <Input id="cm-date" type="date" value={day} max={algiersDay()} onChange={(e) => setDay(e.target.value || defaultDay)} className="[color-scheme:dark]" />
          </Field>
        </div>
        <Field label={t('cash.manual.label')} htmlFor="cm-label" required error={touched ? errs.label : s.fieldError('description')}>
          <Input id="cm-label" value={label} maxLength={500} onChange={(e) => setLabel(e.target.value)} placeholder={t('cash.manual.labelPlaceholder')} />
        </Field>
        <Field label={t('cash.manual.proof')} htmlFor="cm-proof" hint={proof ? proof.name : t('cash.manual.proofHint')}>
          <Input id="cm-proof" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </Field>
        {s.error ? <FormAlert>{closedError ? `${t('error.CASH_DAY_CLOSED', { date: day })} (CASH_DAY_CLOSED)` : s.error}</FormAlert> : null}
      </div>
    </Dialog>
  );
}

/* ---------- Clôturer la journée ---------- */
export function CloseDayDialog({ day, theoretical, onClose }: { day: string | null; theoretical: number; onClose: () => void }) {
  const t = useT();
  const refresh = useGdsRefresh();
  const label = useDayLabel();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useOnOpen(!!day, () => {
    setCounted('');
    setNote('');
    setTouched(false);
  });
  const gap = closingGap(theoretical, counted);
  const noteMissing = gap !== null && gap !== 0 && note.trim().length < 2;
  const s = useDialogSubmit((key) => gdsApi.closeCash({ day: day!, countedBalance: digitsToInt(counted) ?? 0, note: note.trim() || null }, key));
  const submit = async () => {
    setTouched(true);
    if (gap === null || noteMissing) return;
    const r = await s.submit();
    if (!r) return;
    toast(t('cash.close.done', { day: label(r.day) }));
    await refresh();
    onClose();
  };
  return (
    <Dialog
      open={!!day}
      onOpenChange={(o) => !o && !s.busy && onClose()}
      title={day ? t('cash.close.title', { day: label(day) }) : t('cash.close.action')}
      closeLabel={t('action.close')}
      size="md"
      footer={
        <DialogFooter
          onClose={onClose}
          busy={s.busy}
          onSubmit={() => void submit()}
          label={t('cash.close.submit')}
          note={gap ? t('cash.close.noteCorrection', { amount: `${gap > 0 ? '+' : '−'}${formatMoney(Math.abs(gap))}` }) : t('cash.close.noteLock')}
        />
      }
    >
      <div className="flex flex-col gap-4" data-testid="cash-close-dialog">
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span>{t('cash.close.theoretical')}</span>
          <span data-testid="cash-theoretical">
            <Ltr className="font-semibold tabular-nums">{formatMoney(theoretical)}</Ltr>
          </span>
        </div>
        <Field label={t('cash.close.counted')} htmlFor="cc-counted" required error={touched && gap === null ? t('validation.required') : s.fieldError('countedBalance')}>
          <MoneyInput id="cc-counted" value={counted} onValueChange={setCounted} />
        </Field>
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span>{t('cash.close.gap')}</span>
          <span data-testid="cash-gap">
            <Ltr className={`font-semibold tabular-nums ${gap ? (gap < 0 ? 'text-accent-alert' : 'text-accent-money') : ''}`}>{gap === null ? '—' : `${gap > 0 ? '+' : gap < 0 ? '−' : ''}${formatMoney(Math.abs(gap))}`}</Ltr>
          </span>
        </div>
        <Field label={t('cash.close.note')} htmlFor="cc-note" error={touched && noteMissing ? t('validation.required') : s.fieldError('note')}>
          <Input id="cc-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t('cash.close.notePlaceholder')} />
        </Field>
        {s.error ? <FormAlert>{s.error}</FormAlert> : null}
      </div>
    </Dialog>
  );
}

/* ---------- Rouvrir la journée ---------- */
export function ReopenDayDialog({ day, onClose }: { day: string | null; onClose: () => void }) {
  const t = useT();
  const refresh = useGdsRefresh();
  const label = useDayLabel();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useOnOpen(!!day, () => {
    setReason('');
    setTouched(false);
  });
  const s = useDialogSubmit(() => gdsApi.reopenCash(day!, reason.trim()));
  const submit = async () => {
    setTouched(true);
    if (reason.trim().length < 3) return;
    const r = await s.submit();
    if (!r) return;
    toast(t('cash.reopen.done', { day: label(r.day) }));
    await refresh();
    onClose();
  };
  return (
    <Dialog
      open={!!day}
      onOpenChange={(o) => !o && !s.busy && onClose()}
      title={day ? t('cash.reopen.title', { day: label(day) }) : t('cash.reopen.action')}
      description={t('cash.reopen.description')}
      closeLabel={t('action.close')}
      size="md"
      footer={<DialogFooter onClose={onClose} busy={s.busy} onSubmit={() => void submit()} label={t('cash.reopen.action')} />}
    >
      <div className="flex flex-col gap-4" data-testid="cash-reopen-dialog">
        <Field label={t('common.reasonRequired')} htmlFor="cr-reason" error={touched && reason.trim().length < 3 ? t('validation.required') : s.fieldError('reason')}>
          <Input id="cr-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {s.error ? <FormAlert>{s.error}</FormAlert> : null}
      </div>
    </Dialog>
  );
}
