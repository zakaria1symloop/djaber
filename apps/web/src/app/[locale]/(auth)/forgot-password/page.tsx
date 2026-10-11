'use client';
// /forgot-password — Figma "AUTH — States catalogue" (Mot de passe oublié): default · envoyé (always) · cooldown · mail indisponible.
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { ForgotForm } from '@/components/auth/forgot-form';
import { useT } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const t = useT();
  return (
    <AuthCard title={t('auth.forgot.title')} description={t('auth.forgot.description')} footer={<AuthLink href="/login">{t('auth.backToLogin')}</AuthLink>}>
      <ForgotForm submitLabel={t('auth.forgot.submit')} />
    </AuthCard>
  );
}
