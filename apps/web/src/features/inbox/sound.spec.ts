import { describe, expect, it } from 'vitest';
import { shouldRing, SOUND_MIN_GAP_MS } from './sound';

describe('sound on a new customer message (User.prefs.soundOnMessage)', () => {
  it('rings for an inbound message when the preference is on', () => {
    expect(shouldRing({ enabled: true, direction: 'in', lastAt: 0, now: 10_000 })).toBe(true);
  });
  it('stays silent when off, for our own replies, or inside the burst window', () => {
    expect(shouldRing({ enabled: false, direction: 'in', lastAt: 0, now: 10_000 })).toBe(false);
    expect(shouldRing({ enabled: true, direction: 'out', lastAt: 0, now: 10_000 })).toBe(false);
    expect(shouldRing({ enabled: true, direction: undefined, lastAt: 0, now: 10_000 })).toBe(false);
    expect(shouldRing({ enabled: true, direction: 'in', lastAt: 10_000, now: 10_000 + SOUND_MIN_GAP_MS - 1 })).toBe(false);
    expect(shouldRing({ enabled: true, direction: 'in', lastAt: 10_000, now: 10_000 + SOUND_MIN_GAP_MS })).toBe(true);
  });
});
