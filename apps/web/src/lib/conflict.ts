import { ApiError } from './api';

/** `409 CONFLICT` of a versioned PATCH (api-contract §1.8): `details.current` holds the fresh resource. */
export const conflictOf = <T,>(e: unknown): { current: T | null; changedBy: string; changedAt: string | null } | null => {
  if (!(e instanceof ApiError) || e.status !== 409 || e.code !== 'CONFLICT') return null;
  const d = (e.body.details ?? {}) as { current?: T; changedBy?: string | { firstName?: string; lastName?: string }; changedAt?: string };
  const by = typeof d.changedBy === 'string' ? d.changedBy : [d.changedBy?.firstName, d.changedBy?.lastName].filter(Boolean).join(' ');
  return { current: d.current ?? null, changedBy: by, changedAt: d.changedAt ?? null };
};
