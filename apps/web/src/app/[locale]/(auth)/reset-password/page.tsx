'use client';
// /reset-password?token= — Figma "AUTH — Reset password — expired" + States catalogue (Réinitialiser):
// validation… · invalide · expiré (resend) · formulaire (weak, mismatch) · terminé (auto-login → Home).
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordStrength, ResetPasswordSchema, type ResetPasswordInput } from '@djaber/shared';
import { Button, Field, FormAlert, PasswordInput, Spinner, StrengthBar } from '@djaber/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { ForgotForm } from '@/components/auth/forgot-form';
import { authApi } from '@/features/auth/api';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { isMfaChallenge } from '@/lib/contracts';
import { applyServerErrors, errorMessage, fieldError } from '@/lib/forms';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

export default function ResetPasswordPage() {
  const t = useT();
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const { signIn } = useSession();
  const check = useQuery({ queryKey: ['session', 'reset-token', token], queryFn: () => authApi.checkResetToken(token), enabled: !!token, retry: false, staleTime: Infinity });
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(ResetPasswordSchema), defaultValues: { password: '', confirm: '' } });
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dead, setDead] = useState<'expired' | 'invalid' | null>(null);
  const reset = useMutation({ mutationFn: authApi.resetPassword });

  const tokenState = (e: unknown): 'expired' | 'invalid' | null =>
    e instanceof ApiError ? (e.code === 'AUTH_RESET_TOKEN_EXPIRED' ? 'expired' : e.code === 'AUTH_RESET_TOKEN_INVALID' || e.status === 404 ? 'invalid' : null) : null;
  const state = dead ?? (!token ? 'invalid' : tokenState(check.error));

  if (state) {
    // one card for both: an expired or already used link asks for a new one (valid 60 minutes)
    return (
      <AuthCard
        title={state === 'expired' ? t('auth.reset.expired.title') : t('auth.reset.invalid.title')}
        description={t('auth.reset.expired.description')}
        footer={<AuthLink href="/login">{t('auth.backToLogin')}</AuthLink>}
      >
        <ForgotForm submitLabel={t('auth.reset.expired.submit')} />
      </AuthCard>
    );
  }
  if (check.isPending) {
    return (
      <AuthCard title={t('auth.reset.title')}>
        <Spinner label={t('auth.reset.validating')} />
      </AuthCard>
    );
  }
  if (check.isError) {
    return (
      <AuthCard title={t('auth.reset.title')} footer={<AuthLink href="/login">{t('auth.backToLogin')}</AuthLink>}>
        <div className="flex flex-col gap-4">
          <FormAlert>{errorMessage(check.error, t)}</FormAlert>
          <Button onClick={() => check.refetch()}>{t('action.retry')}</Button>
        </div>
      </AuthCard>
    );
  }

  const submit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      const res = await reset.mutateAsync({ token, password });
      setDone(true);
      // success logs in (other sessions are revoked); an account with 2FA signs in again to enter its code
      if (!isMfaChallenge(res)) {
        signIn(res);
        router.replace('/home');
      } else router.replace('/login');
    } catch (e) {
      const s = tokenState(e);
      if (s) return setDead(s);
      setFormError(applyServerErrors(form, e, t, { fields: ['password'], codeToField: { AUTH_PASSWORD_WEAK: 'password' } }));
    }
  });

  const busy = reset.isPending || done;
  const errors = form.formState.errors;
  const password = form.watch('password');
  return (
    <AuthCard title={t('auth.reset.title')} description={t('auth.reset.description')} footer={<AuthLink href="/login">{t('auth.backToLogin')}</AuthLink>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={busy}>
        <div className="flex flex-col gap-2">
          <Field label={t('auth.reset.newPassword')} htmlFor="password" error={fieldError(t, errors.password?.message)} hint={t('validation.password')}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              disabled={busy}
              aria-invalid={!!errors.password}
              showLabel={t('auth.password.show')}
              hideLabel={t('auth.password.hide')}
              {...form.register('password')}
            />
          </Field>
          <StrengthBar score={passwordStrength(password)} label={t('auth.password.strength')} />
        </div>
        <Field label={t('auth.reset.confirm')} htmlFor="confirm" error={fieldError(t, errors.confirm?.message)}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            disabled={busy}
            aria-invalid={!!errors.confirm}
            showLabel={t('auth.password.show')}
            hideLabel={t('auth.password.hide')}
            {...form.register('confirm')}
          />
        </Field>
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        {done ? <FormAlert tone="success">{t('auth.reset.done')}</FormAlert> : null}
        <Button type="submit" variant="primary" loading={reset.isPending} disabled={done} className="w-full">
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
