'use client';
// M10 — platform admin core pieces (Figma page "Web V2", frames ADM-01…09, ADM-15…17, "DLG — Platform admin —
// dialogs catalogue"): alert rows (overview), labelled admin cards (plans, AI providers), before/after audit diff,
// role matrix, key test states, read-only viewer message, mono info blocks, the red impersonation bar.
import { Check, Minus } from 'lucide-react';
import * as React from 'react';
import { MonoChip } from './agents';
import { Card, cn } from './primitives';

/* ---------- ADM-01 alerts: dot · title · mono meta · action on the end side ---------- */
export type AlertTone = 'danger' | 'warning' | 'info';
const ALERT_DOT: Record<AlertTone, string> = { danger: 'bg-accent-alert', warning: 'bg-accent-starred', info: 'bg-accent-inbound' };
export function AdminAlertRow({ tone, title, meta, action, className, ...rest }: { tone: AlertTone; title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLLIElement>, 'title'>) {
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', className)} data-tone={tone} {...rest}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ALERT_DOT[tone])} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">{title}</span>
        {meta ? <span className="mt-0.5 block truncate ts-label-micro uppercase text-text-muted">{meta}</span> : null}
      </span>
      {action ? <span className="shrink-0 text-[13px] text-text-secondary">{action}</span> : null}
    </li>
  );
}

/* ---------- labelled card (plan card, provider card): title, pills, LABEL / value rows, actions ---------- */
export type CardRow = { label: string; value: React.ReactNode; tone?: 'warning' | 'danger' };
export function AdminCard({ title, pills, menu, rows, children, actions, muted, className, ...rest }: { title: React.ReactNode; pills?: React.ReactNode; menu?: React.ReactNode; rows: CardRow[]; children?: React.ReactNode; actions?: React.ReactNode; muted?: boolean; className?: string } & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-card border border-line-edge bg-ink-surface p-4', muted && 'opacity-80', className)} {...rest}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="ts-display-s truncate text-[17px]">{title}</h3>
          {pills ? <div className="mt-2 flex flex-wrap gap-1.5">{pills}</div> : null}
        </div>
        {menu}
      </header>
      {children}
      <dl className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="ts-label-micro uppercase text-text-muted">{r.label}</dt>
            <dd className={cn('mt-0.5 text-[13px]', r.tone === 'warning' && 'text-accent-starred', r.tone === 'danger' && 'text-accent-alert')}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
    </section>
  );
}

/* ---------- ADM-09 audit diff: before (red) / after (green), identical lines greyed ---------- */
export type DiffLine = { key: string; before: string | null; after: string | null };
export function CodeDiff({ beforeLabel, afterLabel, lines, empty, className }: { beforeLabel: string; afterLabel: string; lines: DiffLine[]; empty: string; className?: string }) {
  if (!lines.length) return <p className={cn('ts-label-meta text-text-muted', className)}>{empty}</p>;
  const col = (side: 'before' | 'after') => (
    <div className="min-w-0 rounded-card border border-line-hairline bg-ink-base p-3" data-side={side}>
      <div className={cn('ts-label-micro uppercase', side === 'before' ? 'text-accent-alert' : 'text-accent-money')}>{side === 'before' ? beforeLabel : afterLabel}</div>
      <pre dir="ltr" className="mt-2 overflow-x-auto font-mono text-[12px] leading-6">
        {lines.map((l) => {
          const v = side === 'before' ? l.before : l.after;
          const same = l.before === l.after;
          return (
            <div key={l.key} data-line={l.key} data-changed={!same} className={cn(same ? 'text-text-muted' : side === 'before' ? 'text-accent-alert' : 'text-accent-money')}>
              {v === null ? '∅' : `${l.key}: ${v}`}
            </div>
          );
        })}
      </pre>
    </div>
  );
  return (
    <div className={cn('grid gap-3 md:grid-cols-2', className)} data-testid="code-diff">
      {col('before')}
      {col('after')}
    </div>
  );
}

/** Flattens two JSON snapshots into aligned `path: value` lines (nested keys joined with dots, values JSON-encoded). */
export function diffLines(before: Record<string, unknown> | null, after: Record<string, unknown> | null): DiffLine[] {
  const flat = (o: Record<string, unknown> | null, prefix = '', out: Record<string, string> = {}) => {
    if (!o) return out;
    for (const [k, v] of Object.entries(o)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flat(v as Record<string, unknown>, key, out);
      else out[key] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  };
  const b = flat(before);
  const a = flat(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  // changed lines first (the reader looks for them), identical ones after, each group in key order
  const changed = keys.filter((k) => b[k] !== a[k]).sort();
  const same = keys.filter((k) => b[k] === a[k]).sort();
  return [...changed, ...same].map((k) => ({ key: k, before: b[k] ?? null, after: a[k] ?? null }));
}

/* ---------- ADM-16 role matrix: capability rows × roles, ✓ / — ---------- */
export function RoleMatrix({ roles, rows, capabilityLabel, label, className }: { roles: { key: string; label: string }[]; rows: { key: string; label: string; allowed: string[] }[]; capabilityLabel: string; label: string; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-card border border-line-hairline', className)}>
      <table className="w-full min-w-[640px] text-[13px]" aria-label={label}>
        <thead>
          <tr className="border-b border-line-hairline">
            <th scope="col" className="px-3 py-2.5 text-start ts-label-micro uppercase text-text-muted">
              {capabilityLabel}
            </th>
            {roles.map((r) => (
              <th key={r.key} scope="col" className="px-3 py-2.5 text-start ts-label-micro uppercase text-text-muted">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-capability={row.key} className="border-b border-line-hairline last:border-0">
              <th scope="row" className="px-3 py-2.5 text-start font-normal">
                {row.label}
              </th>
              {roles.map((r) => {
                const ok = row.allowed.includes(r.key);
                return (
                  <td key={r.key} className="px-3 py-2.5" data-role={r.key} data-allowed={ok}>
                    {ok ? <Check className="size-4 text-accent-money" aria-label="✓" /> : <Minus className="size-4 text-text-muted" aria-label="—" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- DLG "Clé fournisseur IA": test states TEST… / OK latency / REJETÉE / INJOIGNABLE / AUCUNE CLÉ ---------- */
export type KeyTestState = 'testing' | 'ok' | 'rejected' | 'unreachable' | 'no_key';
const KEY_TONE: Record<KeyTestState, 'neutral' | 'success' | 'danger' | 'warning'> = { testing: 'neutral', ok: 'success', rejected: 'danger', unreachable: 'warning', no_key: 'neutral' };
export function KeyTestRow({ state, pill, children, className }: { state: KeyTestState; pill: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" data-key-test={state} className={cn('flex items-start gap-2.5', className)}>
      <MonoChip tone={KEY_TONE[state]} className={cn('shrink-0', state === 'testing' && 'animate-pulse')}>
        {pill}
      </MonoChip>
      <span className="ts-label-meta text-text-secondary">{children}</span>
    </div>
  );
}

/* ---------- ADM-17 read-only viewer message ---------- */
export function ViewerMessage({ author, at, children, flagged, className }: { author: string; at: string; children: React.ReactNode; flagged?: boolean; className?: string }) {
  return (
    <div data-flagged={flagged || undefined} className={cn('rounded-card border bg-ink-surface px-3 py-2', flagged ? 'border-accent-alert/60' : 'border-line-edge', className)}>
      <div className="ts-label-micro uppercase text-text-muted">
        {author} · <bdi dir="ltr">{at}</bdi>
      </div>
      <div dir="auto" className="mt-1 font-mono text-[12px] leading-5">
        {children}
      </div>
    </div>
  );
}

/* ---------- mono info block (ADM-17 user sheet: IDENTITÉ / ESPACES / SESSIONS / ACTIVITÉ) ---------- */
export function InfoBlock({ label, lines, action, className }: { label: string; lines: React.ReactNode[]; action?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-1 bg-ink-base p-3', className)}>
      <div className="ts-label-micro uppercase text-text-muted">{label}</div>
      {lines.map((l, i) => (
        <div key={i} className="font-mono text-[12px] leading-5 break-words">
          {l}
        </div>
      ))}
      {action ? <div className="mt-1">{action}</div> : null}
    </Card>
  );
}

/* ---------- D21-bis read-only impersonation bar (fixed, red, above every banner) ---------- */
export function ImpersonationBar({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div role="alert" data-testid="impersonation-bar" className={cn('flex min-h-10 shrink-0 items-center gap-3 bg-accent-alert px-4 py-2 text-[13px] font-medium text-ink-base md:px-8', className)}>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

/* ---------- note under a section / dialog (mono, muted): rules and error codes of the frame ---------- */
export function FrameNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('ts-label-micro leading-4 text-text-muted', className)}>{children}</p>;
}
