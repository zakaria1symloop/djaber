// Own vs foreign changes (M2 carry-over closed in M11): every `product.updated` caused by an HTTP request carries
// `originSessionId` = the JWT `sid` of that request. A tab compares it with the `sid` of its own access token to know
// whether a fresh server version is its own write (rebased into the form) or someone else's (conflict on save).
// Events without an origin (workers: image re-encode, moderation pre-screen) keep the old rule: a change arriving within
// a few seconds of this tab's own write is treated as its own.
import { apiSession, msSinceOwnWrite } from './api';

/** Fallback window for events without `originSessionId`. */
export const OWN_WRITE_WINDOW_MS = 5_000;

/** `sid` claim of a JWT access token (no signature check: only used to recognise this tab's own events). */
export function sessionIdOf(token: string | null | undefined): string | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
    const claims = JSON.parse(json) as { sid?: unknown };
    return typeof claims.sid === 'string' && claims.sid ? claims.sid : null;
  } catch {
    return null;
  }
}

/** Session id of this tab (rotating access tokens keep the same `sid`). */
export const currentSessionId = () => sessionIdOf(apiSession.get().accessToken);

type Origin = { origin: string | null; at: number };
const lastOrigin = new Map<string, Origin>();

/** Called by the WS bridge for every `product.updated { id, originSessionId? }`. */
export function recordOrigin(resourceId: string, originSessionId: unknown, at = Date.now()) {
  lastOrigin.set(resourceId, { origin: typeof originSessionId === 'string' && originSessionId ? originSessionId : null, at });
  if (lastOrigin.size > 500) lastOrigin.delete(lastOrigin.keys().next().value!);
}

/**
 * Pure rule: is the latest server version of a resource this tab's own change?
 * - last event tagged with this session ⇒ own; tagged with another session ⇒ foreign (unless this tab wrote after it);
 * - no tagged event (worker, or no event yet) ⇒ own only within `OWN_WRITE_WINDOW_MS` of this tab's last write.
 */
export function isOwnChangeRule(o: { event: Origin | undefined; mySid: string | null; msSinceWrite: number; now: number }): boolean {
  const { event, mySid, msSinceWrite, now } = o;
  if (event?.origin && mySid) {
    if (event.origin === mySid) return true;
    // a write of this tab sent after that foreign event: its own answer is what the form sees now
    return msSinceWrite < now - event.at && msSinceWrite <= OWN_WRITE_WINDOW_MS;
  }
  return msSinceWrite <= OWN_WRITE_WINDOW_MS;
}

export const isOwnChange = (resourceId: string | null | undefined): boolean =>
  isOwnChangeRule({ event: resourceId ? lastOrigin.get(resourceId) : undefined, mySid: currentSessionId(), msSinceWrite: msSinceOwnWrite(), now: Date.now() });
