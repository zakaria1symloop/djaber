import { describe, expect, it } from 'vitest';
import { isOwnChangeRule, OWN_WRITE_WINDOW_MS, sessionIdOf } from './origin';

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('own vs foreign product changes (originSessionId, M11)', () => {
  it('reads the sid claim of the access token', () => {
    expect(sessionIdOf(`h.${b64url({ sub: 'u', sid: 'sess-1' })}.sig`)).toBe('sess-1');
    expect(sessionIdOf(`h.${b64url({ sub: 'u' })}.sig`)).toBeNull();
    expect(sessionIdOf('garbage')).toBeNull();
    expect(sessionIdOf(null)).toBeNull();
  });
  it('an event tagged with my session is mine, another session is foreign even right after my own write', () => {
    const now = 100_000;
    expect(isOwnChangeRule({ event: { origin: 'me', at: now - 10 }, mySid: 'me', msSinceWrite: 60_000, now })).toBe(true);
    expect(isOwnChangeRule({ event: { origin: 'other', at: now - 10 }, mySid: 'me', msSinceWrite: 500, now })).toBe(false);
  });
  it('a write of mine after the foreign event counts as mine (within the window)', () => {
    const now = 100_000;
    expect(isOwnChangeRule({ event: { origin: 'other', at: now - 3_000 }, mySid: 'me', msSinceWrite: 1_000, now })).toBe(true);
  });
  it('without a tagged event (worker, no event) the old 5 s window applies', () => {
    const now = 100_000;
    expect(isOwnChangeRule({ event: { origin: null, at: now }, mySid: 'me', msSinceWrite: OWN_WRITE_WINDOW_MS, now })).toBe(true);
    expect(isOwnChangeRule({ event: undefined, mySid: 'me', msSinceWrite: OWN_WRITE_WINDOW_MS + 1, now })).toBe(false);
    expect(isOwnChangeRule({ event: { origin: 'other', at: now }, mySid: null, msSinceWrite: 10, now })).toBe(true);
  });
});
