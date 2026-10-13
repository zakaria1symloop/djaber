'use client';
// /admin/workspaces/[id] — deep link of the ADM-02 detail sheet: opens the list with `?sheet=<id>` (02 §3.5).
import { use, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

export default function AdminWorkspaceDeepLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/workspaces?sheet=${encodeURIComponent(id)}`);
  }, [id, router]);
  return null;
}
