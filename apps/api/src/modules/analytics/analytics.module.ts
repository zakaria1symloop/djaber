import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DailyStatsService } from './daily-stats.service';

/**
 * 01-nest-module-map `analytics` (M8): overview + 8 tabs (`AnalyticsService`), the nightly `DailyStat` rollup
 * (`sched-daily-stats`, `DailyStatsService`). The home dashboard (ANA-01) stays in `DashboardModule` (M5).
 */
@Module({ imports: [CatalogModule], controllers: [AnalyticsController], providers: [AnalyticsService, DailyStatsService], exports: [AnalyticsService, DailyStatsService] })
export class AnalyticsModule {}
