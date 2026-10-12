import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ClientAggregatesService } from './client-aggregates.service';
import { ClientService } from './client.service';
import { ClientsController } from './clients.controller';

/**
 * 01-nest-module-map `clients` (M5, CLI-01…05): list / detail / quick edit, normalised-phone uniqueness, merge (CLI-02),
 * risk, archive, export, and the aggregates + risk + auto-block evaluator used by OrderEffects (recomputed, never incremented).
 */
@Module({
  imports: [MessagingModule, DeliveryModule],
  controllers: [ClientsController],
  providers: [ClientService, ClientAggregatesService],
  exports: [ClientService, ClientAggregatesService],
})
export class ClientsModule {}
