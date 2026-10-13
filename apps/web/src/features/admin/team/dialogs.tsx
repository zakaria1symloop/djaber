'use client';
// ADM-16 dialogs — "DLG — Platform admin — dialogs catalogue": Changer le rôle plateforme (actor TOTP code;
// ADMIN_CANNOT_DEMOTE_SELF, TWO_FA_REQUIRED_FOR_ROLE, TWO_FA_CONFIRMATION_REQUIRED) and Inviter un membre plateforme
// (@djaber.ai only, ADMIN_EMAIL_DOMAIN_INVALID; 2FA mandatory at first login).
import { ADMIN_EMAIL_DOMAIN } from '@djaber/shared';
import { Field, Input, MonoChip, Select, toast } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { adminWrite, useAdminInvalidate } from '../api';
import { AdminDialog, NO_ERRORS, toServerErrors, useOnOpen, type ServerErrors } from '../dialog-kit';

export const ROLE_OPTIONS = ['read', 'support', 'moderator', 'finance', 'super_admin'] as const;
export type RoleOption = (typeof ROLE_OPTIONS)[number] | 'none';

export function ChangeRoleDialog({ user, open, onClose }: { user: { id: string; name: string; platformRole: string } | null; open: boolean; onClose: () => void }) {
  const t = useT();
  const invalidate = useAdminInvalidate();
  const [role, setRole] = useState<RoleOption>('support');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<ServerErrors>(NO_ERRORS);
  const m = useMutation({ mutationFn: (b: unknown) => adminWrite(`/admin/users/${user?.id}/platform-role`, 'POST', b) });
  useOnOpen(open, () => {
    setRole(((user?.platformRole === 'none' ? 'support' : user?.platformRole) as RoleOption) ?? 'support');
    setCode('');
    setErrors(NO_ERRORS);
  });
  if (!user) return null;
  const from = user.platformRole === 'none' ? t('admin.team.role.none') : t(`enum.PlatformRole.${user.platformRole}`);
  const to = role === 'none' ? t('admin.team.role.none') : t(`enum.PlatformRole.${role}`);
  const submit = async () => {
    setErrors(NO_ERRORS);
    try {
      await m.mutateAsync({ platformRole: role, totpCode: code.trim() });
      void invalidate('/admin/users', '/admin/platform-members', '/admin/audit-logs');
      toast(t('admin.team.role.done'));
      onClose();
    } catch (e) {
      setErrors(toServerErrors(e, t, ['platformRole', 'totpCode'], { TWO_FA_CONFIRMATION_REQUIRED: 'totpCode', AUTH_2FA_INVALID: 'totpCode' }));
    }
  };
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      testId="dlg-role"
      size="sm"
      title={t('admin.team.role.title')}
      context={`${user.name} · ${from} → ${to}`}
      submitLabel={t('action.apply')}
      disabled={code.trim().length < 6 || role === user.platformRole}
      pending={m.isPending}
      error={errors.form}
      onSubmit={() => void submit()}
    >
      <div role="radiogroup" aria-label={t('admin.team.role.title')} className="flex flex-col gap-2.5">
        {[...ROLE_OPTIONS, 'none' as const].map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2.5 text-[14px]">
            <input type="radio" name="platformRole" checked={role === r} onChange={() => setRole(r)} className="size-4 accent-white" />
            {r === 'none' ? t('admin.team.role.none') : t(`enum.PlatformRole.${r}`)}
          </label>
        ))}
      </div>
      <Field label={t('admin.team.role.code')} required htmlFor="f-totp" error={errors.fields.totpCode}>
        <Input id="f-totp" inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••• •••" />
      </Field>
      <div className="flex items-start gap-2">
        <MonoChip tone="danger" className="shrink-0">{t('admin.team.role.errorPill')}</MonoChip>
        <span className="ts-label-micro text-text-muted">{t('admin.team.role.selfRule')}</span>
      </div>
      <div className="flex items-start gap-2">
        <MonoChip tone="warning" className="shrink-0">{t('admin.team.role.blockedPill')}</MonoChip>
        <span className="ts-label-micro text-text-muted">{t('admin.team.role.twoFaRule')}</span>
      </div>
    </AdminDialog>
  );
}

export function InviteMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const invalidate = useAdminInvalidate();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>('moderator');
  const [errors, setErrors] = useState<ServerErrors>(NO_ERRORS);
  const m = useMutation({ mutationFn: (b: unknown) => adminWrite('/admin/platform-members/invitations', 'POST', b, true) });
  useOnOpen(open, () => {
    setEmail('');
    setRole('moderator');
    setErrors(NO_ERRORS);
  });
  const submit = async () => {
    setErrors(NO_ERRORS);
    try {
      await m.mutateAsync({ email: email.trim(), platformRole: role });
      void invalidate('/admin/platform-members', '/admin/users');
      toast(t('admin.team.invite.done', { email: email.trim() }));
      onClose();
    } catch (e) {
      setErrors(toServerErrors(e, t, ['email', 'platformRole'], { ADMIN_EMAIL_DOMAIN_INVALID: 'email', CONFLICT: 'email' }));
    }
  };
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      testId="dlg-invite"
      size="sm"
      title={t('admin.team.invite.title')}
      submitLabel={t('admin.team.invite.submit')}
      disabled={!email.trim()}
      pending={m.isPending}
      error={errors.form}
      note={t('admin.team.invite.note')}
      onSubmit={() => void submit()}
    >
      <Field label={t('admin.team.invite.email')} required htmlFor="f-inv-email" hint={t('admin.team.invite.domain', { domain: ADMIN_EMAIL_DOMAIN })} error={errors.fields.email}>
        <Input id="f-inv-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`prenom@${ADMIN_EMAIL_DOMAIN}`} />
      </Field>
      <Field label={t('admin.team.invite.role')} htmlFor="f-inv-role">
        <Select id="f-inv-role" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {t(`enum.PlatformRole.${r}`)}
            </option>
          ))}
        </Select>
      </Field>
    </AdminDialog>
  );
}
