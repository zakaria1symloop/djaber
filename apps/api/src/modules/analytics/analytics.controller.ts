// 06 "Notifications, home, analytics" — `GET /analytics/overview` + the 8 tabs (`analytics.read`, every member).
import { Controller, Get, Param, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { ANALYTICS_TABS, AnalyticsQuerySchema, type AnalyticsQuery, type AnalyticsTab } from '@djaber/shared';
import { RequirePermission } from '../../core/auth/decorators';
import { notFound } from '../../core/errors/app.exception';
import { AnalyticsService } from './analytics.service';

export class AnalyticsQueryDto extends createZodDto(AnalyticsQuerySchema) {}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':tab')
  @RequirePermission('analytics.read')
  tab(@Param('tab') tab: string, @Query() q: AnalyticsQueryDto) {
    if (!(ANALYTICS_TABS as readonly string[]).includes(tab)) throw notFound();
    return this.analytics.tab(tab as AnalyticsTab, q as AnalyticsQuery);
  }
}
