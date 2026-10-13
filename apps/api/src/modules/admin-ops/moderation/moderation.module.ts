// ADM-10 (D36, D52): moderation queue, decisions, appeals, rules, SLA job, trust levels. Product-side primitives live in the
// catalog module (`ModerationHookService`, `ModerationPrescreenService`).
import { Module, OnModuleInit } from '@nestjs/common';
import { ProcessorRegistry } from '../../../core/queue/processor.registry';
import { CatalogModule } from '../../catalog/catalog.module';
import { AdminModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { TrustLevelService } from './trust-level.service';

@Module({
  imports: [CatalogModule],
  controllers: [AdminModerationController],
  providers: [ModerationService, TrustLevelService],
  exports: [ModerationService, TrustLevelService],
})
export class AdminModerationModule implements OnModuleInit {
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly moderation: ModerationService,
  ) {}

  onModuleInit() {
    // 03-events §4 `sched-moderation-sla`: every 15 min in business hours (Sun–Thu 09:00–18:00 Africa/Algiers)
    this.registry.cron('sched-moderation-sla', '*/15 9-17 * * 0-4', () => this.moderation.slaSweep());
  }
}
