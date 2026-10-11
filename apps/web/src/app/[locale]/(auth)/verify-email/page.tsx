'use client';
// /verify-email?token= — Figma "AUTH — Verify e-mail — done + reminder": vérification… · confirmée ✓ · expiré (Renvoyer, 60 s).
import { Button, buttonClass, FormAlert, Spinner } from '@djaber/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { RESEND_COOLDOWN_S } from '@/components/auth/forgot-form';
import { authApi } from '@/features/auth/api';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { formatClock, retryAfterSeconds, useCooldown } from '@/lib/countdown';
import { errorMessage } from '@/lib/forms';
import { useT } from '@/lib/i18n';
import { meKey, useSession } from '@/lib/session';

export default function VerifyEmailPage() {
  const t = useT();
  const qc = useQueryClient();
  const token = useSearchParams().get('token') ?? '';
  const { status, me } = useSession();
  // the link is single use: verify once per token (not retried, not re-run on remount within the session)
  const verify = useQuery({
    queryKey: ['session', 'verify-email', token],
    queryFn: async () => {
      const res = await authApi.verifyEmail(token);
      void qc.invalidateQueries({ queryKey: meKey });
      return res;
    },
    enabled: !!token && status !== 'loading',
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const [cooldown, startCooldown] = useCooldown();
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const resend = useMutation({ mutationFn: authApi.resendVerification });

  const onResend = async () => {
    setResendError(null);
    try {
      await resend.mutateAsync();
      setResent(true);
      startCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      const wait = retryAfterSeconds(e, RESEND_COOLDOWN_S);
      if (wait > 0) return startCooldown(wait);
      setResendError(e instanceof ApiError && e.code === 'MAIL_NOT_CONFIGURED' ? t('auth.forgot.mailUnavailable') : errorMessage(e, t));
    }
  };

  if (token && (verify.isPending || status === 'loading')) {
    return (
      <AuthCard title={t('auth.verify.checking.title')}>
        <Spinner label={t('common.verifying')} />
      </AuthCard>
    );
  }

  if (verify.isSuccess) {
    const email = verify.data.email || me?.email || '';
    return (
      <AuthCard
        badge={{ label: t('auth.verify.done.badge'), tone: 'success' }}
        title={t('auth.verify.done.title')}
        description={email ? t('auth.verify.done.description', { email }) : t('auth.verify.done.descriptionNoEmail')}
      >
        <Link href={status === 'authenticated' ? '/home' : '/login'} className={buttonClass({ variant: 'primary', className: 'w-full' })}>
          {status === 'authenticated' ? t('auth.verify.done.continue') : t('action.login')}
        </Link>
      </AuthCard>
    );
  }

  // expired (410) · invalid / missing token · any other failure
  const expired = verify.error instanceof ApiError && verify.error.code === 'AUTH_VERIFY_TOKEN_EXPIRED';
  const alreadyVerified = !!me?.emailVerifiedAt;
  return (
    <AuthCard
      title={expired ? t('auth.verify.expired.title') : t('auth.verify.invalid.title')}
      description={expired ? t('auth.verify.expired.description') : t('auth.verify.invalid.description')}
      footer={status === 'authenticated' ? <AuthLink href="/home">{t('action.backHome')}</AuthLink> : <AuthLink href="/login">{t('auth.backToLogin')}</AuthLink>}
    >
      <div className="flex flex-col gap-4">
        {verify.error && !expired && !(verify.error instanceof ApiError && verify.error.status < 500) ? <FormAlert>{errorMessage(verify.error, t)}</FormAlert> : null}
        {alreadyVerified ? <FormAlert tone="success">{t('auth.verify.alreadyVerified')}</FormAlert> : null}
        {resent ? <FormAlert tone="success">{t('auth.verify.resent', { email: me?.email ?? '' })}</FormAlert> : null}
        {resendError ? <FormAlert>{resendError}</FormAlert> : null}
        {status === 'authenticated' && !alreadyVerified ? (
          <Button variant="primary" className="w-full" loading={resend.isPending} disabled={cooldown > 0} onClick={onResend}>
            {cooldown > 0 ? t('action.resendIn', { time: formatClock(cooldown) }) : t('auth.verify.resend')}
          </Button>
        ) : status !== 'authenticated' ? (
          // the resend endpoint needs a session: sign in, then use the banner of the Home page
          <p className="ts-label-meta text-text-muted">{t('auth.verify.loginToResend')}</p>
        ) : null}
      </div>
    </AuthCard>
  );
}
