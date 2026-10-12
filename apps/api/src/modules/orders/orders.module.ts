import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ClientsModule } from '../clients/clients.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { OrderEffects } from './order-effects.service';
import { OrderImportService } from './order-import.service';
import { OrderPrintService } from './order-print.service';
import { OrderToolsService } from './order-tools.service';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderService } from './order.service';
import { OrdersController } from './orders.controller';

/**
 * 01-nest-module-map `orders` (M5): numbering, creation (manual / mobile / API / AI), status machine + OrderEffects
 * (the only writer of an order's stock movements, cash rows and client aggregates — 04 §3), calls, callbacks
 * (`sched-order-reminders`), address, assignment, payments, notes, bulk, export, A5 print. `OrderToolsService` is bound
 * to the AI port `ORDER_TOOLS` by the AI module.
 */
@Module({
  imports: [CatalogModule, ClientsModule, DeliveryModule, MessagingModule, RecommendationsModule],
  controllers: [OrdersController],
  providers: [OrderEffects, OrderService, OrderWorkflowService, OrderPrintService, OrderToolsService, OrderImportService],
  exports: [OrderEffects, OrderService, OrderWorkflowService, OrderToolsService],
})
export class OrdersModule {}
