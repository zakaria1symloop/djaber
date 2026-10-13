'use client';
// Maintenance (03 PFS-03, 02-next-route-map §1 layout hooks, 11 §12.1 `MAINTENANCE_MODE` "banner + disabled actions"):
// - banner id `maintenance` (top of the priority list) while `GET /status` reports a scheduled or active window, or right
//   after a write was refused with `503 MAINTENANCE_MODE {until}`;
// - a refused READ (window with scope `all`) ⇒ full-page "Maintenance en cours", retried automatically every 60 s.
// Mounted by the merchant shell; `useMaintenanceBanner()` is also read by the admin shell (web-a).
import { formatDateTime, type AppLocale } from '@djaber/shared';
import { MaintenanceState, SystemPage } from '@djaber/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ShellBanner } from '@/components/shell/banner-stack';
import { apiSession, getMaintenanceUntil } from '@/lib/api';
import { useLocaleCode, useT } from '@/lib/i18n';
import { statusKey, useStatus } from './api';
import { maintenanceWindow } from './logic';

export const MAINTENANCE_RETRY_MS = 60_000;

type Refusal = { until: string | null; at: number };

/** Set by a 503 on a write (`refused`) or on a read (`blocked`); a refusal is forgotten once a newer status says no window. */
function useMaintenanceSignals() {
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(
    () =>
      apiSession.on((e) => {
        if (e === 'maintenance') setRefused({ until: getMaintenanceUntil(), at: Date.now() });
        if (e === 'maintenance-read') {
          setRefused({ until: getMaintenanceUntil(), at: Date.now() });
          setBlocked(true);
        }
      }),
    [],
  );
  return { refused, blocked, setBlocked, setRefused };
}

export function useMaintenanceBanner(): ShellBanner | null {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const status = useStatus();
  const { refused, setRefused } = useMaintenanceSignals();
  const w = maintenanceWindow(status.data);
  // a status fetched after the refusal says the window is over ⇒ forget the refusal
  useEffect(() => {
    if (refused && status.data && status.dataUpdatedAt > refused.at && !w) setRefused(null);
  }, [status.data, status.dataUpdatedAt, w, refused, setRefused]);
  const at = (iso: string | null) => (iso ? formatDateTime(iso, locale) : '—');
  if (w && !w.active && !refused) {
    return { id: 'maintenance', tone: 'info', content: <span data-testid="maintenance-banner" data-state="scheduled">{w.text ?? t('maintenance.banner.scheduled', { from: at(w.from), to: at(w.to) })}</span> };
  }
  if (w?.active || refused) {
    const until = w?.to ?? refused?.until ?? null;
    return {
      id: 'maintenance',
      tone: 'info',
      content: <span data-testid="maintenance-banner" data-state="active">{w?.text ?? t('error.MAINTENANCE_MODE', { until: at(until) })}</span>,
    };
  }
  return null;
}

/**
 * Full-page state when the API refuses reads (`503 MAINTENANCE_MODE` on a GET). Retries every 60 s: every active query is
 * refetched; a success clears the page, a new refusal keeps it.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const qc = useQueryClient();
  const { blocked, setBlocked } = useMaintenanceSignals();
  const [until, setUntil] = useState<string | null>(null);
  useEffect(() => {
    if (!blocked) return;
    setUntil(getMaintenanceUntil());
    const id = window.setInterval(() => {
      setBlocked(false);
      void qc.invalidateQueries({ queryKey: statusKey });
      void qc.refetchQueries({ type: 'active' });
    }, MAINTENANCE_RETRY_MS);
    return () => window.clearInterval(id);
  }, [blocked, qc, setBlocked]);
  if (!blocked) return <>{children}</>;
  return (
    <SystemPage>
      <div data-testid="maintenance-page">
        <MaintenanceState
          title={t('maintenance.page.title')}
          description={until ? t('error.MAINTENANCE_MODE', { until: formatDateTime(until, locale) }) : t('maintenance.page.description')}
          action={{
            label: t('action.retry'),
            onClick: () => {
              setBlocked(false);
              void qc.refetchQueries({ type: 'active' });
            },
          }}
        />
        <p className="mt-3 text-center ts-label-meta text-text-muted">{t('maintenance.page.retry')}</p>
      </div>
    </SystemPage>
  );
}
