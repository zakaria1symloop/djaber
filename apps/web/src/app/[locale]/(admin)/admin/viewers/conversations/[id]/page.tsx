'use client';
// /admin/viewers/conversations/[id] — Figma "ADM-17 — … read-only viewers": the conversation thread in read-only mode
// (reason first → audit `viewer.open`; PII masked; "Afficher" super admin + reason; no composer, no export).
import { MonoChip } from '@djaber/ui';
import { use } from 'react';
import { AdminPage } from '@/features/admin/admin-page';
import { ConversationViewer } from '@/features/admin/viewers/parts';
import { useT } from '@/lib/i18n';

export default function AdminConversationViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  return (
    <AdminPage permission="admin.workspaces.read" title={t('admin.viewers.thread.pageTitle')} description={t('admin.viewers.description')} badges={<MonoChip tone="danger">{t('admin.viewers.badge')}</MonoChip>}>
      <ConversationViewer id={id} />
    </AdminPage>
  );
}
