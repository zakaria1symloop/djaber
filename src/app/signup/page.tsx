'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { t, translateBackendError } from '@/lib/i18n';

export default function SignupPage() {
  const router = useRouter();
  const { register, loading, clearError } = useAuth();
  const toast = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const validate = (): boolean => {
    if (!formData.firstName.trim()) {
      toast.error(t('auth.errors.firstNameRequired'));
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error(t('auth.errors.lastNameRequired'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error(t('auth.errors.invalidEmail'));
      return false;
    }
    if (formData.password.length < 8) {
      toast.error(t('auth.errors.passwordTooShort'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;

    try {
      const newUser = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        plan: 'individual',
      });
      toast.success(t('auth.success.signedUp'));
      router.push(newUser.isAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      toast.error(translateBackendError(message));
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl" />
      </div>

      {/* Back link */}
      <Link
        href="/"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-zinc-400 hover:text-white transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t('common.back')}
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="logo-glow">
            <svg width="44" height="44" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="url(#signupLogoGradient)" strokeWidth="1.5" fill="none" />
              <circle cx="20" cy="12" r="3" fill="white" />
              <circle cx="12" cy="24" r="3" fill="white" />
              <circle cx="28" cy="24" r="3" fill="white" />
              <line x1="20" y1="15" x2="14" y2="22" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <line x1="20" y1="15" x2="26" y2="22" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <defs>
                <linearGradient id="signupLogoGradient" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="white" />
                  <stop offset="100%" stopColor="#a1a1aa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl sm:text-3xl font-bold text-white mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {t('auth.signup.title')}
          </h1>
          <p className="text-sm text-zinc-400">{t('auth.signup.subtitle')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  {t('auth.signup.firstName')}
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:border-white/40 focus:outline-none transition-colors text-sm"
                  placeholder="Jane"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  {t('auth.signup.lastName')}
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:border-white/40 focus:outline-none transition-colors text-sm"
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                {t('auth.signup.email')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:border-white/40 focus:outline-none transition-colors text-sm"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                {t('auth.signup.password')}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:border-white/40 focus:outline-none transition-colors text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <p className="text-[11px] text-zinc-600 mt-1.5">{t('auth.signup.passwordHint')}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-6 py-2.5 bg-white text-black rounded-lg font-semibold text-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('auth.signup.submitting') : t('auth.signup.submit')}
            </button>
          </form>
        </div>

        {/* Sign in link */}
        <p className="text-center text-xs text-zinc-500 mt-5">
          {t('auth.signup.haveAccount')}{' '}
          <Link href="/login" className="text-white hover:underline font-medium">
            {t('auth.signup.signin')}
          </Link>
        </p>
      </div>
    </main>
  );
}
