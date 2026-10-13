// M10 — moderation & safety pieces of the platform admin (Figma "ADM-10 — Platform admin — moderation queue (products)
// + review panel", "ADM-11 — Platform admin — abuse reports & blocked words"): queue row, decision chip, flagged field,
// image tile with its AI flag, mono legend note, masked report extract.
import * as React from 'react';
import { Checkbox, cn, Pill } from './primitives';

/* ---------- Queue row: ☐ · thumbnail · name + URGENT · meta · AI reason · score + waiting · ✓ ✕ ⋯ ---------- */
export function ModerationRow({
  selection,
  thumbnail,
  title,
  urgentLabel,
  meta,
  reason,
  score,
  scoreTone,
  scoreMeta,
  actions,
  active,
  onOpen,
  className,
  ...rest
}: {
  selection?: { checked: boolean; onChange: () => void; label: string };
  thumbnail?: React.ReactNode;
  title: string;
  /** "URGENT" pill after the name (SLA of 2 business hours exceeded) */
  urgentLabel?: string;
  /** mono line: "DAR EL OUD · CONFIANCE : STANDARD" */
  meta?: React.ReactNode;
  /** "IA : Marque protégée dans le titre · prix 1 800 DA (−80 % vs référence)" */
  reason?: React.ReactNode;
  /** "0,31" */
  score?: string;
  scoreTone?: 'danger' | 'warning' | 'success';
  /** "SCORE IA · 2 h 40" */
  scoreMeta?: string;
  /** ✓ / ✕ / ⋯ buttons */
  actions?: React.ReactNode;
  /** row shown in the review panel */
  active?: boolean;
  onOpen?: () => void;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <div
      data-active={active || undefined}
      className={cn('flex items-center gap-3 border-t border-line-hairline px-3 py-3 first:border-t-0', active && 'bg-ink-raised', className)}
      {...rest}
    >
      {selection ? <Checkbox aria-label={selection.label} checked={selection.checked} onChange={selection.onChange} className="shrink-0" /> : null}
      {thumbnail ? <div className="size-10 shrink-0 overflow-hidden rounded-[6px] bg-ink-raised-high">{thumbnail}</div> : null}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-inbound">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14px] text-text-primary">{title}</span>
          {urgentLabel ? <Pill tone="danger">{urgentLabel}</Pill> : null}
        </span>
        {meta ? <span className="mt-0.5 block truncate ts-label-micro text-text-muted">{meta}</span> : null}
        {reason ? <span className="mt-0.5 line-clamp-2 block ts-label-meta text-accent-starred">{reason}</span> : null}
      </button>
      {score !== undefined ? (
        <div className="hidden w-24 shrink-0 text-end sm:block">
          <div dir="ltr" className={cn('text-[15px] font-medium tabular-nums', scoreTone === 'danger' && 'text-accent-alert', scoreTone === 'warning' && 'text-accent-starred', scoreTone === 'success' && 'text-accent-money')}>
            {score}
          </div>
          {scoreMeta ? <div className="ts-label-micro text-text-muted">{scoreMeta}</div> : null}
        </div>
      ) : null}
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/* ---------- Decision chip: bordered mono chip with a box — one reason of the review panel / treatment panel ---------- */
export function DecisionChip({
  checked,
  onChange,
  children,
  disabled,
  name,
  value,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  /** radio group name: the chips of one group are exclusive */
  name?: string;
  value?: string;
  className?: string;
}) {
  return (
    <label
      data-checked={checked || undefined}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-[6px] border px-2.5 py-1.5 ts-label-meta transition-colors',
        checked ? 'border-line-lit text-text-primary' : 'border-line-hairline text-text-muted hover:text-text-secondary',
        disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
    >
      <input type={name ? 'radio' : 'checkbox'} name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="size-3.5 accent-white" />
      <span>{children}</span>
    </label>
  );
}

/* ---------- Flagged field of the review panel: mono label, value (red when refused), optional "refused" toggle ---------- */
export function FlaggedField({
  label,
  children,
  flagged,
  evidence,
  toggle,
  className,
  ...rest
}: {
  label: string;
  children: React.ReactNode;
  flagged?: boolean;
  /** AI evidence under the value */
  evidence?: React.ReactNode;
  toggle?: { checked: boolean; onChange: () => void; label: string; disabled?: boolean };
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div data-flagged={flagged || undefined} className={cn('flex flex-col gap-1', className)} {...rest}>
      <div className="flex items-center justify-between gap-3">
        <span className="ts-label-micro uppercase text-text-muted">{label}</span>
        {toggle ? (
          <label className={cn('inline-flex cursor-pointer items-center gap-1.5 ts-label-micro text-text-muted', toggle.disabled && 'cursor-not-allowed opacity-45')}>
            <Checkbox checked={toggle.checked} onChange={toggle.onChange} disabled={toggle.disabled} className="!size-3" />
            {toggle.label}
          </label>
        ) : null}
      </div>
      <div className={cn('text-[14px]', flagged ? 'text-accent-alert' : 'text-text-primary')}>{children}</div>
      {evidence ? <div className="ts-label-meta text-accent-starred">{evidence}</div> : null}
    </div>
  );
}

/* ---------- Image tile with its AI flag pill ("LOGO DIOR DÉTECTÉ"), red frame when flagged ---------- */
export function FlagImageTile({ src, alt, flag, className }: { src?: string | null; alt: string; flag?: string | null; className?: string }) {
  return (
    <div className={cn('relative aspect-square overflow-hidden rounded-card border bg-ink-raised-high', flag ? 'border-accent-alert' : 'border-line-hairline', className)}>
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : null}
      {flag ? (
        <span className="absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-accent-alert/60 bg-ink-base/80 px-2 py-0.5 ts-label-micro text-accent-alert">{flag}</span>
      ) : null}
    </div>
  );
}

/* ---------- Legend note: mono title + rule text (bottom of ADM-10) ---------- */
export function LegendNote({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-card border border-line-hairline bg-ink-surface px-3 py-2.5', className)}>
      <div className="ts-label-micro uppercase text-text-muted">{title}</div>
      <p className="mt-1 ts-label-meta text-text-secondary">{children}</p>
    </div>
  );
}

/* ---------- Masked report extract (read-only): the reported lines in red ---------- */
export type ExcerptLine = { author: string; text: string; time: string; reported?: boolean };
export function ReportExcerpt({ title, lines, emptyLabel, className }: { title: string; lines: ExcerptLine[]; emptyLabel?: string; className?: string }) {
  return (
    <div className={cn('rounded-card border border-line-edge bg-ink-base px-3 py-2.5', className)}>
      <div className="ts-label-micro text-text-muted">{title}</div>
      {lines.length ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {lines.map((l, i) => (
            <li key={i} data-reported={l.reported || undefined} className={cn('text-[14px]', l.reported ? 'text-accent-alert' : 'text-text-secondary')}>
              {l.author} : « {l.text} » <span dir="ltr">({l.time})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-text-muted">{emptyLabel}</p>
      )}
    </div>
  );
}
