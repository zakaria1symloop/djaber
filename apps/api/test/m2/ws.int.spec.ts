// Real-time channel: handshake with the access token, rooms, delivery through the Redis emitter (03-events-and-jobs §2).
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { prisma, TenantContext } from '@djaber/db';
import { WsEmitter } from '../../src/core/ws/ws.emitter';
import { asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';

let app: TestApp;
let url: string;
const sockets: Socket[] = [];
beforeAll(async () => {
  app = await createTestApp();
  await app.app.listen(0);
  url = `http://127.0.0.1:${(app.app.getHttpServer().address() as AddressInfo).port}/ws`;
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await app.close();
});

const connect = (token: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
  });

it('accepts a valid access token and delivers workspace and user events only to their rooms', async () => {
  const a = await asOwner(app);
  const b = await asOwner(app);
  const sa = await connect(a.token);
  const sb = await connect(b.token);
  const gotA: unknown[] = [];
  const gotB: unknown[] = [];
  sa.on('product.updated', (p) => gotA.push(p));
  sa.on('notification.created', (p) => gotA.push(p));
  sb.on('product.updated', (p) => gotB.push(p));
  const emitter = app.app.get(WsEmitter);
  emitter.emit(`ws:${a.workspaceId}`, 'product.updated', { product: { id: 'p1' } });
  emitter.emit(`user:${a.userId}`, 'notification.created', { unreadCount: 1 });
  await new Promise((r) => setTimeout(r, 400));
  expect(gotA).toEqual([{ product: { id: 'p1' } }, { unreadCount: 1 }]);
  expect(gotB).toEqual([]);
});

it('refuses a missing or forged token', async () => {
  await expect(connect('')).rejects.toThrow('UNAUTHORIZED');
  await expect(connect('not-a-token')).rejects.toThrow('UNAUTHORIZED');
});

it('TenantContext keeps the scope for a query returned without await (lazy Prisma promise)', async () => {
  const a = await asOwner(app);
  const rows = await TenantContext.runSystem(() => prisma.membership.findMany({ where: { userId: a.userId } }));
  expect(rows).toHaveLength(1);
  const scoped = await TenantContext.runAs(a.workspaceId, () => prisma.membership.findMany());
  expect(scoped.map((m) => m.userId)).toEqual([a.userId]);
});
