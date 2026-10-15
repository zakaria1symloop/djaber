'use client';
// "Signaler ce vendeur" from the public tracking page (Figma "SAFE — Trust & safety (merchant)" report dialog, D37):
// `POST /track/:publicToken/report { reason, details?, email?, captchaToken }` (no session; 3 / h / IP ⇒ 429 shown
// inline). M11: the captcha of `GET /captcha/config` is required (fake checkbox in dev, Turnstile when configured);
// a refused token (`422 fields.captchaToken = validation.captcha`) is shown under the widget, the form is kept.
import { Dialog, EmailInput, Field, FormAlert, Input, Textarea } from '@djaber/ui';
import { useState } from 'react';
import { CaptchaField, captchaNeeded, useCaptchaConfig } from '@/components/captcha';
import { DialogFooter, RadioList, refusal, useOnOpen } from '@/features/orders/dialogs/common';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { deliveryApi } from '../api';
import { REPORT_REASONS, type TrackingReportInput } from '../contracts';
import { emailError } from '@/lib/email';

type Reason = TrackingReportInput['reason'];

export function ReportMerchantDialog({ code, open, onClose, onSent }: { code: string; open: boolean; onClose: () => void; onSent: () => void }) {
  const t = useT();
  const captcha = useCaptchaConfig();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useOnOpen(open, () => {
    setReason(null);
    setDetails('');
    setEmail('');
    setToken(null);
    setCaptchaError(null);
    setTouched(false);
    setError(null);
  });
  // same rule as the API (shared `email`)
  const emailBad = !!emailError(email);
  const needToken = captchaNeeded(captcha.data);
  const submit = async () => {
    setTouched(true);
    const missingToken = needToken && !token;
    setCaptchaError(missingToken ? t('validation.captcha') : null);
    if (!reason || emailBad || missingToken) return;
    setBusy(true);
    setError(null);
    try {
      await deliveryApi.reportMerchant(code, { reason, details: details.trim() || null, email: email.trim() || null, ...(token ? { captchaToken: token } : {}) });
      onSent();
    } catch (e) {
      const fieldKey = e instanceof ApiError ? e.body.fields?.captchaToken : undefined;
      if (fieldKey) {
        // a used / refused token cannot be sent again: the visitor ticks the box (or solves the widget) once more
        setToken(null);
        setCaptchaError(t(fieldKey));
      } else setError(refusal(e, t));
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
          <EmailInput id="rep-email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <CaptchaField
          token={token}
          onToken={(v) => {
            setToken(v);
            if (v) setCaptchaError(null);
          }}
          error={captchaError ?? undefined}
        />
        {error ? <FormAlert>{error}</FormAlert> : null}
      </div>
    </Dialog>
  );
}
