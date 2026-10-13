// Request DTOs of the catalogue module: the shared zod schemas (packages/shared/src/schemas/catalog.ts) wrapped for
// nestjs-zod, plus the list query schemas of 06 §10 ("Produits", "Mouvements").
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  BulkAgentSchema,
  BulkArchiveSchema,
  BulkCategorySchema,
  BulkIdsSchema,
  BulkMinStockSchema,
  BulkPriceSchema,
  CreateCategorySchema,
  CreateProductExpenseSchema,
  CreateProductSchema,
  CreateUnitSchema,
  CreateVariantSchema,
  DuplicateProductSchema,
  GenerateVariantsSchema,
  ImportMappingSchema,
  ModerationStatusProductValues,
  MovementReasonValues,
  MovementRefTypeValues,
  MovementTypeValues,
  PageQuery,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STOCK_STATE_FILTERS,
  PRODUCT_TYPE_FILTERS,
  ProductAppealSchema,
  ReorderProductImagesSchema,
  RestoreProductSchema,
  ReverseMovementSchema,
  StockAdjustmentSchema,
  UpdateCategorySchema,
  UpdateProductExpenseSchema,
  UpdateProductImageSchema,
  UpdateProductSchema,
  UpdateUnitSchema,
  UpdateVariantSchema,
} from '@djaber/shared';

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
export class DuplicateProductDto extends createZodDto(DuplicateProductSchema) {}
/** Bodies made only of optional keys may be omitted altogether (`POST …/restore`, `POST …/reverse`). */
const optionalBody = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => v ?? {}, schema) as unknown as T;
export class RestoreProductDto extends createZodDto(optionalBody(RestoreProductSchema)) {}
export class CreateVariantDto extends createZodDto(CreateVariantSchema) {}
export class UpdateVariantDto extends createZodDto(UpdateVariantSchema) {}
export class GenerateVariantsDto extends createZodDto(GenerateVariantsSchema) {}
export class UpdateProductImageDto extends createZodDto(UpdateProductImageSchema) {}
export class ReorderProductImagesDto extends createZodDto(ReorderProductImagesSchema) {}
export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
export class CreateUnitDto extends createZodDto(CreateUnitSchema) {}
export class UpdateUnitDto extends createZodDto(UpdateUnitSchema) {}
export class StockAdjustmentDto extends createZodDto(StockAdjustmentSchema) {}
export class ReverseMovementDto extends createZodDto(optionalBody(ReverseMovementSchema)) {}
export class BulkIdsDto extends createZodDto(BulkIdsSchema) {}
export class BulkCategoryDto extends createZodDto(BulkCategorySchema) {}
export class BulkAgentDto extends createZodDto(BulkAgentSchema) {}
export class BulkMinStockDto extends createZodDto(BulkMinStockSchema) {}
export class BulkArchiveDto extends createZodDto(BulkArchiveSchema) {}
export class BulkPriceDto extends createZodDto(BulkPriceSchema) {}
export class ImportMappingDto extends createZodDto(ImportMappingSchema) {}
export class CreateProductExpenseDto extends createZodDto(CreateProductExpenseSchema) {}
export class UpdateProductExpenseDto extends createZodDto(UpdateProductExpenseSchema) {}
export class ProductAppealDto extends createZodDto(ProductAppealSchema) {}

// --- query strings (api-contract §1.6: comma lists, min/max ints, YYYY-MM-DD in Africa/Algiers) -------------------------
const list = (v: unknown) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v);
const csv = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(list, z.array(z.enum(values))).optional();
const csvUuid = z.preprocess(list, z.array(z.string().uuid('validation.id'))).optional();
const flag = z.preprocess((v) => (v === '1' || v === 'true' || v === true ? true : v === '0' || v === 'false' || v === false ? false : v), z.boolean()).optional();
const int = z.coerce.number().int('validation.range').min(0, 'validation.range').optional();
const num = z.coerce.number().min(-100_000, 'validation.range').max(100_000, 'validation.range').optional();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'validation.date')
  .optional();
const q = z.string().trim().max(120, 'validation.length').optional();
const format = z.enum(['csv', 'xlsx']).optional();

export const ProductsQuerySchema = PageQuery.extend({
  categoryIds: csvUuid,
  status: csv(PRODUCT_STATUS_FILTERS),
  type: csv(PRODUCT_TYPE_FILTERS),
  stockState: csv(PRODUCT_STOCK_STATE_FILTERS),
  /** 06 §2 shorthand kept for the low-stock deep link (`/products?lowStock=1`) and the quick "active" toggle */
  lowStock: flag,
  active: flag,
  minQty: int,
  maxQty: int,
  minPrice: int,
  maxPrice: int,
  minCost: int,
  maxCost: int,
  minMargin: num,
  maxMargin: num,
  agentId: csvUuid,
  noAgent: flag,
  /** M11 (supplier sheet "Voir les produits (n)"): products in the purchase lines of this supplier (cancelled purchases excluded) */
  supplierId: z.string().uuid('validation.id').optional(),
  moderationStatus: csv(ModerationStatusProductValues),
  createdFrom: day,
  createdTo: day,
  updatedFrom: day,
  updatedTo: day,
  q,
  /** only for exports */
  ids: csvUuid,
  format,
});
export class ProductsQueryDto extends createZodDto(ProductsQuerySchema) {}
export type ProductsQuery = z.infer<typeof ProductsQuerySchema>;

export const MovementsQuerySchema = PageQuery.extend({
  productId: z.string().uuid('validation.id').optional(),
  variantId: z.string().uuid('validation.id').optional(),
  type: csv(MovementTypeValues),
  reason: csv(MovementReasonValues),
  refType: csv(MovementRefTypeValues),
  refId: z.string().uuid('validation.id').optional(),
  createdById: z.union([z.literal('system'), z.string().uuid('validation.id')]).optional(),
  from: day,
  to: day,
  minQty: int,
  maxQty: int,
  categoryId: z.string().uuid('validation.id').optional(),
  q,
  /** GDS-01 "recent movements": `?limit=10` (no page) */
  limit: z.coerce.number().int().min(1).max(100).optional(),
  format,
});
export class MovementsQueryDto extends createZodDto(MovementsQuerySchema) {}
export type MovementsQuery = z.infer<typeof MovementsQuerySchema>;

export const SnapshotQuerySchema = PageQuery.pick({ page: true, pageSize: true }).extend({
  date: z
    .string({ required_error: 'validation.required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'validation.date'),
  categoryId: z.string().uuid('validation.id').optional(),
  q,
});
export class SnapshotQueryDto extends createZodDto(SnapshotQuerySchema) {}
export type SnapshotQuery = z.infer<typeof SnapshotQuerySchema>;

export const DeleteProductQuerySchema = z.object({ mode: z.enum(['archive', 'hard']).optional(), releaseStock: flag });
export class DeleteProductQueryDto extends createZodDto(DeleteProductQuerySchema) {}
export const ReassignQuerySchema = z.object({ reassignTo: z.union([z.literal('none'), z.string().uuid('validation.id')]).optional(), moveChildrenToRoot: flag });
export class ReassignQueryDto extends createZodDto(ReassignQuerySchema) {}
export const SearchQuerySchema = z.object({ q: z.string().trim().max(120).optional(), limit: z.coerce.number().int().min(1).max(50).optional() });
export class SearchQueryDto extends createZodDto(SearchQuerySchema) {}
