'use client';
// M5 order form kit (Figma ORD-02 — New order — form): numbered form card, client result rows, order line row with stock
// hint, fee quote bar, totals card, validation checklist. All copy comes in through props; logical CSS only (RTL safe).
import { AlertTriangle, Check, Search, X } from 'lucide-react';
import * as React from 'react';
import { Ltr } from './inputs';
import { Card, cn, Input } from './primitives';

/* ---------- "1 · CLIENTE" card with the requirement badge on the end side ---------- */
export function OrderFormCard({
  index,
  title,
  badge,
  children,
  className,
  ...rest
}: {
  index: number;
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={cn('rounded-card border border-line-edge bg-ink-surface p-5', className)} {...rest}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="ts-label-section text-text-muted">
          <Ltr>{index}</Ltr> · {title}
        </h2>
        {badge ? <span className="rounded-[4px] border border-line-edge px-2 py-0.5 ts-label-micro text-text-secondary">{badge}</span> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/* ---------- search field with a results panel under it (client picker, product picker) ---------- */
export function PickerSearch({
  id,
  value,
  onChange,
  placeholder,
  label,
  active,
  onKeyDown,
  invalid,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  /** the results panel is open (green focus ring of the Figma) */
  active?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div role="search" className="relative">
      <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      <Input
        id={id}
        type="search"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn('ps-9 [&::-webkit-search-cancel-button]:hidden', active && 'border-signal-live')}
      />
    </div>
  );
}

/* ---------- one result of the client picker: "Amina Belkacem · 0555 12 34 56 · Sétif · 3 commandes" ---------- */
export function ClientResultRow({
  name,
  meta,
  badge,
  onSelect,
  highlighted,
  muted,
}: {
  name: string;
  meta: React.ReactNode;
  badge?: React.ReactNode;
  onSelect: () => void;
  highlighted?: boolean;
  muted?: boolean;
}) {
  return (
    <li>
      <button type="button" onClick={onSelect} className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-ink-raised', highlighted && 'bg-ink-raised')}>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[14px] font-medium', muted && 'text-text-secondary')}>{name}</span>
          <span className="block truncate ts-label-micro text-text-muted">{meta}</span>
        </span>
        {badge}
      </button>
    </li>
  );
}

/* ---------- an order line: thumbnail, name, variant / stock hint, price, quantity, total, remove ---------- */
export function OrderLineRow({
  name,
  imageUrl,
  detail,
  warning,
  warningTone = 'warning',
  price,
  quantity,
  total,
  onRemove,
  removeLabel,
  error,
  className,
  ...rest
}: {
  name: string;
  imageUrl?: string | null;
  /** variant picker + "(stock 41)" */
  detail?: React.ReactNode;
  /** "⚠ Dernière unité de cette variante" */
  warning?: string | null;
  warningTone?: 'warning' | 'danger';
  price: React.ReactNode;
  quantity: React.ReactNode;
  total: React.ReactNode;
  onRemove?: () => void;
  removeLabel: string;
  error?: string | null;
  className?: string;
} & Omit<React.LiHTMLAttributes<HTMLLIElement>, 'children'>) {
  return (
    <li className={cn('flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap', className)} {...rest}>
      <span aria-hidden className="size-10 shrink-0 overflow-hidden rounded-[6px] bg-ink-raised">
        {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{name}</div>
        {detail ? <div className="mt-0.5 flex flex-wrap items-center gap-x-2 ts-label-micro text-text-muted">{detail}</div> : null}
        {warning ? (
          <div role="status" className={cn('mt-0.5 ts-label-micro', warningTone === 'danger' ? 'text-accent-alert' : 'text-accent-starred')}>
            ⚠ {warning}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="mt-0.5 text-[12px] text-accent-alert">
            {error}
          </div>
        ) : null}
      </div>
      <div className="w-28 shrink-0">{price}</div>
      <div className="shrink-0">{quantity}</div>
      <div className="w-24 shrink-0 text-end text-[14px] font-semibold tabular-nums">{total}</div>
      {onRemove ? (
        <button type="button" aria-label={removeLabel} title={removeLabel} onClick={onRemove} className="flex size-8 shrink-0 items-center justify-center text-text-muted hover:text-text-primary">
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/* ---------- fee quote bar: "Frais de livraison client : 0 DA" + mono explanation + "Modifier (Admin)" ---------- */
export function FeeQuoteBar({
  title,
  explanation,
  action,
  tone,
  children,
}: {
  title: React.ReactNode;
  explanation?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'danger' | 'muted';
  children?: React.ReactNode;
}) {
  return (
    <div data-testid="fee-quote" className={cn('flex flex-col gap-3 rounded-card bg-ink-raised px-3.5 py-3', tone === 'danger' && 'border-s-2 border-s-accent-alert')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn('text-[14px] font-medium', tone === 'danger' && 'text-accent-alert', tone === 'muted' && 'text-text-secondary')}>{title}</div>
          {explanation ? <div className="mt-0.5 ts-label-micro text-text-muted">{explanation}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ---------- totals card (RÉCAPITULATIF) ---------- */
export type TotalsRow = { key: string; label: string; value: React.ReactNode; strong?: boolean };
export function OrderTotalsCard({ title, rows, className }: { title: string; rows: TotalsRow[]; className?: string }) {
  return (
    <Card className={cn('flex flex-col gap-3 p-4', className)} data-testid="order-totals">
      <div className="ts-label-micro text-text-muted">{title}</div>
      <dl className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.key} data-row={r.key} className="flex items-baseline justify-between gap-3">
            <dt className="ts-label-micro text-text-muted">{r.label}</dt>
            <dd className={cn('text-end tabular-nums', r.strong ? 'ts-numeral-l' : 'text-[13px]')}>
              <Ltr>{r.value}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/* ---------- validation checklist (VALIDATION): ✓ ok · ⚠ warning · ✗ missing ---------- */
export type ChecklistLine = { key: string; state: 'ok' | 'missing' | 'warning'; label: string };
export function ValidationChecklist({ title, items, className }: { title: string; items: ChecklistLine[]; className?: string }) {
  return (
    <Card className={cn('flex flex-col gap-3 p-4', className)} data-testid="validation-checklist">
      <div className="ts-label-micro text-text-muted">{title}</div>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={`${i.key}:${i.label}`} data-check={i.key} data-state={i.state} className="flex items-start gap-2 text-[13px]">
            {i.state === 'ok' ? (
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-accent-money" />
            ) : i.state === 'warning' ? (
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-accent-starred" />
            ) : (
              <X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-accent-alert" />
            )}
            <span className={cn(i.state === 'missing' ? 'text-text-secondary' : 'text-text-primary')}>{i.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
