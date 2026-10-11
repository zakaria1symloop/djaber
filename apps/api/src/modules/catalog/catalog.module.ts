import { Module } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AiFillService } from './ai-fill.service';
import { FakeProductVisionProvider, IMAGE_CAPTION_PROVIDER, PRODUCT_VISION_PROVIDER, StubImageCaptionProvider, UnavailableProductVisionProvider } from './ai.providers';
import { BulkService } from './bulk.service';
import { CategoriesController, ModerationController, StockController, UnitsController } from './catalog.controllers';
import { CategoryService, UnitService } from './category.service';
import { ExpenseService } from './expense.service';
import { ImportService } from './import.service';
import { LowStockEvaluator } from './low-stock.evaluator';
import { ModerationHookService } from './moderation-hook.service';
import { PlanLimitService } from './plan-limit.service';
import { ProductImageService } from './product-image.service';
import { ProductService } from './product.service';
import { ProductsController } from './products.controller';
import { SkuService } from './sku.service';
import { StockService } from './stock.service';
import { VariantService } from './variant.service';

/**
 * 01-nest-module-map `catalog` (M2): products, images, variants, categories, units, stock (adjustments, journal,
 * dashboard), import / export, create-from-photo, expenses & margins, moderation hooks (merchant side).
 * `StockService` is exported for the effects services of M5 / M7 (the only stock writer).
 */
@Module({
  imports: [UploadsModule],
  controllers: [ProductsController, CategoriesController, UnitsController, StockController, ModerationController],
  providers: [
    SkuService,
    PlanLimitService,
    LowStockEvaluator,
    StockService,
    ModerationHookService,
    VariantService,
    ProductService,
    ProductImageService,
    CategoryService,
    UnitService,
    ExpenseService,
    BulkService,
    ImportService,
    AiFillService,
    // AI behind interfaces: deterministic implementations until the AI pipeline of M4 binds the real providers
    { provide: IMAGE_CAPTION_PROVIDER, useClass: StubImageCaptionProvider },
    {
      provide: PRODUCT_VISION_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => (config.get('AI_DRIVER') === 'fake' ? new FakeProductVisionProvider() : new UnavailableProductVisionProvider()),
    },
  ],
  exports: [StockService, ProductService, LowStockEvaluator, ModerationHookService, PlanLimitService, SkuService],
})
export class CatalogModule {}
