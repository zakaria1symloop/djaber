'use client';
// M6 delivery kit (Figma "DLV-08 — Delivery — overview + tracking panel", "DLV-01/03 — … couriers settings",
// "DLV-06 / ORD-09 — Labels viewer (single · merged job · Djaber fallback)", DLG "Ajouter un transporteur",
// public tracking page `/s/[code]`): tracking timeline, "Actualiser" bar with its states, courier card, connection-test
// result, Djaber A6 fallback label (with a visual barcode), merged-label job rows and the parcel step bar of the public
// page. All copy comes in through props; logical CSS only (RTL safe); numbers, phones and tracking numbers are LTR.
import { Check, Loader2, RefreshCw } from 'lucide-react';
import * as React from 'react';
import { Ltr } from './inputs';
import { Button, cn, Pill, toneDot, type Tone } from './primitives';

/* ---------- Tracking timeline (panel, order page, public page): dot coloured by mapped status, newest first ---------- */
export type TrackingStep = { key: string; title: React.ReactNode; meta?: React.ReactNode; tone?: Tone; text?: React.ReactNode };
export function TrackingTimeline({ items, label, empty, className }: { items: TrackingStep[]; label: string; empty?: string; className?: string }) {
  if (!items.length) return empty ? <p className={cn('ts-label-meta text-text-muted', className)}>{empty}</p> : null;
  return (
    <ol aria-label={label} className={cn('flex flex-col gap-4', className)} data-testid="tracking-timeline">
      {items.map((i) => (
        <li key={i.key} className="flex gap-3" data-step={i.key}>
          <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[i.tone ?? 'neutral'])} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px]">{i.title}</div>
            {i.text ? <div className="mt-0.5 text-[13px] text-text-secondary">{i.text}</div> : null}
            {i.meta ? <div className="mt-0.5 ts-label-micro text-text-muted">{i.meta}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- "Dernière synchro il y a 12 min · [⟳ Actualiser]" + the state line of the refresh ---------- */
export type SyncState = 'idle' | 'syncing' | 'fresh' | 'limited' | 'not_found' | 'unavailable';
export function TrackingSyncBar({
  lastSync,
  state,
  onRefresh,
  refreshLabel,
  syncingLabel,
  message,
  disabledReason,
  className,
}: {
  /** "Dernière synchro il y a 12 min" */
  lastSync: React.ReactNode;
  state: SyncState;
  onRefresh?: () => void;
  refreshLabel: string;
  syncingLabel: string;
  /** line under the bar: "À jour", "Limite 1 / 5 min", "n° inconnu chez le transporteur"… */
  message?: React.ReactNode;
  /** greyed button (rate limit, no tracking): shown as tooltip text */
  disabledReason?: string;
  className?: string;
}) {
  const tone = state === 'fresh' ? 'text-accent-money' : state === 'limited' ? 'text-accent-starred' : state === 'not_found' || state === 'unavailable' ? 'text-accent-alert' : 'text-text-muted';
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-testid="tracking-sync" data-state={state}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="ts-label-micro text-text-muted">{lastSync}</span>
        {onRefresh ? (
          <Button size="sm" onClick={onRefresh} loading={state === 'syncing'} disabledReason={disabledReason} data-testid="tracking-refresh">
            {state === 'syncing' ? null : <RefreshCw className="size-3.5" aria-hidden />}
            {state === 'syncing' ? syncingLabel : refreshLabel}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role={state === 'not_found' || state === 'unavailable' ? 'alert' : 'status'} className={cn('ts-label-micro !normal-case', tone)}>
          {state === 'fresh' ? <Check className="me-1 inline size-3" aria-hidden /> : null}
          {message}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- Courier card of /delivery/couriers: name, status pill, mono meta, lines, actions ---------- */
export function CourierCard({
  name,
  status,
  meta,
  children,
  actions,
  muted,
  className,
  ...rest
}: {
  name: string;
  status: { label: string; tone: Tone };
  /** "PAR DÉFAUT · TOKEN + KEY · TESTÉ IL Y A 2 H" */
  meta?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** inactive account / provider not configured */
  muted?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>) {
  const id = React.useId();
  return (
    <article aria-labelledby={id} className={cn('flex flex-col gap-3 rounded-card border border-line-edge bg-ink-surface p-4', muted && 'opacity-80', className)} {...rest}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="ts-display-s truncate text-[17px]">
            {name}
          </h3>
          {meta ? <div className="mt-0.5 ts-label-micro text-text-muted">{meta}</div> : null}
        </div>
        <Pill tone={status.tone} className="shrink-0 !rounded-[4px]">
          {status.label}
        </Pill>
      </header>
      {children ? <div className="flex flex-col gap-2 text-[13px] text-text-secondary">{children}</div> : null}
      {actions ? <div className="mt-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </article>
  );
}

/* ---------- Connection test result: "TEST : EN COURS…" / "OK · 420 MS · 58 WILAYAS" / "REFUSÉ" / "INJOIGNABLE" ---------- */
export type CourierTestState = 'testing' | 'ok' | 'rejected' | 'unreachable';
const TEST_TONE: Record<CourierTestState, Tone> = { testing: 'neutral', ok: 'success', rejected: 'danger', unreachable: 'warning' };
export function CourierTestResult({ state, label, detail, className }: { state: CourierTestState; label: string; detail?: React.ReactNode; className?: string }) {
  return (
    <div role={state === 'testing' ? 'status' : state === 'ok' ? 'status' : 'alert'} className={cn('flex flex-wrap items-center gap-2', className)} data-testid="courier-test" data-state={state}>
      <Pill tone={TEST_TONE[state]} className="!rounded-[4px]">
        {state === 'testing' ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
        {label}
      </Pill>
      {detail ? <span className="ts-label-micro !normal-case text-text-muted">{detail}</span> : null}
    </div>
  );
}

/* ---------- Visual barcode (preview only — the printed PDF carries the real Code 128 from the API) ---------- */
export function Barcode({ value, label, className }: { value: string; label: string; className?: string }) {
  // deterministic bar widths from the characters: same value ⇒ same picture
  const bars: number[] = [];
  for (const ch of value) {
    const c = ch.charCodeAt(0);
    bars.push(1 + (c % 3), 1 + ((c >> 2) % 2), 1 + ((c >> 3) % 3), 1 + ((c >> 1) % 2));
  }
  const total = bars.reduce((s, b) => s + b, 0) || 1;
  let x = 0;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${total} 40`} preserveAspectRatio="none" className={cn('h-10 w-full', className)}>
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={40} fill="currentColor" /> : null;
        x += w;
        return rect;
      })}
    </svg>
  );
}

/* ---------- Djaber A6 label (fallback when the courier gives none, and "Livraison propre"): white sheet ---------- */
export type A6LabelProps = {
  /** "Djaber.ai · Boutique Amel" */
  shop: string;
  /** "#CMD-1037" or the tracking number */
  reference: string;
  barcode: string;
  barcodeLabel: string;
  /** "Livraison propre · domicile" */
  mode: string;
  recipient: string;
  address: string;
  /** "À ENCAISSER : 6 000 DA" */
  cod: string;
  items: string;
  /** "Retour : 0555 12 34 56" */
  footer?: string[];
  dir?: 'ltr' | 'rtl';
  lang?: string;
  className?: string;
};
export function A6Label({ shop, reference, barcode, barcodeLabel, mode, recipient, address, cod, items, footer = [], dir = 'ltr', lang, className }: A6LabelProps) {
  return (
    <article dir={dir} lang={lang} data-testid="a6-label" className={cn('a6-label flex flex-col gap-2 bg-white p-4 text-black', className)}>
      <p className="text-[14px] font-medium">{shop}</p>
      <p className="text-[14px] font-semibold">
        <bdi dir="ltr">{reference}</bdi>
      </p>
      <Barcode value={barcode} label={barcodeLabel} className="text-black" />
      <p className="font-mono text-[9px] uppercase tracking-wide">{mode}</p>
      <p className="text-[13px]">{recipient}</p>
      <p className="text-[13px]">{address}</p>
      <p className="text-[15px] font-semibold">{cod}</p>
      <p className="text-[13px]">{items}</p>
      {footer.map((f) => (
        <p key={f} className="font-mono text-[9px]">
          {f}
        </p>
      ))}
    </article>
  );
}

/* ---------- Merged labels job row: "EN COURS · 3 / 4" / "PRÊT" / "PARTIEL" / "ÉCHEC" + text + actions ---------- */
export type LabelJobState = 'running' | 'ready' | 'partial' | 'failed';
const JOB_TONE: Record<LabelJobState, Tone> = { running: 'warning', ready: 'success', partial: 'warning', failed: 'danger' };
export function LabelJobRow({ state, label, text, actions, className }: { state: LabelJobState; label: string; text?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)} data-testid="label-job" data-state={state} role={state === 'failed' ? 'alert' : 'status'}>
      <Pill tone={JOB_TONE[state]} className="!rounded-[4px]">
        {state === 'running' ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
        {label}
      </Pill>
      {text ? <span className="ts-label-micro !normal-case text-text-secondary">{text}</span> : null}
      {actions ? <span className="flex flex-wrap items-center gap-2">{actions}</span> : null}
    </div>
  );
}

/* ---------- Parcel steps of the public page: Créée → Ramassée → En transit → En livraison → Livrée ---------- */
export type ParcelStep = { key: string; label: string; state: 'done' | 'current' | 'upcoming' | 'failed' };
export function ParcelSteps({ steps, label, className }: { steps: ParcelStep[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={cn('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} data-testid="parcel-steps">
      {steps.map((s) => (
        <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} data-state={s.state} className="flex min-w-0 flex-col gap-1.5">
          <span
            aria-hidden
            className={cn(
              'h-1 rounded-full',
              s.state === 'done' && 'bg-accent-money',
              s.state === 'current' && 'bg-accent-inbound',
              s.state === 'failed' && 'bg-accent-alert',
              s.state === 'upcoming' && 'bg-ink-raised-high',
            )}
          />
          {/* wraps (never cut) on phones: "EN LIVRAISON" on two lines rather than "EN LIVRA…" */}
          <span className={cn('ts-label-micro leading-tight [overflow-wrap:anywhere]', s.state === 'upcoming' ? 'text-text-muted' : s.state === 'failed' ? 'text-accent-alert' : 'text-text-primary')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- "Coût transporteur 450 DA · 3,8 j" mono sub line used by courier radios ---------- */
export function CourierCostLine({ cost, delay, className }: { cost?: string | null; delay?: string | null; className?: string }) {
  const parts = [cost, delay].filter(Boolean) as string[];
  if (!parts.length) return null;
  return (
    <span className={cn('ts-label-micro !normal-case text-text-muted', className)}>
      {parts.map((p, i) => (
        <React.Fragment key={p}>
          {i ? ' · ' : null}
          <Ltr className="!inline">{p}</Ltr>
        </React.Fragment>
      ))}
    </span>
  );
}
