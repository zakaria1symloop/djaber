// ADM-14 (D59): jobs & health, DLQ replay, incidents, public status page data, Prometheus scrape endpoint.
import { Module } from '@nestjs/common';
import { AdminHealthController, MetricsController, StatusController } from './health.controllers';
import { IncidentService } from './incident.service';
import { JobsHealthService } from './jobs-health.service';
import { StatusPageService } from './status-page.service';

@Module({
  controllers: [AdminHealthController, StatusController, MetricsController],
  providers: [JobsHealthService, IncidentService, StatusPageService],
  exports: [JobsHealthService, IncidentService, StatusPageService],
})
export class AdminHealthModule {}
