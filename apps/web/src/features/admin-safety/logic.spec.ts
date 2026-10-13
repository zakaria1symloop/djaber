import { describe, expect, it } from 'vitest';
import { decisionOffered, excerptTime, isOpenReport, periodRange, previousMonth, reportsApiQuery, reportTabCount, reportTabOf, reportTabQuery } from './logic';

const stats = { open: 4, over24h: 1, handled30d: 38, merchantBlocks7d: 12, merchantsReported30d: 3, blockedWords: 41, autoFiltered7d: 9, tabs: { todo: 4, customers: 2, merchants: 1, aiContent: 1, done: 38 } };

describe('ADM-11 tabs and query', () => {
  it('maps tabs and their presets', () => {
    expect(reportTabOf(null)).toBe('todo');
    expect(reportTabOf('ai')).toBe('ai');
    expect(reportTabQuery('todo')).toEqual({ status: ['open', 'reviewing'] });
    expect(reportTabQuery('customers')).toEqual({ type: ['customer', 'conversation'] });
    expect(reportTabQuery('done')).toEqual({ status: ['actioned', 'dismissed'] });
    expect(reportTabCount('ai', stats)).toBe(1);
    expect(reportTabCount('todo', undefined)).toBeNull();
  });
  it('turns the period into Algiers days and drops the non-API names', () => {
    const now = new Date('2026-10-13T10:00:00Z');
    expect(periodRange('7d', now)).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    expect(periodRange('24h', now)).toEqual({ from: '2026-10-13', to: '2026-10-13' });
    expect(periodRange('x', now)).toBeNull();
    expect(reportsApiQuery({ q: 'walid', sort: '-createdAt', period: '30d', page: 2, pageSize: 25, severity: ['high'] }, 'merchants', now)).toEqual({
      q: 'walid',
      page: 2,
      pageSize: 25,
      severity: ['high'],
      from: '2026-09-14',
      to: '2026-10-13',
      type: ['merchant'],
    });
  });
});

describe('ADM-11 treatment panel', () => {
  it('offers block / blacklist only for customers and conversations without descriptors', () => {
    expect(decisionOffered({ type: 'conversation', actions: [] }, 'platform_blacklist')).toEqual({ offered: true, enabled: true });
    expect(decisionOffered({ type: 'ai_message', actions: [] }, 'platform_blacklist').offered).toBe(false);
    expect(decisionOffered({ type: 'merchant', actions: [] }, 'reported_to_meta').offered).toBe(true);
    expect(decisionOffered({ type: 'ai_message', actions: [] }, 'dismissed').offered).toBe(true);
  });
  it('follows the server descriptors', () => {
    expect(decisionOffered({ type: 'customer', actions: [{ key: 'platform_blacklist', enabled: false, reasonCode: 'FORBIDDEN' }] as never }, 'platform_blacklist')).toEqual({ offered: true, enabled: false, reasonCode: 'FORBIDDEN' });
  });
  it('knows open reports, excerpt times and the default export month', () => {
    expect(isOpenReport({ status: 'reviewing' })).toBe(true);
    expect(isOpenReport({ status: 'dismissed' })).toBe(false);
    expect(excerptTime('2026-10-13T09:41:00Z')).toBe('10:41');
    expect(previousMonth(new Date('2026-10-13T10:00:00Z'))).toBe('2026-09');
    expect(previousMonth(new Date('2026-01-05T10:00:00Z'))).toBe('2025-12');
  });
});
