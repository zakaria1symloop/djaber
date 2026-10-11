import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/** Socket.IO adapter backed by Redis so several API instances (and the worker emitter) share rooms. */
export class RedisIoAdapter extends IoAdapter {
  private pub?: Redis;
  private sub?: Redis;
  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
    private readonly origins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    this.pub = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
    this.sub = this.pub.duplicate();
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
    });
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  async close() {
    await this.pub?.quit().catch(() => undefined);
    await this.sub?.quit().catch(() => undefined);
  }
}
