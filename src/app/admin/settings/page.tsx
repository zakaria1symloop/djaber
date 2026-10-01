'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { updateAdminProfile } from '@/lib/admin-api';
import { Button } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error(t('adm.plat.settings.nameRequired'));
      return;
    }
    try {
      setSavingProfile(true);
      await updateAdminProfile({ firstName, lastName });
      toast.success(t('adm.plat.settings.profileUpdated'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.plat.settings.updateFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error(t('adm.plat.settings.currentPwRequired'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('adm.plat.settings.pwTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('adm.plat.settings.pwMismatch'));
      return;
    }
    try {
      setSavingPassword(true);
      await updateAdminProfile({ currentPassword, password: newPassword });
      toast.success(t('adm.plat.settings.pwUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.plat.settings.pwUpdateFailed'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          {t('adm.plat.settings.title')}
        </h1>
        <p className="text-sm text-zinc-400">{t('adm.plat.settings.subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Profile section */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">{t('adm.plat.settings.profile')}</h2>
          <p className="text-xs text-zinc-500 mb-5">{t('adm.plat.settings.profileHint')}</p>

          <div className="space-y-4">
            <Field label={t('adm.plat.settings.email')}>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2.5 bg-black/40 border border-white/5 rounded-lg text-zinc-500 text-sm cursor-not-allowed"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('adm.plat.settings.firstName')}>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
                />
              </Field>
              <Field label={t('adm.plat.settings.lastName')}>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? t('adm.plat.saving') : t('adm.plat.settings.saveProfile')}
            </Button>
          </div>
        </section>

        {/* Password section */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">{t('adm.plat.settings.changePassword')}</h2>
          <p className="text-xs text-zinc-500 mb-5">
            {t('adm.plat.settings.passwordHint')}
          </p>

          <div className="space-y-4">
            <Field label={t('adm.plat.settings.currentPassword')}>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
            <Field label={t('adm.plat.settings.newPassword')}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('adm.plat.settings.newPasswordPh')}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
              />
            </Field>
            <Field label={t('adm.plat.settings.confirmPassword')}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? t('adm.plat.settings.updating') : t('adm.plat.settings.updatePassword')}
            </Button>
          </div>
        </section>

        {/* Info card */}
        <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-400/80">
            💡 <span className="text-blue-300 font-medium">{t('adm.plat.settings.noteLabel')}</span>{' '}
            {t('adm.plat.settings.noteBody')}
          </p>
        </section>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}
