// ADM-14 (06 §8.11 "Jobs & health", §9: read every platform role; write super_admin; replay of one failed job super_admin
// + support), the public status page data (06 §12, `@Public()`), and the Prometheus scrape endpoint (internal only).
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import {
  FailedJobQuerySchema,
  IncidentCreateSchema,
  IncidentPatchSchema,
  IncidentResolveSchema,
  IncidentsQuerySchema,
  IncidentUpdateSchema,
  QueueFailedQuerySchema,
  QueueRunNowSchema,
  StatusSubscribeSchema,
} from '@djaber/shared';
import { Platform, Public, RateLimit, RequirePlatformRole } from '../../../core/auth/decorators';
import { ConfigService } from '../../../core/config/config.service';
import { AppException } from '../../../core/errors/app.exception';
import { RawResponse } from '../../../core/http/envelope.interceptor';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { actorOf } from '../admin-ops.util';
import { IncidentService } from './incident.service';
import { JobsHealthService } from './jobs-health.service';
import { StatusPageService } from './status-page.service';

class FailedQueryDto extends createZodDto(QueueFailedQuerySchema) {}
class FailedJobQueryDto extends createZodDto(FailedJobQuerySchema) {}
class RunNowDto extends createZodDto(QueueRunNowSchema) {}
class IncidentsQueryDto extends createZodDto(IncidentsQuerySchema) {}
class IncidentCreateDto extends createZodDto(IncidentCreateSchema) {}
class IncidentPatchDto extends createZodDto(IncidentPatchSchema) {}
class IncidentUpdateDto extends createZodDto(IncidentUpdateSchema) {}
class IncidentResolveDto extends createZodDto(IncidentResolveSchema) {}
class SubscribeDto extends createZodDto(StatusSubscribeSchema) {}

const QUEUE_ACTIONS = new Set(['pause', 'resume', 'drain-failed', 'replay-failed', 'run-now']);

@Controller('admin')
@Platform()
export class AdminHealthController {
  constructor(
    private readonly health: JobsHealthService,
    private readonly incidents: IncidentService,
  ) {}

  @Get('health')
  @RequirePlatformRole('admin.health.read')
  get() {
    return this.health.health();
  }

  @Get('queues/failed/:jobId')
  @RequirePlatformRole('admin.health.read')
  failedJob(@Param('jobId') jobId: string, @Query() q: FailedJobQueryDto) {
    return this.health.failedJob(jobId, q.queue);
  }

  @Post('queues/failed/:jobId/replay')
  @HttpCode(200)
  @RequirePlatformRole('admin.health.replay')
  replay(@Param('jobId') jobId: string, @Query() q: FailedJobQueryDto, @Req() req: any) {
    return this.health.replay(jobId, q.queue, actorOf(req));
  }

  @Get('queues/:name/failed')
  @RequirePlatformRole('admin.health.read')
  failed(@Param('name') name: string, @Query() q: FailedQueryDto) {
    return this.health.failed(name, q);
  }

  @Post('queues/:name/:action')
  @HttpCode(200)
  @RequirePlatformRole('admin.health.write')
  action(@Param('name') name: string, @Param('action') action: string, @Body() dto: RunNowDto, @Req() req: any) {
    if (!QUEUE_ACTIONS.has(action)) throw new AppException('NOT_FOUND');
    return this.health.action(name, action, dto ?? {}, actorOf(req));
  }

  @Get('incidents')
  @RequirePlatformRole('admin.health.read')
  listIncidents(@Query() q: IncidentsQueryDto) {
    return this.incidents.list(q);
  }

  @Post('incidents')
  @HttpCode(201)
  @RequirePlatformRole('admin.health.write')
  createIncident(@Body() dto: IncidentCreateDto, @Req() req: any) {
    return this.incidents.create(dto, actorOf(req));
  }

  @Get('incidents/:id')
  @RequirePlatformRole('admin.health.read')
  getIncident(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidents.get(id);
  }

  @Patch('incidents/:id')
  @RequirePlatformRole('admin.health.write')
  patchIncident(@Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentPatchDto, @Req() req: any) {
    return this.incidents.patch(id, dto, actorOf(req));
  }

  @Post('incidents/:id/updates')
  @HttpCode(201)
  @RequirePlatformRole('admin.health.write')
  addUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentUpdateDto, @Req() req: any) {
    return this.incidents.addUpdate(id, dto, actorOf(req));
  }

  @Post('incidents/:id/resolve')
  @HttpCode(200)
  @RequirePlatformRole('admin.health.write')
  resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentResolveDto, @Req() req: any) {
    return this.incidents.resolve(id, dto, actorOf(req));
  }
}

@Controller('status')
export class StatusController {
  constructor(private readonly status: StatusPageService) {}

  @Public()
  @Get()
  page(@Req() req: any) {
    return this.status.page(req.locale ?? 'fr');
  }

  @Public()
  @Post('subscribe')
  @HttpCode(202)
  @RateLimit({ name: 'status-subscribe', max: 5, windowSeconds: 3600, by: 'ip' })
  subscribe(@Body() dto: SubscribeDto) {
    return this.status.subscribe(dto.email, dto.locale);
  }

  @Public()
  @Get('confirm/:token')
  confirm(@Param('token') token: string) {
    return this.status.confirm(token);
  }

  @Public()
  @Get('unsubscribe/:token')
  unsubscribe(@Param('token') token: string) {
    return this.status.unsubscribe(token);
  }
}

/** Loopback, RFC 1918 and unique-local addresses (the internal network of 07-non-functional §5). */
export const isPrivateIp = (ip: string | undefined | null): boolean => {
  if (!ip) return false;
  const v = ip.replace(/^::ffff:/, '');
  return v === '::1' || v === '127.0.0.1' || /^10\./.test(v) || /^192\.168\./.test(v) || /^172\.(1[6-9]|2\d|3[01])\./.test(v) || /^f[cd][0-9a-f]{2}:/i.test(v) || v.startsWith('127.');
};

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  /** Prometheus scrape (07-non-functional §5): internal network only, or `Authorization: Bearer <METRICS_TOKEN>`. */
  @Public()
  @Get()
  async scrape(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = this.config.get('METRICS_TOKEN');
    const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    const allowed = token ? auth === `Bearer ${token}` : isPrivateIp(req.socket?.remoteAddress ?? req.ip);
    if (!allowed) throw new AppException('FORBIDDEN');
    res.setHeader('Content-Type', this.metrics.contentType);
    return new RawResponse(await this.metrics.text());
  }
}
