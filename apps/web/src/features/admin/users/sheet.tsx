'use client';
// ADM-17 "Utilisateur — {name} (fiche admin)" in the ADM-03 sheet (`?sheet=<id>`): IDENTITÉ · ESPACES (Membership) ·
// SESSIONS & APPAREILS · ACTIVITÉ & AUDIT + the same `Actions ⌄` as the row. PII as the API returns it (masked).
import type { AdminUserDetailDto } from '@djaber/shared';
import { ActionsMenu, Button, InfoBlock, ListSkeleton, SideSheet, type MenuAction } from '@djaber/ui';
import { useT } from '@/lib/i18n';
import { AdminQueryError } from '../admin-page';
import { useAdminGet } from '../api';
import { usePlatform } from '../platform';
import { fullName, useFormats } from '../ui';
import type { UserAction } from './actions';

export function UserSheet({ id, onClose, menu, onAction }: { id: string | null; onClose: () => void; menu: (u: AdminUserDetailDto) => MenuAction[]; onAction: (a: UserAction, u: AdminUserDetailDto) => void }) {
  const t = useT();
  const f = useFormats();
  const { can } = usePlatform();
  const q = useAdminGet<AdminUserDetailDto>(id ? `/admin/users/${id}` : null);
  const u = q.data;
  const owned = u?.ownedWorkspaceId ? (u.workspaces.find((w) => w.id === u.ownedWorkspaceId)?.name ?? '—') : t('admin.users.detail.ownsNone');
  return (
    <SideSheet
      open={!!id}
      onClose={onClose}
      width={460}
      title={u ? t('admin.users.detail.title', { name: fullName(u) }) : q.isError ? t('state.detail.notFound.title') : t('common.loading')}
      closeLabel={t('action.close')}
      headerAction={u ? <ActionsMenu label={t('action.actions')} actions={menu(u)} heading={`${fullName(u)} · ${t('admin.users.workspacesCount', { count: u.workspaces.length })}`} /> : undefined}
    >
      {q.isPending ? (
        <ListSkeleton rows={6} columns={2} label={t('common.loading')} />
      ) : q.isError || !u ? (
        <AdminQueryError error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="user-sheet">
          <InfoBlock
            label={t('admin.users.detail.identity')}
            lines={[
              <span key="e" dir="ltr">{`${u.email} ${u.emailVerified ? `✓ ${t('admin.ws.verified')}` : `✗ ${t('enum.Admin.unverified')}`}`}</span>,
              <span key="p" dir="ltr">{u.phone ?? '—'}</span>,
              `${u.locale.toUpperCase()} · Africa/Algiers`,
              t('admin.users.detail.created', { date: f.date(u.createdAt) }),
              `2FA : ${u.totpEnabled ? t('admin.common.yes').toLowerCase() : `${t('admin.common.no').toLowerCase()} ⚠`}`,
              ...(u.blockedAt ? [t('admin.users.detail.blocked', { date: f.date(u.blockedAt), reason: u.blockReason ?? '—' })] : []),
            ]}
          />
          <InfoBlock
            label={t('admin.users.detail.workspaces')}
            lines={[...(u.workspaces.length ? u.workspaces.map((w) => `${w.name} · ${t(`enum.Membership.role.${w.role}`)}`) : ['—']), t('admin.users.detail.owner', { name: owned })]}
          />
          <InfoBlock
            label={t('admin.users.detail.sessions')}
            lines={[
              ...u.devices.map((d) => [d.deviceName ?? d.platform, d.appVersion, f.ago(d.lastSeenAt)].filter(Boolean).join(' · ')),
              ...u.sessions.map((s) => [s.device ?? s.platform ?? 'web', s.ip, f.ago(s.lastUsedAt)].filter(Boolean).join(' · ')),
              ...(u.devices.length + u.sessions.length === 0 ? ['—'] : []),
            ]}
            action={
              can('admin.users.write') && u.actions.some((a) => a.key === 'revoke_sessions' && a.enabled) ? (
                <Button size="sm" variant="ghost" onClick={() => onAction('revoke_sessions', u)}>
                  {t('admin.users.detail.revokeAll')}
                </Button>
              ) : undefined
            }
          />
          <InfoBlock
            label={t('admin.users.detail.activity')}
            lines={[
              u.activity.lastAction ? t('admin.users.detail.lastAction', { action: u.activity.lastAction.action, date: f.short(u.activity.lastAction.at) }) : t('admin.users.detail.noAction'),
              t('admin.users.detail.tickets', { tickets: u.activity.tickets, reports: u.activity.reports }),
              u.deletion ? t('admin.users.detail.deletion', { status: t(`admin.deletion.status.${u.deletion.status}`), date: f.short(u.deletion.scheduledAt) }) : t('admin.users.detail.noDeletion'),
            ]}
          />
        </div>
      )}
    </SideSheet>
  );
}
