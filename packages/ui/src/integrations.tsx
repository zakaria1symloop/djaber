'use client';
// M11 — Settings › Intégrations pieces (Figma "SET — Settings — Integrations (Sheets · API keys · webhooks)" and
// "DLG — Settings & billing — Webhook sortant / Google Sheets — choisir la feuille"):
// the secret shown once (API key / webhook signing secret), one line of the webhook deliveries journal, one row of the
// API keys / endpoints lists and the Sheets state note. Copy comes from the caller (i18n keys).
import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { Button, cn, type Tone } from './primitives';

/**
 * "dj_live_4b1e9c7d2a… (copiez-la maintenant : elle ne sera plus jamais affichée)" + Copier.
 * The value is LTR and selectable; `onCopy` lets the screen toast. Amber frame = shown once.
 */
export function SecretOnce({
  value,
  note,
  copyLabel,
  copiedLabel,
  onCopied,
  className,
  testId,
}: {
  value: string;
  note: string;
  copyLabel: string;
  copiedLabel: string;
  onCopied?: () => void;
  className?: string;
  testId?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard refused (insecure origin): the value stays selectable
    }
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 2_000);
  };
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-card border border-accent-starred/70 bg-accent-starred/5 px-3 py-2.5', className)} data-testid={testId}>
      <div className="min-w-0 flex-1 basis-60">
        <code dir="ltr" className="block select-all break-all font-mono text-[13px] text-accent-starred" data-secret>
          {value}
        </code>
        <p className="mt-1 text-[12px] text-accent-starred/90">{note}</p>
      </div>
      <Button size="sm" onClick={() => void copy()} aria-label={copied ? copiedLabel : copyLabel}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}

/** One row of the API keys / webhook endpoints lists: title (truncated with tooltip), mono meta line, status, actions. */
export function IntegrationRow({
  title,
  meta,
  status,
  actions,
  muted,
  className,
  ...rest
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  muted?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLLIElement>, 'title'>) {
  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:flex-nowrap', muted && 'text-text-muted', className)} {...rest}>
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <div className={cn('truncate text-[14px]', muted ? 'text-text-muted' : 'text-text-primary')}>{title}</div>
        {meta ? <div className="ts-label-micro mt-1 truncate uppercase text-text-muted">{meta}</div> : null}
      </div>
      {status ? <div className="shrink-0">{status}</div> : null}
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </li>
  );
}

export type DeliveryLogTone = 'success' | 'danger' | 'warning' | 'neutral';
const LOG_TONE: Record<DeliveryLogTone, string> = {
  success: 'text-accent-money',
  danger: 'text-accent-alert',
  warning: 'text-accent-starred',
  neutral: 'text-text-muted',
};

/** "10:58 · order.created · #CMD-1042 · 502 · tentative 7/7 · Rejouer" — one line of the deliveries journal. */
export function DeliveryLogRow({
  time,
  label,
  result,
  tone,
  actions,
  className,
  ...rest
}: {
  time: React.ReactNode;
  label: React.ReactNode;
  result: React.ReactNode;
  tone: DeliveryLogTone;
  actions?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto]', className)} {...rest}>
      <span className="ts-label-micro uppercase tabular-nums text-text-muted">{time}</span>
      <span className="min-w-0 truncate text-[13px]">{label}</span>
      <span className={cn('ts-label-micro col-start-2 row-start-2 whitespace-nowrap sm:col-start-auto sm:row-start-auto', LOG_TONE[tone])}>{result}</span>
      <span className="col-start-3 row-span-2 row-start-1 justify-self-end sm:col-start-auto sm:row-span-1 sm:row-start-auto">{actions}</span>
    </li>
  );
}

/** "ÉTAT · ERREUR · ACCÈS RÉVOQUÉ — Bandeau rouge « reconnectez Google »": the state of a connection, in its tone. */
export function ConnectionNote({ tone = 'neutral', label, children, action, className }: { tone?: Tone; label: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const bar: Partial<Record<Tone, string>> = { danger: 'border-s-accent-alert', warning: 'border-s-accent-starred', success: 'border-s-accent-money', info: 'border-s-accent-inbound' };
  const text: Partial<Record<Tone, string>> = { danger: 'text-accent-alert', warning: 'text-accent-starred', success: 'text-accent-money', info: 'text-accent-inbound' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[6px] border-s-2 bg-ink-raised px-3 py-2.5', bar[tone] ?? 'border-s-line-lit', className)}>
      <div className="min-w-0 flex-1 basis-56 [overflow-wrap:anywhere]">
        <div className={cn('ts-label-micro uppercase', text[tone] ?? 'text-text-secondary')}>{label}</div>
        {children ? <div className="mt-1 text-[13px] text-text-secondary">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
