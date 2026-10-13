// M10 — ops & safety pieces of the platform admin and the merchant help center (Figma "ADM-10 … ADM-14",
// "HELP — Help & support (merchant)", "PUB — Public status page"): pill tab bar with counts, KPI strip, titled
// panel with a mono sub-line, health / state pill, SLA pill, uptime bars, decision checkbox rows.
import * as React from 'react';
import { Card, cn, Pill, type Tone } from './primitives';

/* ---------- Pill tab bar: "À vérifier 23 · Urgents 2 · Appels du marchand 3" (active = white fill) ---------- */
export type PillTab = { key: string; label: string; count?: number | null; countLabel?: string };
export function PillTabs({ tabs, value, onChange, label, className }: { tabs: PillTab[]; value: string; onChange: (key: string) => void; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {tabs.map((tab) => {
        const on = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            aria-current={on ? 'page' : undefined}
            data-tab={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-card border px-3 text-[13px] transition-colors',
              on ? 'border-white bg-white text-black' : 'border-line-hairline text-text-secondary hover:border-line-lit hover:text-text-primary',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <span dir="ltr" className="tabular-nums">
                {tab.countLabel ?? tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- KPI tile of the admin pages: mono context line on top, numeral + mono unit ---------- */
export function OpsKpiTile({
  context,
  value,
  unit,
  tone,
  className,
  ...rest
}: { context?: React.ReactNode; value: React.ReactNode; unit?: React.ReactNode; tone?: 'danger' | 'warning' | 'success'; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <Card className={cn('flex min-h-[64px] flex-col justify-between px-3 py-3', className)} {...rest}>
      {context ? <div className="line-clamp-2 ts-label-micro text-text-muted">{context}</div> : null}
      <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
        <span
          dir="ltr"
          className={cn('ts-numeral-l shrink-0 tabular-nums', tone === 'danger' && 'text-accent-alert', tone === 'warning' && 'text-accent-starred', tone === 'success' && 'text-accent-money')}
        >
          {value}
        </span>
        {unit ? <span className="truncate ts-label-micro text-text-muted">{unit}</span> : null}
      </div>
    </Card>
  );
}

export function OpsKpiStrip({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <section aria-label={label} className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5', className)}>
      {children}
    </section>
  );
}

/* ---------- Panel: "Files (BullMQ)" + mono sub-line, optional end slot ---------- */
export function OpsPanel({
  title,
  sub,
  end,
  children,
  className,
  bodyClassName,
  ...rest
}: { title: React.ReactNode; sub?: React.ReactNode; end?: React.ReactNode; children?: React.ReactNode; className?: string; bodyClassName?: string } & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cn('rounded-card border border-line-edge bg-ink-surface p-4 md:p-5', className)} {...rest}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
          {sub ? <p className="mt-1 ts-label-micro text-text-muted">{sub}</p> : null}
        </div>
        {end ? <div className="flex shrink-0 items-center gap-2">{end}</div> : null}
      </header>
      {children !== undefined ? <div className={cn('mt-4', bodyClassName)}>{children}</div> : null}
    </section>
  );
}

/* ---------- State pill: OK · ATTENTION · INCIDENT · PAUSE, OPÉRATIONNEL, APPROUVÉE … ---------- */
export type OpsState = 'ok' | 'warning' | 'incident' | 'paused' | 'neutral' | 'info';
const STATE_TONE: Record<OpsState, Tone> = { ok: 'success', warning: 'warning', incident: 'danger', paused: 'neutral', neutral: 'neutral', info: 'info' };
export function StatePill({ state, children, className }: { state: OpsState; children: React.ReactNode; className?: string }) {
  return (
    <span data-state={state} className={cn('inline-flex', className)}>
      <Pill tone={STATE_TONE[state]} className="whitespace-nowrap">
        {children}
      </Pill>
    </span>
  );
}

/* ---------- SLA pill: DÉPASSÉ DE 20 MIN (red) · 3 H 25 RESTANTES (green) · EN ATTENTE CLIENT (muted) ---------- */
export function SlaPill({ kind, children, className }: { kind: 'breached' | 'remaining' | 'waiting'; children: React.ReactNode; className?: string }) {
  return (
    <span data-sla={kind} className={cn('inline-flex', className)}>
      <Pill tone={kind === 'breached' ? 'danger' : kind === 'remaining' ? 'success' : 'neutral'} className="whitespace-nowrap">
        {children}
      </Pill>
    </span>
  );
}

/* ---------- 90-day uptime bars of the public status page (one bar per day, newest at the end) ---------- */
export type UptimeDay = 'ok' | 'degraded' | 'incident' | 'none';
export function UptimeBars({ days, label, className }: { days: UptimeDay[]; label: string; className?: string }) {
  return (
    <div role="img" aria-label={label} dir="ltr" className={cn('flex h-5 shrink-0 items-stretch gap-[1.5px]', className)}>
      {days.map((d, i) => (
        <span
          key={i}
          className={cn(
            'w-[2px] rounded-[1px]',
            d === 'ok' && 'bg-accent-money',
            d === 'degraded' && 'bg-accent-starred',
            d === 'incident' && 'bg-accent-alert',
            d === 'none' && 'bg-ink-raised-high',
          )}
        />
      ))}
    </div>
  );
}

/* ---------- Mono key / value block of a context column: "ESPACE / Boutique Amel · Pro · actif" ---------- */
export function ContextRows({ rows, className }: { rows: { label: string; value: React.ReactNode; testId?: string }[]; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-3', className)}>
      {rows.map((r) => (
        <div key={r.label} data-testid={r.testId}>
          <dt className="ts-label-micro uppercase text-text-muted">{r.label}</dt>
          <dd className="mt-1 text-[14px] text-text-primary">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
