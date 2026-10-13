'use client';
// M11 — public site pieces (Figma "PUB — Pricing page (plans · FAQ · CTA)", "PUB — Legal (CMS) · Landing & help · Meta
// data-deletion status", "PUB — Public account deletion page"): FAQ accordion, numbered steps, version diff, feature
// block, marketing section heading. All copy comes in through props; logical CSS only (RTL safe).
import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from './primitives';

/* ---------- FAQ accordion ("C’est quoi un crédit ? ⌄") — native <details>: works before hydration ---------- */
export function FaqAccordion({ items, className, ...rest }: { items: { id: string; question: string; answer: React.ReactNode }[]; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div className={cn('w-full overflow-hidden rounded-card border border-line-edge bg-ink-surface', className)} {...rest}>
      {items.map((it) => (
        <details key={it.id} className="group border-b border-line-hairline last:border-b-0" data-testid="faq-item">
          <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3 text-[13px] text-text-primary hover:bg-ink-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-inbound [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">{it.question}</span>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-4 pb-4 text-[13px] leading-relaxed text-text-secondary">{it.answer}</div>
        </details>
      ))}
    </div>
  );
}

/* ---------- numbered steps ("1 Saisissez l’e-mail de votre compte · nous envoyons un lien…") ---------- */
export type NumberedStep = { id: string; marker: string; title: string; sub?: React.ReactNode; tone?: 'neutral' | 'warning' };
export function NumberedSteps({ steps, className, ...rest }: { steps: NumberedStep[]; className?: string } & Omit<React.HTMLAttributes<HTMLOListElement>, 'children'>) {
  return (
    <ol className={cn('w-full overflow-hidden rounded-card border border-line-edge bg-ink-surface', className)} {...rest}>
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3 border-b border-line-hairline px-4 py-2.5 last:border-b-0">
          <span
            aria-hidden
            className={cn('mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full ts-label-meta', s.tone === 'warning' ? 'bg-accent-starred text-black' : 'bg-ink-raised text-text-primary')}
          >
            {s.marker}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[13px] text-text-primary">{s.title}</span>
            {s.sub ? <span className="ts-label-meta text-text-muted [overflow-wrap:anywhere]">{s.sub}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- version diff ("historique des versions en bas (v3 → v4 : diff)") ---------- */
export type VersionDiffLine = { kind: 'same' | 'add' | 'del'; text: string };
export function VersionDiff({ lines, addedLabel, removedLabel, className }: { lines: VersionDiffLine[]; addedLabel: string; removedLabel: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-card border border-line-edge bg-ink-surface p-3 text-[13px]', className)} data-testid="version-diff">
      {lines.map((l, i) =>
        l.kind === 'same' ? (
          <p key={i} className="whitespace-pre-wrap px-2 py-1 text-text-muted [overflow-wrap:anywhere]">
            {l.text}
          </p>
        ) : (
          <p
            key={i}
            data-diff={l.kind}
            className={cn(
              'whitespace-pre-wrap rounded-[4px] border-s-2 px-2 py-1 [overflow-wrap:anywhere]',
              l.kind === 'add' ? 'border-s-signal-live bg-signal-live/10 text-text-primary' : 'border-s-accent-alert bg-accent-alert/10 text-text-secondary line-through decoration-accent-alert/60',
            )}
          >
            <span className="sr-only">{l.kind === 'add' ? addedLabel : removedLabel} </span>
            {l.text}
          </p>
        ),
      )}
    </div>
  );
}

/* ---------- feature block (landing / features: 6 blocks from the CMS) ---------- */
export function FeatureBlock({ index, title, children, className, ...rest }: { index: string; title: string; children: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'title'>) {
  return (
    <article className={cn('flex min-w-0 flex-col gap-2 rounded-card border border-line-edge bg-ink-surface p-5', className)} {...rest}>
      <span className="ts-label-meta text-text-muted" aria-hidden>
        {index}
      </span>
      <h3 className="ts-display-s">{title}</h3>
      <div className="text-[13px] leading-relaxed text-text-secondary">{children}</div>
    </article>
  );
}

/* ---------- marketing section heading (centred display title + mono subtitle) ---------- */
export function MarketingHeading({ title, sub, level = 1, className }: { title: string; sub?: React.ReactNode; level?: 1 | 2; className?: string }) {
  const H = level === 1 ? 'h1' : 'h2';
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <H className={cn('text-balance', level === 1 ? 'ts-display-l' : 'ts-display-m')}>{title}</H>
      {sub ? <p className="max-w-[640px] ts-label-meta text-text-secondary">{sub}</p> : null}
    </div>
  );
}
