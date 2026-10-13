'use client';
// WsProvider (02-next-route-map §2.1): one Socket.IO connection to the `/ws` namespace with the access token
// (rooms `ws:<workspaceId>` and `user:<userId>` are joined by the server). `auth.expiring` ⇒ refresh + reconnect;
// reconnect ⇒ `resync { since }` + refetch of the active queries; while disconnected the shell shows the
// "reconnexion…" pill and the active queries are refetched every 15 s (polling fallback).
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, apiSession, refreshSession } from './api';
import { impersonation } from './impersonation';
import { useSession } from './session';

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';
type Handler = (payload: unknown) => void;
type Bus = { on: (event: string, handler: Handler) => () => void; /** client → server event (`typing`), dropped while disconnected */ emit: (event: string, payload: unknown) => void };

const Ctx = createContext<{ status: WsStatus; bus: Bus }>({ status: 'idle', bus: { on: () => () => {}, emit: () => {} } });
export const POLL_FALLBACK_MS = 15_000;
const HANDSHAKE_RETRY_MS = 30_000;

export function WsProvider({ children, admin }: { children: ReactNode; /** admin shell: connects without a workspace (room `admin:platform`) */ admin?: boolean }) {
  const qc = useQueryClient();
  const { status: sessionStatus, workspaceId } = useSession();
  const [status, setStatus] = useState<WsStatus>('idle');
  const handlers = useRef(new Map<string, Set<Handler>>());
  const socketRef = useRef<Socket | null>(null);

  const bus = useMemo<Bus>(() => {
    const dispatch = (event: string) => (payload: unknown) => handlers.current.get(event)?.forEach((h) => h(payload));
    return {
      on(event, handler) {
        let set = handlers.current.get(event);
        if (!set) {
          set = new Set();
          handlers.current.set(event, set);
          socketRef.current?.on(event, dispatch(event));
        }
        set.add(handler);
        return () => void set.delete(handler);
      },
      emit(event, payload) {
        if (socketRef.current?.connected) socketRef.current.emit(event, payload);
      },
    };
  }, []);

  const enabled = sessionStatus === 'authenticated' && (!!workspaceId || !!admin);
  useEffect(() => {
    if (!enabled) return;
    let lostAt: string | null = null;
    let refreshed = false;
    const socket = io(`${API_URL}/ws`, {
      // read at every (re)connection: the token is rotated every 15 min
      auth: (cb) => cb({ token: impersonation.get()?.token ?? apiSession.get().accessToken }),
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;
    setStatus('connecting');
    const registered = handlers.current;
    for (const event of registered.keys()) socket.on(event, (payload: unknown) => registered.get(event)?.forEach((h) => h(payload)));

    const reconnect = async () => {
      await refreshSession();
      socket.disconnect();
      socket.connect();
    };
    socket.on('connect', () => {
      refreshed = false;
      setStatus('connected');
      if (lostAt) {
        socket.emit('resync', { since: lostAt });
        void qc.invalidateQueries({ type: 'active' });
        lostAt = null;
      }
    });
    socket.on('disconnect', (reason) => {
      lostAt ??= new Date().toISOString();
      setStatus('reconnecting');
      // the server closes the socket when the token is refused: take a fresh one, once
      if (reason === 'io server disconnect' && !refreshed) {
        refreshed = true;
        void reconnect();
      }
    });
    let retry: number | undefined;
    socket.on('connect_error', () => {
      lostAt ??= new Date().toISOString();
      setStatus('reconnecting');
      // a handshake refused by the server (token) is not retried by socket.io itself: try again with a fresh token
      if (!socket.active) {
        window.clearTimeout(retry);
        retry = window.setTimeout(() => void reconnect(), HANDSHAKE_RETRY_MS);
      }
    });
    socket.on('auth.expiring', () => void reconnect());
    return () => {
      window.clearTimeout(retry);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setStatus('idle');
    };
  }, [enabled, workspaceId, qc]);

  // polling fallback while the socket is down
  useEffect(() => {
    if (status !== 'reconnecting') return;
    const id = window.setInterval(() => void qc.invalidateQueries({ type: 'active' }), POLL_FALLBACK_MS);
    return () => window.clearInterval(id);
  }, [status, qc]);

  const value = useMemo(() => ({ status, bus }), [status, bus]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWsStatus = (): WsStatus => useContext(Ctx).status;

/** Sends a client event (`typing { conversationId }`); a no-op while the socket is down. */
export const useWsEmit = () => useContext(Ctx).bus.emit;

/** Subscribes to a server event for the lifetime of the component (`product.updated`, `job.updated`, …). */
export function useWsEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const { bus } = useContext(Ctx);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => bus.on(event, (p) => ref.current(p as T)), [bus, event]);
}
