import { Controller, Get, Res } from '@nestjs/common';
import { rawPrisma } from '@djaber/db';
import { Public } from '../auth/decorators';
import { RawResponse } from '../http/envelope.interceptor';
import { RedisService } from '../redis/redis.provider';
import { StorageService } from '../storage/storage.service';

/** Liveness / readiness probes. Mounted outside the `/api/v1` prefix (see main.ts). */
@Controller()
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return new RawResponse({ status: 'ok', uptime: Math.round(process.uptime()) });
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: any) {
    const checks = {
      db: await rawPrisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis: await this.redis.client.ping().then((r) => r === 'PONG').catch(() => false),
      storage: await this.storage.ping(),
    };
    const ok = Object.values(checks).every(Boolean);
    if (!ok) res.status(503);
    return new RawResponse({ status: ok ? 'ok' : 'degraded', checks });
  }
}
