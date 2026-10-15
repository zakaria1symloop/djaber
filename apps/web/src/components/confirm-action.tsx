'use client';
// One confirmation dialog for the one-click actions of a screen ("Supprimer le préréglage ?", "Dépublier ?"…):
// `ask({ title, description, confirmLabel, run })` opens it; the action runs on confirm, the dialog closes after.
import { ConfirmDialog } from '@djaber/ui';
import { useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n';

export type ConfirmRequest = { title: string; description?: string; confirmLabel: string; destructive?: boolean; run: () => Promise<unknown> | void };

export function useConfirmAction(): { ask: (r: ConfirmRequest) => void; element: ReactNode } {
  const t = useT();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const element = (
    <ConfirmDialog
      open={!!req}
      onOpenChange={(o) => !o && !busy && setReq(null)}
      title={req?.title ?? ''}
      description={req?.description}
      confirmLabel={req?.confirmLabel ?? ''}
      cancelLabel={t('action.cancel')}
      closeLabel={t('action.close')}
      destructive={req?.destructive}
      loading={busy}
      onConfirm={() => {
        const r = req;
        if (!r) return;
        setBusy(true);
        void Promise.resolve(r.run()).finally(() => {
          setBusy(false);
          setReq(null);
        });
      }}
    />
  );
  return { ask: setReq, element };
}
