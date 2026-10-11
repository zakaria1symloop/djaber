// Emits to Socket.IO rooms from any process (API or worker) through Redis pub/sub.
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class WsEmitter implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly emitter: Emitter;
  constructor(config: ConfigService) {
    this.redis = new Redis(config.get('REDIS_URL'), { maxRetriesPerRequest: null });
    this.emitter = new Emitter(this.redis);
  }
  emit(room: string, event: string, payload: unknown) {
    this.emitter.of('/ws').to(room).emit(event, payload);
  }
  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
