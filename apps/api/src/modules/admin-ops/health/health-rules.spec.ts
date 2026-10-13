// ADM-14 rules without a database: queue state, p95, DLQ masking, uptime, Meta ack histogram, send limiter window,
// job deferral, internal-network check of /metrics.
import { DelayedError } from 'bullmq';
import { p95FromBuckets } from '../../../core/metrics/metrics.service';
import { deferJob, takeSlot, throttleJob } from '../../../core/queue/throttle';
import { isPrivateIp } from './health.controllers';
import { maskJobData, p95, queueState } from './jobs-health.service';
import { coveredMs, uptime90d } from './status-page.service';

const fakeRedis = () => {
  const store = new Map<string, number>();
  return {
    store,
    incr: async (k: string) => {
      const n = (store.get(k) ?? 0) + 1;
      store.set(k, n);
      return n;
    },
    expire: async () => 1,
  };
};

describe('queue health', () => {
  it('p95 of durations', () => {
    expect(p95([])).toBe(0);
    expect(p95([5])).toBe(5);
    expect(p95(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(95);
  });

  it('03-events §3.2 state: paused > incident > warning (failed/h > 10 or p95 > 3× baseline) > ok', () => {
    const base = { paused: false, incident: false, failedLastHour: 0, p95Ms: 100, baselineMs: 1000 };
    expect(queueState(base)).toBe('ok');
    expect(queueState({ ...base, failedLastHour: 11 })).toBe('warning');
    expect(queueState({ ...base, failedLastHour: 10 })).toBe('ok');
    expect(queueState({ ...base, p95Ms: 3001 })).toBe('warning');
    expect(queueState({ ...base, p95Ms: 3001, incident: true })).toBe('incident');
    expect(queueState({ ...base, incident: true, paused: true })).toBe('paused');
  });

  it('DLQ payloads: secrets redacted, phones masked', () => {
    expect(maskJobData({ messageId: 'm1', accessToken: 'abc', text: 'appelle 0555123456 svp', nested: { phone: '+213661234567' } })).toEqual({
      messageId: 'm1',
      accessToken: '[redacted]',
      text: 'appelle 05•• •• •• 56 svp',
      nested: { phone: '+2•• •• •• 67' },
    });
  });
});

describe('status page uptime', () => {
  const D = 86400_000;
  const now = Date.UTC(2026, 9, 13);
  it('merges overlapping intervals and clips to the window', () => {
    expect(coveredMs([{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 30, end: 40 }], 0, 100)).toBe(30);
    expect(coveredMs([{ start: -50, end: 10 }], 0, 100)).toBe(10);
  });
  it('OPS-06: 90-day uptime from major / critical incidents of the component only', () => {
    const inc = (h: number, severity: 'minor' | 'major' | 'critical', components = ['ai_agent']) => ({ components, severity, startedAt: new Date(now - 2 * D), resolvedAt: new Date(now - 2 * D + h * 3600_000) });
    expect(uptime90d([], 'ai_agent', now)).toBe(100);
    expect(uptime90d([inc(21.6, 'major')], 'ai_agent', now)).toBe(99);
    expect(uptime90d([inc(21.6, 'minor')], 'ai_agent', now)).toBe(100);
    expect(uptime90d([inc(21.6, 'critical', ['payment'])], 'ai_agent', now)).toBe(100);
  });
});

describe('Meta webhook ack histogram', () => {
  it('p95 = upper bound of the bucket holding the 95th percentile', () => {
    expect(p95FromBuckets([0, 0, 0], [100, 250])).toBe(0);
    expect(p95FromBuckets([96, 4, 0], [100, 250])).toBe(100);
    expect(p95FromBuckets([90, 10, 0], [100, 250])).toBe(250);
    expect(p95FromBuckets([0, 0, 5], [100, 250])).toBe(500);
  });
});

describe('throttling', () => {
  it('per-channel send limiter: 10 per second window, then a retry delay inside the second', async () => {
    const r = fakeRedis();
    const now = 1_000_000_250;
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await takeSlot(r as never, 'meta-send:ch1', 10, now));
    expect(results.slice(0, 10).every((x) => x.ok)).toBe(true);
    expect(results[10]).toEqual({ ok: false, retryInMs: 760 });
    expect((await takeSlot(r as never, 'meta-send:ch2', 10, now)).ok).toBe(true);
    expect((await takeSlot(r as never, 'meta-send:ch1', 10, now + 1000)).ok).toBe(true);
  });

  it('a live BullMQ job is moved back to delayed (DelayedError, no attempt consumed); a plain object is not', async () => {
    const moved: number[] = [];
    const job = { token: 't1', moveToDelayed: async (ts: number) => void moved.push(ts) };
    await expect(deferJob(job, 2000)).rejects.toBeInstanceOf(DelayedError);
    expect(moved).toHaveLength(1);
    expect(await deferJob({ attemptsMade: 0 }, 2000)).toBe(false);
  });

  it('throttleJob waits in-process outside BullMQ until a slot is free', async () => {
    let calls = 0;
    await throttleJob(undefined, async () => ({ ok: ++calls >= 3, retryInMs: 5 }));
    expect(calls).toBe(3);
  });
});

describe('/metrics network check', () => {
  it.each([
    ['127.0.0.1', true],
    ['::1', true],
    ['::ffff:192.168.100.36', true],
    ['10.2.3.4', true],
    ['172.20.0.1', true],
    ['172.40.0.1', false],
    ['8.8.8.8', false],
    [undefined, false],
  ])('%s ⇒ %s', (ip, ok) => expect(isPrivateIp(ip as string | undefined)).toBe(ok));
});
