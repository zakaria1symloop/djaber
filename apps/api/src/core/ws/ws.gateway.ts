// 03-events-and-jobs §2 — Socket.IO namespace `/ws`, rooms `user:<id>`, `ws:<workspaceId>`, `admin:platform`.
import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { prisma, TenantContext } from '@djaber/db';
import { TokenService } from '../auth/token.service';

@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class WsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly log = new Logger(WsGateway.name);
  @WebSocketServer() server!: Namespace;
  constructor(private readonly tokens: TokenService) {}

  afterInit(server: Namespace) {
    server.use(async (socket, next) => {
      try {
        const token = (socket.handshake.auth?.token ?? '') as string;
        const claims = await this.tokens.verifyAccess(token);
        // the workspace claim is trusted only if the membership still exists
        if (claims.wid && !claims.imp) {
          const m = await TenantContext.runSystem(() =>
            prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId: claims.wid!, userId: claims.sub } } }),
          );
          if (!m) return next(new Error('UNAUTHORIZED'));
        }
        socket.data.claims = claims;
        next();
      } catch (e) {
        this.log.warn({ err: String(e) }, 'ws handshake refused');
        next(new Error('UNAUTHORIZED'));
      }
    });
  }

  async handleConnection(socket: Socket) {
    const c = socket.data.claims as { sub: string; wid?: string; pr?: string; exp: number };
    await socket.join(`user:${c.sub}`);
    if (c.wid) await socket.join(`ws:${c.wid}`);
    if (c.pr && c.pr !== 'none') await socket.join('admin:platform');
    const ms = c.exp * 1000 - Date.now() - 60_000;
    const timer = setTimeout(() => socket.emit('auth.expiring', { expiresAt: new Date(c.exp * 1000).toISOString() }), Math.max(ms, 0));
    const kill = setTimeout(() => socket.disconnect(true), Math.max(c.exp * 1000 - Date.now(), 0) + 5_000);
    socket.on('disconnect', () => {
      clearTimeout(timer);
      clearTimeout(kill);
    });
  }

  /** The client refetches its queries on `resync`; the server only acknowledges with the current time. */
  @SubscribeMessage('resync')
  resync() {
    return { event: 'resync', data: { at: new Date().toISOString() } };
  }
}
