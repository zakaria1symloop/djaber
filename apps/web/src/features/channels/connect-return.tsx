'use client';
// Return leg of the connect flow: the API callback page comes here when it has no opener (same-tab flow).
// Query: `connectReport=<id>` (report kept by the API for 10 min) or `connectError=<CODE>`.
// Opened in the pop-up ⇒ the report is relayed to the opener (`postMessage`, our own origin) and the window closes.
// Pop-up whose opener link Meta's pages cut ⇒ the result is handed over a BroadcastChannel to the window that started
// the flow; once it acknowledges, the pop-up closes.
// Opened in the tab itself (or nobody acknowledged) ⇒ back to the screen that started the flow, which shows the outcome.
import { Spinner } from '@djaber/ui';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { safeReturnTo } from '@/lib/guards';
import { useT } from '@/lib/i18n';
import { channelsApi } from './api';
import { CONNECT_ERROR_PARAM, CONNECT_HANDOFF_CHANNEL, CONNECT_REPORT_PARAM, CONNECT_RETURN_KEY, type ConnectHandoff } from './connect';
import { CONNECT_MESSAGE_TYPE, type ConnectMessage } from './contracts';
import { errorReport, normalizeReport } from './logic';

/** `/fr/onboarding/connect` → `/onboarding/connect` (the router adds the locale again). */
const withoutLocale = (path: string) => path.replace(/^\/(fr|ar|en)(?=\/|$)/, '') || '/';
/** how long the pop-up waits for the starting window to acknowledge the hand-off before going the same-tab way */
const HANDOFF_ACK_MS = 1500;

/** true once a window that started the flow took the result over */
function handOff(reportId: string | null, error: string | null): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CONNECT_HANDOFF_CHANNEL);
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      channel.close();
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), HANDOFF_ACK_MS);
    channel.onmessage = (e: MessageEvent<ConnectHandoff>) => e.data?.type === 'ack' && done(true);
    channel.postMessage({ type: 'handoff', reportId, error } satisfies ConnectHandoff);
  });
}

export function ConnectReturn() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const reportId = params.get(CONNECT_REPORT_PARAM);
  const error = params.get(CONNECT_ERROR_PARAM);
  const ran = useRef(false);
  /** the result went to the starting window but this pop-up may not close itself (a browser can refuse it) */
  const [handedOff, setHandedOff] = useState(false);

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
    void handOff(reportId, error).then((taken) => {
      if (taken) {
        setHandedOff(true);
        return window.close();
      }
      let target = '/channels';
      try {
        const stored = window.sessionStorage.getItem(CONNECT_RETURN_KEY);
        window.sessionStorage.removeItem(CONNECT_RETURN_KEY);
        if (stored) target = withoutLocale(safeReturnTo(stored, '/channels'));
      } catch {}
      const q = error || !reportId ? `${CONNECT_ERROR_PARAM}=${encodeURIComponent(error || 'OAUTH_CANCELLED')}` : `${CONNECT_REPORT_PARAM}=${encodeURIComponent(reportId)}`;
      router.replace(`${target}?${q}`);
    });
  }, [reportId, error, router]);

  if (handedOff)
    return (
      <div role="status" className="flex min-h-[40vh] items-center justify-center px-4 text-center text-[13px] text-text-secondary">
        {t('channels.connect.handedOff')}
      </div>
    );
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-[13px] text-text-secondary">
      <Spinner label={t('common.connecting')} />
      {t('common.connecting')}
    </div>
  );
}
