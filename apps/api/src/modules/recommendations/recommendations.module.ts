import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { prisma, TenantContext, type Tx } from '@djaber/db';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { CrossSellService } from './cross-sell.service';
import { RecommendationsController, StockRecommendationsController } from './recommendations.controller';
import { StockRecoService } from './stock-reco.service';

/**
 * 03-events §4 `sched-nightly-recommendations` (03:00): every workspace with ≥ 1 delivered order in 90 d gets one
 * cross-sell job and one stock-recommendation job per night (re-running the same night schedules nothing new).
 */
@Injectable()
export class RecommendationsScheduler implements OnModuleInit {
  private readonly log = new Logger(RecommendationsScheduler.name);
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly xsell: CrossSellService,
    private readonly stock: StockRecoService,
  ) {}

  onModuleInit() {
    this.registry.cron('sched-nightly-recommendations', '0 3 * * *', () => this.nightly());
  }

  async nightly() {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const rows = await TenantContext.runSystem(() => prisma.order.findMany({ where: { status: 'delivered', deliveredAt: { gte: since } }, distinct: ['workspaceId'], select: { workspaceId: true } }));
    let n = 0;
    for (const { workspaceId } of rows) {
      try {
        await TenantContext.runAs(workspaceId, () =>
          prisma.$transaction(async (db) => {
            await this.xsell.scheduleNightly(db as Tx);
            await this.stock.scheduleNightly(db as Tx);
          }),
        );
        n++;
      } catch (e) {
        this.log.error({ workspaceId, err: String(e) }, 'nightly recommendations scheduling failed');
      }
    }
    return n;
  }
}

/**
 * 01-nest-module-map `recommendations`: cross-sell rules + engine + events (REC-01…03) and stock recommendations
 * (GDS-10). Exported to the AI (impressions), orders (conversions / reversal) and GDS (inventory variance alert).
 */
@Module({
  controllers: [StockRecommendationsController, RecommendationsController],
  providers: [CrossSellService, StockRecoService, RecommendationsScheduler],
  exports: [CrossSellService, StockRecoService],
})
export class RecommendationsModule {}
