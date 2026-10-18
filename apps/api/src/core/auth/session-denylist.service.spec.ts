import { SessionDenylistService } from './session-denylist.service';

const fakeRedis = () => {
  const store = new Map<string, { v: string; ttl: number }>();
  const client = {
    multi: () => {
      const ops: [string, string, number][] = [];
      const m = { set: (k: string, v: string, _ex: string, ttl: number) => (ops.push([k, v, ttl]), m), exec: async () => ops.forEach(([k, v, ttl]) => store.set(k, { v, ttl })) };
      return m;
    },
    exists: async (k: string) => (store.has(k) ? 1 : 0),
  };
  return { store, redis: { client } as never };
};

describe('revoked sessions stop their access token at once', () => {
  const config = { get: () => 900 } as never;
  it('lists revoked families for one access-token lifetime (+60 s) and refuses them', async () => {
    const { store, redis } = fakeRedis();
    const svc = new SessionDenylistService(redis, config);
    await svc.deny(['fam-a', 'fam-a', '', 'fam-b']);
    expect([...store.keys()].sort()).toEqual(['auth:revoked-sid:fam-a', 'auth:revoked-sid:fam-b']);
    expect(store.get('auth:revoked-sid:fam-a')!.ttl).toBe(960);
    expect(await svc.isDenied('fam-a')).toBe(true);
    expect(await svc.isDenied('fam-c')).toBe(false);
    expect(await svc.isDenied(undefined)).toBe(false);
  });
  it('does nothing for an empty list', async () => {
    const { store, redis } = fakeRedis();
    await new SessionDenylistService(redis, config).deny([]);
    expect(store.size).toBe(0);
  });
});
