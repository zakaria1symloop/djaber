// Request DTOs of the GDS module: the shared zod schemas (packages/shared/src/schemas/gds.ts) wrapped for nestjs-zod.
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CancelPurchaseSchema,
  CancelSaleSchema,
  CashDaysQuerySchema,
  CashQuerySchema,
  CashStatsQuerySchema,
  CloseCashSchema,
  CreateCashEntrySchema,
  CreatePurchaseSchema,
  CreateSaleSchema,
  CreateSupplierSchema,
  GdsPaymentSchema,
  InventoriesQuerySchema,
  InventoryLinesSchema,
  InventoryScopePreviewQuerySchema,
  PurchasesQuerySchema,
  PurchasesExportQuerySchema,
  SalesExportQuerySchema,
  PurchaseStatsQuerySchema,
  ReceivePurchaseSchema,
  ReopenCashSchema,
  SaleClientSchema,
  SalesQuerySchema,
  SaleStatsQuerySchema,
  StartInventorySchema,
  SupplierPaymentSchema,
  SuppliersQuerySchema,
  UpdateCashEntrySchema,
  UpdatePurchaseSchema,
  UpdateSaleSchema,
  UpdateSupplierSchema,
  ValidateInventorySchema,
} from '@djaber/shared';

/** Bodies made only of optional keys may be omitted altogether (`POST …/cancel`, `POST …/validate`). */
const optionalBody = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => v ?? {}, schema) as unknown as T;

export class CreateSupplierDto extends createZodDto(CreateSupplierSchema) {}
export class UpdateSupplierDto extends createZodDto(UpdateSupplierSchema) {}
export class SupplierPaymentDto extends createZodDto(SupplierPaymentSchema) {}
export class SuppliersQueryDto extends createZodDto(SuppliersQuerySchema) {}

export class CreatePurchaseDto extends createZodDto(CreatePurchaseSchema) {}
export class UpdatePurchaseDto extends createZodDto(UpdatePurchaseSchema) {}
export class ReceivePurchaseDto extends createZodDto(ReceivePurchaseSchema) {}
export class CancelPurchaseDto extends createZodDto(optionalBody(CancelPurchaseSchema)) {}
export class GdsPaymentDto extends createZodDto(GdsPaymentSchema) {}
export class PurchasesQueryDto extends createZodDto(PurchasesQuerySchema) {}
export class PurchaseStatsQueryDto extends createZodDto(PurchaseStatsQuerySchema) {}

export class CreateSaleDto extends createZodDto(CreateSaleSchema) {}
export class UpdateSaleDto extends createZodDto(UpdateSaleSchema) {}
export class CancelSaleDto extends createZodDto(CancelSaleSchema) {}
export class SaleClientDto extends createZodDto(SaleClientSchema) {}
export class SalesQueryDto extends createZodDto(SalesQuerySchema) {}
export class SaleStatsQueryDto extends createZodDto(SaleStatsQuerySchema) {}

export class CreateCashEntryDto extends createZodDto(CreateCashEntrySchema) {}
export class UpdateCashEntryDto extends createZodDto(UpdateCashEntrySchema) {}
export class CloseCashDto extends createZodDto(CloseCashSchema) {}
export class ReopenCashDto extends createZodDto(ReopenCashSchema) {}
export class CashQueryDto extends createZodDto(CashQuerySchema) {}
export class CashStatsQueryDto extends createZodDto(CashStatsQuerySchema) {}
export class CashExportQueryDto extends createZodDto(CashStatsQuerySchema.extend({ format: z.enum(['csv', 'xlsx']).default('xlsx') })) {}
export class CashDaysQueryDto extends createZodDto(CashDaysQuerySchema) {}

export class StartInventoryDto extends createZodDto(StartInventorySchema) {}
export class InventoryLinesDto extends createZodDto(InventoryLinesSchema) {}
export class ValidateInventoryDto extends createZodDto(optionalBody(ValidateInventorySchema)) {}
export class InventoriesQueryDto extends createZodDto(InventoriesQuerySchema) {}
export class InventoryScopePreviewQueryDto extends createZodDto(InventoryScopePreviewQuerySchema) {}
export class PrintQueryDto extends createZodDto(z.object({ lang: z.enum(['fr', 'ar', 'en']).optional() })) {}
export class PurchasesExportQueryDto extends createZodDto(PurchasesExportQuerySchema) {}
export class SalesExportQueryDto extends createZodDto(SalesExportQuerySchema) {}
