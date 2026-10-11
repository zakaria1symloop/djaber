'use client';
// Return leg of the connect flow: the API callback page comes here when it has no opener (same-tab flow).
// Query: `connectReport=<id>` (report kept by the API for 10 min) or `connectError=<CODE>`.
// Opened in the pop-up ⇒ the report is relayed to the opener (`postMessage`, our own origin) and the window closes.
// Opened in the tab itself ⇒ back to the screen that started the flow, which shows the outcome.
import { Spinner } from '@djaber/ui';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { safeReturnTo } from '@/lib/guards';
import { useT } from '@/lib/i18n';
import { channelsApi } from './api';
import { CONNECT_ERROR_PARAM, CONNECT_REPORT_PARAM, CONNECT_RETURN_KEY } from './connect';
import { CONNECT_MESSAGE_TYPE, type ConnectMessage } from './contracts';
import { errorReport, normalizeReport } from './logic';

/** `/fr/onboarding/connect` → `/onboarding/connect` (the router adds the locale again). */
const withoutLocale = (path: string) => path.replace(/^\/(fr|ar|en)(?=\/|$)/, '') || '/';

export function ConnectReturn() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const reportId = params.get(CONNECT_REPORT_PARAM);
  const error = params.get(CONNECT_ERROR_PARAM);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      const post = (message: ConnectMessage) => {
        opener.postMessage(message, window.location.origin);
        window.close();
      };
      if (error || !reportId) return post({ type: CONNECT_MESSAGE_TYPE, report: errorReport(error || 'OAUTH_CANCELLED') });
      channelsApi
        .connectReport(reportId)
        .then((r) => post({ type: CONNECT_MESSAGE_TYPE, report: normalizeReport(r) ?? errorReport('OAUTH_STATE_INVALID') }))
        .catch(() => post({ type: CONNECT_MESSAGE_TYPE, report: errorReport('OAUTH_STATE_INVALID') }));
      return;
    }
    let target = '/channels';
    try {
      const stored = window.sessionStorage.getItem(CONNECT_RETURN_KEY);
      window.sessionStorage.removeItem(CONNECT_RETURN_KEY);
      if (stored) target = withoutLocale(safeReturnTo(stored, '/channels'));
    } catch {}
    const q = error || !reportId ? `${CONNECT_ERROR_PARAM}=${encodeURIComponent(error || 'OAUTH_CANCELLED')}` : `${CONNECT_REPORT_PARAM}=${encodeURIComponent(reportId)}`;
    router.replace(`${target}?${q}`);
  }, [reportId, error, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-[13px] text-text-secondary">
      <Spinner label={t('common.connecting')} />
      {t('common.connecting')}
    </div>
  );
}
