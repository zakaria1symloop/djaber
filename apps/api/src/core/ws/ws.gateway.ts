// 03-events-and-jobs §2 — Socket.IO namespace `/ws`, rooms `user:<id>`, `ws:<workspaceId>`, `admin:platform`.
// Client → server: `resync { since }` (missed rows after a reconnection) and `typing { conversationId }` (relayed to the
// other members of the workspace room as `conversation.typing`, never forwarded to Meta).
import { Logger, Optional } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { prisma, TenantContext } from '@djaber/db';
import type { ConversationHead, OrderSummary } from '@djaber/shared';
import { conversationHead } from '../../modules/messaging/messaging.presenter';
import { SafetyService } from '../../modules/messaging/safety.service';
import { orderSummary } from '../../modules/orders/order.presenter';
import { TokenService } from '../auth/token.service';

/** 03-events §2: at most 200 rows of each kind in a `resync` answer. */
export const RESYNC_MAX_ROWS = 200;
/** A typing signal of the same member on the same conversation is relayed at most once per 2 s. */
const TYPING_THROTTLE_MS = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Claims = { sub: string; wid?: string; pr?: string; exp: number };
export type ResyncPayload = { at: string; since: string | null; conversations: ConversationHead[]; orders: OrderSummary[]; notificationsUnread: number };

@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class WsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly log = new Logger(WsGateway.name);
  @WebSocketServer() server!: Namespace;
  constructor(
    private readonly tokens: TokenService,
    @Optional() private readonly safety?: SafetyService,
  ) {}

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
    const c = socket.data.claims as Claims;
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

  /**
   * `resync { since }` → `resync { conversations, orders, notificationsUnread }`: the rows of the socket's workspace
   * changed after `since` (≤ 200 each, newest first, same shapes as `conversation.updated` / `order.updated`) and the
   * member's unread notification count. Without a valid `since` (or without a workspace) the lists are empty.
   */
  @SubscribeMessage('resync')
  async resync(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ event: 'resync'; data: ResyncPayload }> {
    return { event: 'resync', data: await this.resyncData(socket.data.claims as Claims | undefined, body) };
  }

  async resyncData(claims: Claims | undefined, body: unknown): Promise<ResyncPayload> {
    const at = new Date().toISOString();
    const raw = body && typeof body === 'object' ? (body as { since?: unknown }).since : undefined;
    const since = typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : null;
    const empty: ResyncPayload = { at, since: since?.toISOString() ?? null, conversations: [], orders: [], notificationsUnread: 0 };
    if (!claims?.sub || !claims.wid) return empty;
    const workspaceId = claims.wid;
    return TenantContext.runAs(workspaceId, async () => {
      const [conversations, orders, notificationsUnread, index] = await Promise.all([
        since ? prisma.conversation.findMany({ where: { updatedAt: { gt: since }, deletedAt: null }, include: { client: { select: { phone: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: RESYNC_MAX_ROWS }) : [],
        since ? prisma.order.findMany({ where: { updatedAt: { gt: since } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: RESYNC_MAX_ROWS }) : [],
        prisma.notification.count({ where: { userId: claims.sub, readAt: null, OR: [{ workspaceId }, { workspaceId: null }] } }),
        since && this.safety ? this.safety.index() : null,
      ]);
      return {
        ...empty,
        conversations: conversations.map((c) => conversationHead(c, index?.has(c, c.client?.phone) ?? false)),
        orders: orders.map(orderSummary),
        notificationsUnread,
      };
    });
  }

  private readonly lastTyping = new Map<string, number>();

  /**
   * `typing { conversationId }` → `conversation.typing { conversationId, userId, at }` to the other sockets of the
   * workspace room (the sender excluded). Unknown, malformed or cross-workspace ids are ignored silently.
   */
  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<void> {
    const c = socket.data.claims as Claims | undefined;
    const conversationId = body && typeof body === 'object' ? (body as { conversationId?: unknown }).conversationId : undefined;
    if (!c?.wid || typeof conversationId !== 'string' || !UUID.test(conversationId)) return;
    const key = `${socket.id}:${conversationId}`;
    const now = Date.now();
    if (now - (this.lastTyping.get(key) ?? 0) < TYPING_THROTTLE_MS) return;
    this.lastTyping.set(key, now);
    if (this.lastTyping.size > 10_000) this.lastTyping.clear();
    const exists = await TenantContext.runAs(c.wid, () => prisma.conversation.findFirst({ where: { id: conversationId, deletedAt: null }, select: { id: true } }));
    if (!exists) return;
    socket.to(`ws:${c.wid}`).emit('conversation.typing', { conversationId, userId: c.sub, at: new Date(now).toISOString() });
  }
}
