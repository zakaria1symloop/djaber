// AT-HELP-04 (unit part): SLA per plan in business hours Sun–Thu 09:00–18:00 Africa/Algiers (UTC+1).
import { isSlaBreached, slaHoursOf, slaMinutes, ticketSlaDueAt } from './support-ticket.service';

// 2026-10-11 is a Sunday; 10:00 Algiers = 09:00 UTC
const at = (iso: string) => new Date(iso);

describe('support SLA (HELP-05)', () => {
  it('maps plans to their SLA hours (unknown plan = free)', () => {
    expect(slaHoursOf('pro')).toBe(1);
    expect(slaHoursOf('starter')).toBe(4);
    expect(slaHoursOf('free')).toBe(24);
    expect(slaHoursOf('mystery')).toBe(24);
    expect(slaHoursOf(null)).toBe(24);
    expect(slaMinutes(24)).toBe(540);
  });

  it('AT-HELP-04 Pro ticket at 10:00 ⇒ due 11:00', () => {
    expect(ticketSlaDueAt(at('2026-10-11T09:00:00Z'), 1).toISOString()).toBe('2026-10-11T10:00:00.000Z');
  });

  it('AT-HELP-04 Free ticket ⇒ next business day (same time)', () => {
    expect(ticketSlaDueAt(at('2026-10-11T09:00:00Z'), 24).toISOString()).toBe('2026-10-12T09:00:00.000Z');
  });

  it('Starter ticket at 17:00 Thursday ⇒ Sunday 12:00 (weekend skipped)', () => {
    // 2026-10-15 is a Thursday; 17:00 Algiers = 16:00 UTC ⇒ 1 h Thursday + 3 h Sunday ⇒ Sunday 12:00 Algiers
    expect(ticketSlaDueAt(at('2026-10-15T16:00:00Z'), 4).toISOString()).toBe('2026-10-18T11:00:00.000Z');
  });

  it('a ticket is breached only while support owes an answer (status open) past slaDueAt', () => {
    const due = at('2026-10-11T10:00:00Z');
    const now = at('2026-10-11T10:30:00Z').getTime();
    expect(isSlaBreached({ status: 'open', slaDueAt: due }, now)).toBe(true);
    expect(isSlaBreached({ status: 'pending_customer', slaDueAt: due }, now)).toBe(false);
    expect(isSlaBreached({ status: 'open', slaDueAt: due }, at('2026-10-11T09:30:00Z').getTime())).toBe(false);
  });
});
