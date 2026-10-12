'use client';
// "Signaler ce vendeur" from the public tracking page (Figma "SAFE — Trust & safety (merchant)" report dialog, D37):
// `POST /track/:publicToken/report { reason, details?, email? }` (no session; 3 / h / IP ⇒ 429 shown inline).
import { Dialog, Field, FormAlert, Input, Textarea } from '@djaber/ui';
import { useState } from 'react';
import { DialogFooter, RadioList, refusal, useOnOpen } from '@/features/orders/dialogs/common';
import { useT } from '@/lib/i18n';
import { deliveryApi } from '../api';
import { REPORT_REASONS, type TrackingReportInput } from '../contracts';

type Reason = TrackingReportInput['reason'];

export function ReportMerchantDialog({ code, open, onClose, onSent }: { code: string; open: boolean; onClose: () => void; onSent: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useOnOpen(open, () => {
    setReason(null);
    setDetails('');
    setEmail('');
    setTouched(false);
    setError(null);
  });
  const emailBad = !!email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const submit = async () => {
    setTouched(true);
    if (!reason || emailBad) return;
    setBusy(true);
    setError(null);
    try {
      await deliveryApi.reportMerchant(code, { reason, details: details.trim() || null, email: email.trim() || null });
      onSent();
    } catch (e) {
      setError(refusal(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t('tracking.report.title')}
      description={t('tracking.report.description')}
      closeLabel={t('action.close')}
      size="md"
      footer={<DialogFooter onClose={onClose} busy={busy} onSubmit={() => void submit()} label={t('tracking.report.submit')} note={t('tracking.report.note')} />}
    >
      <div className="flex flex-col gap-4" data-testid="report-dialog">
        <Field label={t('tracking.report.reason')} error={touched && !reason ? t('validation.required') : undefined}>
          <RadioList<Reason> label={t('tracking.report.reason')} value={reason} onChange={setReason} options={REPORT_REASONS.map((r) => ({ value: r, label: t(`tracking.report.reason.${r}`) }))} />
        </Field>
        <Field label={t('tracking.report.details')} htmlFor="rep-details">
          <Textarea id="rep-details" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} className="min-h-20" />
        </Field>
        <Field label={t('tracking.report.email')} htmlFor="rep-email" error={touched && emailBad ? t('validation.email') : undefined}>
          <Input id="rep-email" type="email" dir="ltr" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error ? <FormAlert>{error}</FormAlert> : null}
      </div>
    </Dialog>
  );
}
