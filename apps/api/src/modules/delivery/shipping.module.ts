import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { MessagingModule } from '../messaging/messaging.module';
import { OrdersModule } from '../orders/orders.module';
import { CourierAdapters } from './adapters/courier-registry';
import { CourierAccountService } from './courier-account.service';
import { CourierLimiter } from './courier-limiter';
import { CouriersController } from './couriers.controller';
import { DeliveryOverviewService } from './delivery-overview.service';
import { CourierWebhookController, DeliveryOpsController, ProductLabelsController, PublicTrackingController } from './delivery-ops.controller';
import { DeliveryModule } from './delivery.module';
import { LabelService } from './label.service';
import { PublicTrackingService } from './public-tracking.service';
import { RatesService } from './rates.service';
import { ShipmentEffects } from './shipment-effects.service';
import { ShipmentService } from './shipment.service';
import { OrderShipmentsController, ShipmentsController } from './shipments.controller';
import { TrackingService } from './tracking.service';

/**
 * 01-nest-module-map `delivery` — M6 half (the M5 half, fee grid + geo, is `DeliveryModule`, which orders depend on):
 * courier accounts + `CourierAdapter` (zrexpress / ecotrack / yalidine / manual; fake by default, live guarded by
 * COURIER_ALLOW_LIVE), shipments (send single / bulk, retries, actions), tracking sync (scheduler, batches, per-account
 * limiter, webhooks), labels (courier + Djaber fallback + merged job, product label sheet), overview, rates, public tracking.
 */
@Module({
  imports: [DeliveryModule, OrdersModule, JobsModule, MessagingModule],
  controllers: [CouriersController, OrderShipmentsController, ShipmentsController, DeliveryOpsController, CourierWebhookController, PublicTrackingController, ProductLabelsController],
  providers: [CourierAdapters, CourierLimiter, CourierAccountService, ShipmentEffects, ShipmentService, TrackingService, LabelService, RatesService, DeliveryOverviewService, PublicTrackingService],
  exports: [CourierAdapters, CourierAccountService, ShipmentService, TrackingService, LabelService],
})
export class ShippingModule {}
