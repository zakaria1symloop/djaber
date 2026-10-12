import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ClientsModule } from '../clients/clients.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { CashService } from './cash.service';
import { CashController, InventoriesController, PurchasesController, SalesController, SuppliersController } from './gds.controllers';
import { GdsPrintService } from './gds-print.service';
import { InventoryService } from './inventory.service';
import { PurchaseEffects } from './purchase-effects.service';
import { PurchaseService } from './purchase.service';
import { SaleEffects } from './sale-effects.service';
import { SaleService } from './sale.service';
import { SupplierService } from './supplier.service';

/**
 * 01-nest-module-map `gds` (M7): suppliers, purchases + PurchaseEffects, counter sales + SaleEffects, cash register
 * (manual rows, locks, day closing), inventory counts. Reports (GDS-10 list of 23) arrive with M8.
 * Stock only through `StockService.move` called by the effects services; cash rows only through the effects / closing.
 */
@Module({
  imports: [CatalogModule, ClientsModule, RecommendationsModule],
  controllers: [SuppliersController, PurchasesController, SalesController, CashController, InventoriesController],
  providers: [GdsPrintService, PurchaseEffects, SaleEffects, PurchaseService, SupplierService, SaleService, CashService, InventoryService],
  exports: [PurchaseService, SaleService, CashService],
})
export class GdsModule {}
