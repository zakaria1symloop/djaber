'use client';
// Forgot-password form: default · envoyé (always the same answer) · cooldown 60 s · mail indisponible.
import { zodResolver } from '@hookform/resolvers/zod';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@djaber/shared';
import { Button, Field, FormAlert, Input } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { authApi } from '@/features/auth/api';
import { ApiError } from '@/lib/api';
import { formatClock, retryAfterSeconds, useCooldown } from '@/lib/countdown';
import { errorMessage, fieldError } from '@/lib/forms';
import { useT } from '@/lib/i18n';

export const RESEND_COOLDOWN_S = 60;

/** Shared with the "Lien expiré" state of /reset-password ("Recevoir un nouveau lien"). */
export function ForgotForm({ submitLabel }: { submitLabel: string }) {
  const t = useT();
  const prefill = useSearchParams().get('email') ?? '';
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(ForgotPasswordSchema), defaultValues: { email: prefill } });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, startCooldown] = useCooldown();
  const send = useMutation({ mutationFn: authApi.forgotPassword });

  const submit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await send.mutateAsync(email);
      // always the same answer, whether the account exists or not
      setSent(true);
      startCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      const wait = retryAfterSeconds(e, RESEND_COOLDOWN_S);
      if (wait > 0) {
        setSent(true);
        return startCooldown(wait);
      }
      setSent(false);
      setError(e instanceof ApiError && e.code === 'MAIL_NOT_CONFIGURED' ? t('auth.forgot.mailUnavailable') : errorMessage(e, t));
    }
  });

  const busy = send.isPending;
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={busy}>
      <Field label={t('common.email')} htmlFor="email" error={fieldError(t, errors.email?.message)}>
        <Input id="email" type="email" dir="ltr" autoComplete="email" placeholder={t('auth.placeholder.email')} disabled={busy} aria-invalid={!!errors.email} {...form.register('email')} />
      </Field>
      {sent ? <FormAlert tone="success">{t('auth.forgot.sent')}</FormAlert> : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="submit" variant="primary" loading={busy} disabled={cooldown > 0} className="w-full">
        {busy ? t('common.sending') : cooldown > 0 ? t('action.resendIn', { time: formatClock(cooldown) }) : submitLabel}
      </Button>
    </form>
  );
}
