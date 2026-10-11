'use client';
// Countdowns: rate-limit ("Réessayez dans 4:59"), resend cooldowns ("Renvoyer dans 0:58"), mfaToken expiry.
import { useEffect, useState } from 'react';
import { ApiError } from './api';

/** `299` → `4:59` (minutes are not padded, seconds are). */
export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Seconds left until `until` (epoch ms), never negative. */
export const secondsLeft = (until: number | null | undefined, now = Date.now()): number =>
  until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;

/** Seconds to wait from a 429 (`params.retryAfter`, filled from the Retry-After header by the client). */
export const retryAfterSeconds = (error: unknown, fallback = 60): number => {
  if (!(error instanceof ApiError)) return 0;
  if (error.status !== 429 && error.code !== 'RATE_LIMITED') return 0;
  const raw = Number(error.body.params?.retryAfter);
  return Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : fallback;
};

/** Seconds from now until an ISO instant (e.g. `InvitationDto.resendAvailableAt`). */
export const secondsUntilIso = (iso: string | null | undefined, now = Date.now()): number => {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.ceil((t - now) / 1000));
};

/** Ticks every second while the deadline is in the future. Returns the seconds left. */
export function useCountdown(until: number | null): number {
  const [left, setLeft] = useState(() => secondsLeft(until));
  useEffect(() => {
    setLeft(secondsLeft(until));
    if (!until || until <= Date.now()) return;
    const id = window.setInterval(() => {
      const s = secondsLeft(until);
      setLeft(s);
      if (s <= 0) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [until]);
  return left;
}

/** `[secondsLeft, start(seconds)]` — a restartable cooldown. */
export function useCooldown(initialSeconds = 0): [number, (seconds: number) => void] {
  const [until, setUntil] = useState<number | null>(() => (initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : null));
  const left = useCountdown(until);
  return [left, (seconds) => setUntil(seconds > 0 ? Date.now() + seconds * 1000 : null)];
}
