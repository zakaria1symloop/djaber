import { describe, expect, it } from 'vitest';
import type { StatusPage } from './api';
import { clock, dayClock, formatUptime, maintenanceWindow, minutesSince, openIncidents, sortIncidents, uptimeDays } from './logic';

const page = (patch: Partial<StatusPage> = {}): StatusPage => ({ overall: 'operational', components: [], incidents: [], banner: null, maintenance: null, updatedAt: '2026-10-06T10:00:00Z', ...patch });
const inc = (id: string, startedAt: string, resolvedAt: string | null) => ({ id, title: id, status: resolvedAt ? 'resolved' : 'open', severity: 'minor', components: [], startedAt, resolvedAt, durationMinutes: null, updates: [] });

describe('status page rules (OPS-06)', () => {
  it('uptime: fraction or percent, 2 decimals max, French comma', () => {
    expect(formatUptime(99.98, 'fr')).toBe('99,98\u00a0%');
    expect(formatUptime(0.999, 'en')).toBe('99.9\u00a0%');
    expect(formatUptime(100, 'fr')).toBe('100\u00a0%');
  });

  it('daily bars only when the API sends them (never invented from the average)', () => {
    expect(uptimeDays({ key: 'a', name: 'A', status: 'operational', uptime90d: 99 })).toBeNull();
    const days = uptimeDays({ key: 'a', name: 'A', status: 'operational', uptime90d: 99, days: ['ok', 'incident', 'x'] } as never);
    expect(days).toEqual(['ok', 'incident', 'none']);
  });

  it('open incidents first, newest first', () => {
    const list = [inc('old', '2026-09-29T08:02:00Z', '2026-09-29T08:14:00Z'), inc('open', '2026-10-06T10:20:00Z', null), inc('mid', '2026-10-05T17:40:00Z', '2026-10-05T18:05:00Z')];
    expect(sortIncidents(list).map((i) => i.id)).toEqual(['open', 'mid', 'old']);
    expect(openIncidents(page({ incidents: list })).map((i) => i.id)).toEqual(['open']);
  });

  it('Algiers clock and day label', () => {
    expect(clock('2026-10-06T10:20:00Z')).toBe('11:20');
    expect(dayClock('2026-10-06T10:20:00Z', 'fr')).toBe('06 oct. 11:20');
    expect(minutesSince('2026-10-06T10:00:00Z', Date.parse('2026-10-06T10:08:30Z'))).toBe(8);
  });

  it('maintenance banner: scheduled / active window, none once over', () => {
    const now = Date.parse('2026-10-12T00:00:00Z');
    const m = (active: boolean, from: string | null, to: string | null) => page({ maintenance: { active, scheduledFrom: from, scheduledTo: to, scope: 'all', text: null } });
    expect(maintenanceWindow(m(false, '2026-10-12T01:00:00Z', '2026-10-12T03:00:00Z'), now)).toMatchObject({ active: false });
    expect(maintenanceWindow(m(true, null, '2026-10-12T03:00:00Z'), now)).toMatchObject({ active: true });
    expect(maintenanceWindow(m(false, '2026-10-11T01:00:00Z', '2026-10-11T03:00:00Z'), now)).toBeNull();
    expect(maintenanceWindow(m(false, null, null), now)).toBeNull();
    expect(maintenanceWindow(page(), now)).toBeNull();
  });
});
