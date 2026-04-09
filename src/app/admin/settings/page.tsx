'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { updateAdminProfile } from '@/lib/admin-api';
import { Button } from '@/components/ui';

export default function AdminSettingsPage() {
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
      toast.error('First and last name are required');
      return;
    }
    try {
      setSavingProfile(true);
      await updateAdminProfile({ firstName, lastName });
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      setSavingPassword(true);
      await updateAdminProfile({ currentPassword, password: newPassword });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          Settings
        </h1>
        <p className="text-sm text-zinc-400">Manage your admin profile and security</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Profile section */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">Profile</h2>
          <p className="text-xs text-zinc-500 mb-5">Your name as it appears in the admin panel</p>

          <div className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2.5 bg-black/40 border border-white/5 rounded-lg text-zinc-500 text-sm cursor-not-allowed"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
                />
              </Field>
              <Field label="Last name">
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
              {savingProfile ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </section>

        {/* Password section */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">Change password</h2>
          <p className="text-xs text-zinc-500 mb-5">
            Choose a strong password — at least 8 characters
          </p>

          <div className="space-y-4">
            <Field label="Current password">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
              />
            </Field>
            <Field label="Confirm new password">
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
              {savingPassword ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </section>

        {/* Info card */}
        <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-400/80">
            💡 <span className="text-blue-300 font-medium">Note:</span> System-wide settings (signup gating, default plan,
            email templates, branding) will land here as the platform grows.
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
