import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../../analytics/analytics.module';
import { ReportScheduleService } from './report-schedule.service';
import { ReportService } from './report.service';
import { ReportsController } from './reports.controller';

/**
 * 01-nest-module-map `gds` › reports (M8): the 23 GDS-10 reports (`definitions.ts` = one query per report, metadata in
 * `@djaber/shared`), exports through the generic `jobs/export` job, monthly e-mails (`sched-report-schedules`).
 */
@Module({ imports: [AnalyticsModule], controllers: [ReportsController], providers: [ReportService, ReportScheduleService], exports: [ReportService] })
export class ReportsModule {}
