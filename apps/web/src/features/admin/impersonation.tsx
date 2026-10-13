'use client';
// D21-bis read-only impersonation, merchant side: the fixed red bar "Vous agissez en tant que {workspace} · lecture seule
// · {mm} min · Quitter", the expired state (`ADMIN_IMPERSONATION_EXPIRED`, back to admin) and the
// `ADMIN_IMPERSONATION_FORBIDDEN_ACTION` toast for any write attempted under the session. Admin side: start / stop.
import { Button, ImpersonationBar, SessionExpiredState, SystemPage, toast } from '@djaber/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { impersonation, minutesLeft, useImpersonation } from '@/lib/impersonation';
import { useT } from '@/lib/i18n';

/** Ends the session on the server with the admin's own token, then goes back to the workspace sheet in the admin. */
export function useStopImpersonation() {
  const router = useRouter();
  const qc = useQueryClient();
  return async () => {
    const s = impersonation.get();
    impersonation.clear();
    if (s) {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === s.workspaceId });
      try {
        await api(`/admin/impersonation/sessions/${s.sessionId}`, { method: 'DELETE', asAdmin: true });
      } catch {
        // an expired or already ended session needs no stop
      }
      router.replace(`/admin/workspaces?sheet=${s.workspaceId}`);
    } else router.replace('/admin/workspaces');
  };
}

export function ImpersonationBanner() {
  const t = useT();
  const { session } = useImpersonation();
  const stop = useStopImpersonation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const left = session ? minutesLeft(session.expiresAt, now) : 0;
  useEffect(() => {
    if (session && left === 0) impersonation.markExpired();
  }, [session, left]);
  useEffect(
    () =>
      impersonation.on((e) => {
        if (e === 'forbidden') toast({ tone: 'danger', message: t('error.ADMIN_IMPERSONATION_FORBIDDEN_ACTION') });
      }),
    [t],
  );
  if (!session) return null;
  return (
    <ImpersonationBar
      action={
        <Button size="sm" onClick={() => void stop()} data-testid="impersonation-quit">
          {t('admin.impersonation.quit')}
        </Button>
      }
    >
      {t('admin.impersonation.bar', { workspace: session.workspaceName, minutes: left })}
    </ImpersonationBar>
  );
}

export function ImpersonationExpired() {
  const t = useT();
  const stop = useStopImpersonation();
  return (
    <SystemPage>
      <SessionExpiredState title={t('admin.impersonation.expired.title')} description={t('error.ADMIN_IMPERSONATION_EXPIRED')} action={{ label: t('admin.impersonation.expired.back'), onClick: () => void stop() }} />
    </SystemPage>
  );
}
