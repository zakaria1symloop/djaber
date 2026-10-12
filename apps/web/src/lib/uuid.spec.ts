import { describe, expect, it, vi } from 'vitest';
import { uuid } from './uuid';

describe('uuid (works on plain HTTP over the network)', () => {
  it('returns RFC 4122 v4 ids without crypto.randomUUID', () => {
    vi.stubGlobal('isSecureContext', false);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const id = uuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      seen.add(id);
    }
    expect(seen.size).toBe(200);
    vi.unstubAllGlobals();
  });
});
