// Throughput limits of the queue processors (03-events §3): per-channel Meta send limiter (10 / s) and per-workspace
// `ai-reply` concurrency cap (2). BullMQ OSS has no group limiter, so both live in Redis (shared by every worker process).
// A throttled job is moved back to `delayed` with its lock token (`DelayedError`): no attempt is consumed. Without a real
// BullMQ job (tests that call handlers directly) the helpers wait in-process instead.
import { DelayedError, type Job } from 'bullmq';
import type Redis from 'ioredis';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fixed one-second window: true when this call fits in the `limit` of the current second of `key`. */
export const takeSlot = async (redis: Redis, key: string, limit: number, now = Date.now()): Promise<{ ok: boolean; retryInMs: number }> => {
  const sec = Math.floor(now / 1000);
  const k = `rl:${key}:${sec}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 3);
  return n <= limit ? { ok: true, retryInMs: 0 } : { ok: false, retryInMs: 1000 - (now % 1000) + 10 };
};

// KEYS[1] = holder set; ARGV = now, ttlMs, member, cap. Expired holders (crashed workers) are dropped first.
const ACQUIRE = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local exp = tonumber(ARGV[1]) + tonumber(ARGV[2])
if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
  redis.call('ZADD', KEYS[1], exp, ARGV[3])
  return 1
end
if redis.call('ZCARD', KEYS[1]) < tonumber(ARGV[4]) then
  redis.call('ZADD', KEYS[1], exp, ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0`;

/** Counting semaphore with TTL safety: at most `cap` holders of `key`; a holder older than `ttlMs` no longer counts. */
export const acquireSemaphore = async (redis: Redis, key: string, member: string, cap: number, ttlMs: number, now = Date.now()): Promise<boolean> =>
  (await redis.eval(ACQUIRE, 1, `sem:${key}`, String(now), String(ttlMs), member, String(cap))) === 1;

export const releaseSemaphore = async (redis: Redis, key: string, member: string) => {
  await redis.zrem(`sem:${key}`, member).catch(() => undefined);
};

type DeferrableJob = Pick<Job, 'moveToDelayed'> & { token?: string };
const isDeferrable = (job: unknown): job is DeferrableJob => !!job && typeof (job as DeferrableJob).moveToDelayed === 'function' && typeof (job as DeferrableJob).token === 'string';

/**
 * Re-delays a BullMQ job by `ms` without consuming an attempt (throws `DelayedError`, which the worker treats as
 * "moved", not failed). Returns false when `job` is not a live BullMQ job: the caller then waits in-process.
 */
export const deferJob = async (job: unknown, ms: number): Promise<false> => {
  if (isDeferrable(job)) {
    await job.moveToDelayed(Date.now() + ms, job.token);
    throw new DelayedError();
  }
  return false;
};

/** Waits for a slot: defers the live job, or sleeps (bounded) when called outside BullMQ. */
export const throttleJob = async (job: unknown, attempt: () => Promise<{ ok: boolean; retryInMs: number }>, maxWaitMs = 30_000) => {
  const started = Date.now();
  for (;;) {
    const r = await attempt();
    if (r.ok) return;
    await deferJob(job, r.retryInMs);
    if (Date.now() - started > maxWaitMs) return;
    await sleep(r.retryInMs);
  }
};

/** Meta send limiter (03-events §3 `outbox / meta-send`: 10 / s per channel). */
export const META_SEND_PER_CHANNEL_RPS = 10;
/** `ai-reply` concurrency cap per workspace (03-events §3: "per-workspace cap 2"). */
export const AI_REPLY_WORKSPACE_CAP = 2;
/** Holder TTL of an `ai-reply` slot: longer than a run budget, shorter than the run reaper (5 min). */
export const AI_REPLY_SLOT_TTL_MS = 4 * 60_000;
export const AI_REPLY_RETRY_MS = 2000;
