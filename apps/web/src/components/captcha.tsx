'use client';
// Captcha port of the public forms (M11, contract §2 `GET /captcha/config`): provider-agnostic.
//  - `none`      → nothing rendered, no token needed;
//  - `fake`      → dev / test: a checkbox "Je ne suis pas un robot" whose checked value is the token `fake-pass`;
//  - `turnstile` → Cloudflare Turnstile, its script is loaded only then and only when the API sends a site key.
// The token goes into the request body as `captchaToken`; a refused one comes back as `422 fields.captchaToken =
// validation.captcha`, shown under the widget by the form.
import { FAKE_CAPTCHA_PASS, type CaptchaConfigDto } from '@djaber/shared';
import { Checkbox, Skeleton } from '@djaber/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useLocaleCode, useT } from '@/lib/i18n';

export const useCaptchaConfig = () =>
  useQuery({ queryKey: ['public', 'captcha-config'], queryFn: () => api<CaptchaConfigDto>('/captcha/config'), staleTime: 10 * 60_000, retry: 1 });

/** A token is needed unless the provider is `none` (an unknown config counts as needed: the API decides). */
export const captchaNeeded = (c: CaptchaConfigDto | undefined) => c?.provider !== 'none';

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let turnstileLoading: Promise<void> | null = null;
const loadTurnstile = () =>
  (turnstileLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      turnstileLoading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  }));

export function CaptchaField({ token, onToken, error }: { token: string | null; onToken: (t: string | null) => void; error?: string }) {
  const t = useT();
  const q = useCaptchaConfig();
  const c = q.data;
  return (
    <div className="flex flex-col gap-1.5" data-testid="captcha" data-provider={c?.provider ?? (q.isError ? 'error' : 'loading')}>
      {q.isPending ? (
        <Skeleton className="h-5 w-48" />
      ) : q.isError || !c ? (
        <p className="text-[12px] text-accent-alert">{t('public.captcha.error')}</p>
      ) : c.provider === 'none' ? null : c.provider === 'turnstile' && c.siteKey ? (
        <TurnstileWidget siteKey={c.siteKey} onToken={onToken} />
      ) : c.provider === 'turnstile' ? (
        <p className="text-[12px] text-accent-alert">{t('public.captcha.error')}</p>
      ) : (
        <label className="flex w-fit items-center gap-2 rounded-card border border-line-edge bg-ink-surface px-3 py-2 text-[13px] text-text-primary">
          <Checkbox checked={token === FAKE_CAPTCHA_PASS} onChange={(e) => onToken(e.target.checked ? FAKE_CAPTCHA_PASS : null)} data-testid="captcha-fake" aria-invalid={!!error || undefined} />
          {t('integrations.captcha.fakeLabel')}
        </label>
      )}
      {error ? (
        <p role="alert" className="text-[12px] text-accent-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const t = useT();
  const locale = useLocaleCode();
  const box = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  useEffect(() => {
    let id: string | null = null;
    let alive = true;
    loadTurnstile()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: locale,
          theme: 'dark',
          callback: (tok: string) => cb.current(tok),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        });
      })
      .catch(() => alive && cb.current(null));
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, locale]);
  return (
    <div ref={box} className="min-h-[65px]" aria-label={t('public.captcha.loading')}>
      <span className="sr-only">{t('public.captcha.loading')}</span>
    </div>
  );
}
