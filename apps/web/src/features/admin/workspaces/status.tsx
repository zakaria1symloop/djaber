'use client';
// ADM-02 status pill (12 §26): SUSPENDU / SUPPRESSION J+30 (Workspace.status, admin action) win over the subscription
// state ESSAI / ACTIF / RELANCE / EXPIRÉ (limites du plan gratuit) / RÉSILIÉ.
import type { AdminWorkspaceRowDto } from '@djaber/shared';
import { useT } from '@/lib/i18n';
import { AdminPill } from '../ui';

export const workspacePill = (ws: Pick<AdminWorkspaceRowDto, 'status' | 'subscriptionStatus'>): { group: string; value: string; key: string } =>
  ws.status !== 'active'
    ? { group: 'Workspace.status', value: ws.status, key: `enum.Workspace.status.${ws.status}` }
    : { group: 'Subscription.status', value: ws.subscriptionStatus, key: `enum.Subscription.status.${ws.subscriptionStatus}` };

export function WorkspaceStatusPill({ ws }: { ws: Pick<AdminWorkspaceRowDto, 'status' | 'subscriptionStatus'> }) {
  const t = useT();
  const p = workspacePill(ws);
  return (
    <AdminPill group={p.group} value={p.value}>
      {t(p.key)}
    </AdminPill>
  );
}
