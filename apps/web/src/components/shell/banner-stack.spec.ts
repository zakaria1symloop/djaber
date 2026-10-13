import { describe, expect, it } from 'vitest';
import { pickBanner, type ShellBanner } from './banner-stack';

const b = (id: ShellBanner['id']): ShellBanner => ({ id, tone: 'info', content: id });

describe('banner priority (02-next-route-map §2.1)', () => {
  it('shows one banner: the highest priority', () => {
    expect(pickBanner([b('announcement'), b('credits80'), b('suspended')])?.id).toBe('suspended');
    expect(pickBanner([b('emailUnverified'), b('planExpired'), b('credits100')])?.id).toBe('credits100');
    expect(pickBanner([b('offline'), b('readOnly')])?.id).toBe('readOnly');
    expect(pickBanner([b('maintenance'), b('suspended')])?.id).toBe('maintenance');
    expect(pickBanner([])).toBeUndefined();
    // M9: the unpaid-invoice banner sits with "plan expiré", above the 80 % and "plan expire" banners
    expect(pickBanner([b('planExpiring'), b('credits80'), b('dunning')])?.id).toBe('dunning');
    expect(pickBanner([b('dunning'), b('planExpired')])?.id).toBe('planExpired');
  });
});
