'use client';
// Read-only impersonation (D21-bis, api-contract §1.2): `POST /admin/impersonation/sessions` returns `{ sessionId, token,
// expiresAt }`; while the session is active every request carries `Authorization: Bearer <token>` +
// `X-Impersonation-Session: <sessionId>` and the target workspace id. The token lives in memory only (like the access
// token): a reload ends the view on this tab (the server session expires by itself after 30 min).
import { useSyncExternalStore } from 'react';

export type Impersonation = { sessionId: string; token: string; expiresAt: string; workspaceId: string; workspaceName: string };
export type ImpersonationEvent = 'changed' | 'expired' | 'forbidden';

let current: Impersonation | null = null;
let expired = false;
const listeners = new Set<(e: ImpersonationEvent) => void>();
const emit = (e: ImpersonationEvent) => listeners.forEach((l) => l(e));

export const impersonation = {
  get: () => current,
  /** true once the server answered `401 ADMIN_IMPERSONATION_EXPIRED` (or the clock passed `expiresAt`) */
  isExpired: () => expired,
  start(s: Impersonation) {
    current = s;
    expired = false;
    emit('changed');
  },
  /** drops the session locally (the caller ends it on the server with the admin's own token) */
  clear() {
    current = null;
    expired = false;
    emit('changed');
  },
  markExpired() {
    if (!current || expired) return;
    expired = true;
    emit('expired');
    emit('changed');
  },
  forbidden: () => emit('forbidden'),
  on(fn: (e: ImpersonationEvent) => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

const subscribe = (cb: () => void) => impersonation.on((e) => e === 'changed' && cb());
type Snapshot = { session: Impersonation | null; expired: boolean };
let snap: Snapshot = { session: null, expired: false };
const read = (): Snapshot => {
  if (snap.session !== current || snap.expired !== expired) snap = { session: current, expired };
  return snap;
};
const SERVER: Snapshot = { session: null, expired: false };

/** Current impersonation session of this tab (re-renders on start / stop / expiry). */
export const useImpersonation = (): Snapshot => useSyncExternalStore(subscribe, read, () => SERVER);

/** Whole minutes left before `expiresAt` (never negative). */
export const minutesLeft = (expiresAt: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
