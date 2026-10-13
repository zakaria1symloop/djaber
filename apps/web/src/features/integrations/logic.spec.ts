import { getMessages } from '@djaber/shared';
import { describe, expect, it } from 'vitest';
import { formatMessage, type TFunction } from '@/lib/i18n';
import { algiersDay, deliveryResult, journalTime } from './logic';

const msgs = getMessages('fr');
const t = Object.assign((key: string, params?: Record<string, string | number>) => formatMessage('fr', msgs, key, params), { has: (k: string) => k in msgs }) as TFunction;
// 2026-10-13 12:00 in Algiers (UTC+1)
const NOW = new Date('2026-10-13T11:00:00Z');
const base = { responseCode: null, durationMs: null, attempt: 1, maxAttempts: 7, error: null, nextAttemptAt: null };

describe('integrations journal (API-03 deliveries log)', () => {
  it('prints the Algiers time today, "hier hh:mm" yesterday, the full date before', () => {
    expect(journalTime('2026-10-13T09:58:00Z', 'fr', t, NOW)).toBe('10:58');
    expect(journalTime('2026-10-12T17:03:00Z', 'fr', t, NOW)).toBe('hier 18:03');
    expect(journalTime('2026-10-01T08:00:00Z', 'fr', t, NOW)).toBe('01 oct. 2026 09:00');
    // 23:30 UTC on the 12th is already the 13th in Algiers
    expect(algiersDay(new Date('2026-10-12T23:30:00Z'))).toBe('2026-10-13');
  });

  it('formats every delivery status with its tone', () => {
    expect(deliveryResult({ ...base, status: 'success', responseCode: 200, durationMs: 142 }, t, 'fr', NOW)).toEqual({ text: '200 · 142 ms', tone: 'success' });
    expect(deliveryResult({ ...base, status: 'exhausted', responseCode: 502, attempt: 7 }, t, 'fr', NOW)).toEqual({ text: '502 · tentative 7/7', tone: 'danger' });
    expect(deliveryResult({ ...base, status: 'pending', attempt: 0 }, t, 'fr', NOW)).toEqual({ text: 'en attente', tone: 'neutral' });
    const retry = deliveryResult({ ...base, status: 'pending', responseCode: 502, attempt: 2, nextAttemptAt: '2026-10-13T13:05:00Z' }, t, 'fr', NOW);
    expect(retry).toEqual({ text: '502 · nouvel essai 14:05 · tentative 2/7', tone: 'warning' });
    expect(deliveryResult({ ...base, status: 'failed', error: 'timeout' }, t, 'fr', NOW).text).toBe('sans réponse · tentative 1/7');
  });
});
