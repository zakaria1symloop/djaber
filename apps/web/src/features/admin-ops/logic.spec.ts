import { describe, expect, it } from 'vitest';
import type { QueueHealthDto } from '@djaber/shared';
import { backlogQueue, cannedQuery, compareVersions, durationParams, durationParts, flagOn, flagTarget, insertCanned, isForceUpdate, minAboveUnpublished, p95, queueState, ticketSla, ticketTabQuery } from './logic';

const queue = (o: Partial<QueueHealthDto>): QueueHealthDto => ({ name: 'q', waiting: 0, active: 0, failed: 0, delayed: 0, completedLastHour: 10, p95Ms: 400, state: 'ok', note: null, pausable: true, ...o });

describe('durations (SLA pills "DÉPASSÉ DE 20 MIN", "3 H 25 RESTANTES")', () => {
  it('minutes under one hour, whole hours, hours + zero-padded minutes', () => {
    expect(durationParts(20)).toEqual({ kind: 'min', m: 20 });
    expect(durationParts(-120)).toEqual({ kind: 'h', h: 2 });
    expect(durationParts(205)).toEqual({ kind: 'hm', h: 3, m: 25 });
    expect(durationParams(durationParts(65))).toEqual({ h: 1, m: '05' });
  });
});

describe('ticket tabs and SLA (HELP-05, AT-HELP-04)', () => {
  it('maps every tab to the API query', () => {
    expect(ticketTabQuery('open')).toEqual({ status: 'open' });
    expect(ticketTabQuery('mine')).toEqual({ assigneeId: 'me', status: 'open,pending_customer' });
    expect(ticketTabQuery('pending')).toEqual({ status: 'pending_customer' });
    expect(ticketTabQuery('resolved')).toEqual({ status: 'resolved,closed' });
    expect(ticketTabQuery('all')).toEqual({});
  });
  it('breached / remaining / waiting / done', () => {
    expect(ticketSla({ status: 'open', slaBreached: true, slaRemainingMin: -20 })).toEqual({ kind: 'breached', minutes: 20 });
    expect(ticketSla({ status: 'open', slaBreached: false, slaRemainingMin: 205 })).toEqual({ kind: 'remaining', minutes: 205 });
    expect(ticketSla({ status: 'pending_customer', slaBreached: true, slaRemainingMin: -5 }).kind).toBe('waiting');
    expect(ticketSla({ status: 'resolved', slaBreached: false, slaRemainingMin: 0 }).kind).toBe('done');
  });
});

describe('canned replies in the composer', () => {
  it('finds the "/partial" before the caret', () => {
    expect(cannedQuery('Bonjour /she')).toBe('/she');
    expect(cannedQuery('/meta')).toBe('/meta');
    expect(cannedQuery('a/b')).toBeNull();
    expect(cannedQuery('Bonjour')).toBeNull();
  });
  it('replaces the partial key by the body and keeps the rest', () => {
    expect(insertCanned('Bonjour /she', 12, 'Reconnectez Google.')).toBe('Bonjour Reconnectez Google.');
    expect(insertCanned('/me fin', 3, 'X')).toBe('X fin');
  });
});

describe('queues (OPS-01)', () => {
  it('state pill and p95 cell', () => {
    expect(queueState(queue({ state: 'paused' }))).toBe('paused');
    expect(queueState(queue({ state: 'warning' }))).toBe('warning');
    expect(p95(queue({ p95Ms: 400 }))).toEqual({ kind: 's', value: 0.4 });
    expect(p95(queue({ p95Ms: 48_000 }))).toEqual({ kind: 's', value: 48 });
    expect(p95(queue({ p95Ms: 840_000 }))).toEqual({ kind: 'min', value: 14 });
    expect(p95(queue({ p95Ms: 0, completedLastHour: 0 }))).toEqual({ kind: 'none' });
  });
  it('backlog KPI = the non-OK queue with the largest backlog', () => {
    const q = [queue({ name: 'ai-reply', waiting: 41 }), queue({ name: 'sheets-sync', waiting: 1240, state: 'incident' }), queue({ name: 'order-courier-sync', waiting: 3, state: 'warning' })];
    expect(backlogQueue(q)?.name).toBe('sheets-sync');
    expect(backlogQueue([queue({ name: 'a', waiting: 2 }), queue({ name: 'b', waiting: 5 })])?.name).toBe('b');
    expect(backlogQueue([])).toBeNull();
  });
});

describe('app versions & flags (PFS-01/02, AT-PFS-02)', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('2.10.0', '2.9.9')).toBe(1);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
    expect(compareVersions('2.0.9', '2.1.0')).toBe(-1);
  });
  it('raising minVersion is a force update; above an unpublished store version is blocked', () => {
    expect(isForceUpdate({ minVersion: '2.1.0' }, '2.2.0')).toBe(true);
    expect(isForceUpdate({ minVersion: '2.1.0' }, '2.1.0')).toBe(false);
    expect(isForceUpdate({ minVersion: '2.1.0' }, '2.x')).toBe(false);
    expect(minAboveUnpublished({ storeStatus: 'in_review', latestVersion: '2.3.1' }, '2.4.0')).toBe(true);
    expect(minAboveUnpublished({ storeStatus: 'published', latestVersion: '2.3.1' }, '2.4.0')).toBe(false);
  });
  it('flag target and switches', () => {
    expect(flagTarget({ webPct: 20, mobilePct: 0, targeting: { planSlugs: ['pro'] } })).toEqual({ pct: 20, plans: ['pro'], workspaces: 0, abTest: false });
    expect(flagTarget({ webPct: 0, mobilePct: 0, targeting: { workspaceIds: ['a', 'b', 'c'] } }).workspaces).toBe(3);
    expect(flagOn({ isActive: true }, 50)).toBe(true);
    expect(flagOn({ isActive: false }, 100)).toBe(false);
    expect(flagOn({ isActive: true }, 0)).toBe(false);
  });
});
