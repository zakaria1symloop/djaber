'use client';
// Pieces shared by the help pages: ticket pill + meta line, the "Mes demandes" rows, the "État du service" widget.
import { formatDate, type AppLocale, type TicketStatus } from '@djaber/shared';
import { HelpCard, Pill, ServiceStatusRow, Skeleton, TicketRow, type Tone } from '@djaber/ui';
import { Link } from '@/i18n/navigation';
import { useLocaleCode, useT, type TFunction } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import { useStatus } from '@/features/status/api';
import { clock, componentPillState } from '@/features/status/logic';
import type { Ticket } from './api';
import { TICKET_PILL_TONE, ticketPill } from './logic';

export function TicketPill({ ticket }: { ticket: Pick<Ticket, 'status' | 'awaitingMe'> }) {
  const t = useT();
  const k = ticketPill(ticket);
  return (
    <span data-testid="ticket-pill" data-pill={k}>
      <Pill tone={TICKET_PILL_TONE[k]}>{t(`help.ticket.pill.${k}`)}</Pill>
    </span>
  );
}

/** "ouvert il y a 1 h 20 · à vous de répondre" / "résolu le 12 sept. · note 5/5" */
export function ticketMeta(tk: Ticket, t: TFunction, locale: AppLocale): string {
  const parts: string[] = [];
  if (tk.status === 'resolved' || tk.status === 'closed') {
    parts.push(t(tk.status === 'resolved' ? 'help.ticket.meta.resolved' : 'help.ticket.meta.closed', { date: formatDate(tk.resolvedAt ?? tk.lastMessageAt, locale) }));
    if (tk.satisfaction !== null) parts.push(t('help.ticket.meta.rating', { score: tk.satisfaction }));
  } else {
    parts.push(t('help.ticket.meta.opened', { ago: relativeTime(tk.createdAt, locale) }));
    if (tk.awaitingMe) parts.push(t('help.ticket.meta.yourTurn'));
    else if (tk.status === 'pending_customer') parts.push(t('help.ticket.meta.yourTurn'));
    else parts.push(t('help.ticket.meta.waitingSupport'));
  }
  return parts.join(' · ');
}

export function TicketRows({ rows }: { rows: Ticket[] }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  return (
    <div className="divide-y divide-line-hairline rounded-card border border-line-edge">
      {rows.map((tk) => {
        const k = ticketPill(tk);
        return (
          <TicketRow
            key={tk.id}
            linkAs={Link}
            href={`/help/tickets/${tk.id}`}
            number={`#${tk.number.replace(/^#/, '')}`}
            subject={tk.subject}
            meta={ticketMeta(tk, t, locale)}
            pill={t(`help.ticket.pill.${k}`)}
            tone={TICKET_PILL_TONE[k]}
          />
        );
      })}
    </div>
  );
}

export const statusTone = (s: 'operational' | 'degraded' | 'incident'): Tone => (s === 'operational' ? 'success' : s === 'degraded' ? 'warning' : 'danger');

/** Header pill of the help center: TOUS LES SERVICES OPÉRATIONNELS / INCIDENT EN COURS. */
export function OverallStatusPill() {
  const t = useT();
  const locale = useLocaleCode();
  const q = useStatus();
  if (!q.data) return null;
  const s = q.data.overall;
  return (
    <a href={`/${locale}/status`} data-testid="overall-status" data-state={s} className="inline-flex">
      <Pill tone={statusTone(s)}>{t(`help.status.overall.${s}`)}</Pill>
    </a>
  );
}

/** "État du service" card (HELP-02): one row per component, incident pill with the expected recovery when known. */
export function ServiceStatusCard({ statusHref }: { statusHref: string }) {
  const t = useT();
  const q = useStatus();
  return (
    <HelpCard title={t('help.status.title')} sub={<a href={statusHref} className="hover:underline">{t('help.status.open')}</a>} data-testid="service-status">
      {q.isPending ? (
        <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : q.isError || !q.data ? (
        <p className="ts-label-meta text-text-muted" data-testid="service-status-error">
          {t('help.status.unavailable')}
        </p>
      ) : (
        <div className="divide-y divide-line-hairline rounded-card border border-line-edge">
          {q.data.components.map((c) => {
            const state = componentPillState(c.status);
            const label = state === 'ok' ? t('help.status.ok') : t(`help.status.component.${c.status}`);
            return <ServiceStatusRow key={c.key} name={c.name} tone={statusTone(c.status)} pill={label} />;
          })}
        </div>
      )}
      {q.data?.updatedAt ? <p className="ts-label-micro text-text-muted">{t('help.status.updatedAt', { time: clock(q.data.updatedAt) })}</p> : null}
    </HelpCard>
  );
}

export const TICKET_STATUSES: readonly TicketStatus[] = ['open', 'pending_customer', 'resolved', 'closed'];
