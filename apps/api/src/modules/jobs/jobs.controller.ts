// 06-api "Jobs & uploads" — GET /jobs, GET /jobs/:id, POST /jobs/:id/cancel, POST /jobs/:id/retry.
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { JobKindValues, JobStatusValues, PageQuery } from '@djaber/shared';
import { RequirePermission } from '../../core/auth/decorators';
import { JobService } from './job.service';

const csv = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.enum(values))).optional();

export const JobsQuerySchema = PageQuery.pick({ page: true, pageSize: true }).extend({ kind: csv(JobKindValues), status: csv(JobStatusValues) });
export class JobsQueryDto extends createZodDto(JobsQuerySchema) {}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobService) {}

  /** "Exports récents" / task list: Admin+ (06 §9 `/jobs*`). */
  @Get()
  @RequirePermission('reports.read')
  list(@Query() q: JobsQueryDto, @Req() req: any) {
    return this.jobs.list(q as never, req.locale);
  }

  /** Polled by whoever started the job (an operator sees only their own jobs). */
  @Get(':id')
  @RequirePermission('workspace.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.jobs.get(id, req.locale);
  }

  @Post(':id/cancel')
  @RequirePermission('workspace.read')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.jobs.cancel(id, req.locale);
  }

  @Post(':id/retry')
  @RequirePermission('workspace.read')
  @HttpCode(202)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.retry(id);
  }
}
