import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

const NAME_MAX = 255;
const SKU_MAX = 255;
const REASON_MAX = 255;
const NOTES_MAX = 2000;
const MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'return'] as const;

/** Product owned by the caller or 404 PRODUCT_NOT_FOUND. */
async function findOwnProduct(productId: string, userId: string): Promise<{ id: string }> {
  const product = await prisma.product.findFirst({
    where: { id: productId, userId },
    select: { id: true },
  });
  if (!product) throw new ApiError('PRODUCT_NOT_FOUND');
  return product;
}

// Helper: recalculate parent product quantity as sum of variants (works inside a transaction)
export async function recalcParentQuantity(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], productId: string) {
  const agg = await tx.productVariant.aggregate({
    where: { productId, isActive: true },
    _sum: { quantity: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: { quantity: agg._sum.quantity || 0 },
  });
}

// Get variants for a product
export const getVariants = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    await findOwnProduct(productId, req.user.userId);

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ variants });
  } catch (error) {
    handleError(req, res, error, 'VARIANT_LIST_FAILED');
  }
};

// Create a variant
export const createVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const name = v.requiredString(body.name, 'name', { max: NAME_MAX });
    const sku = v.optionalString(body.sku, 'sku', { max: SKU_MAX });
    const validCostPrice = v.number(body.costPrice, 'costPrice', { min: 0, required: false, def: 0 });
    const validSellingPrice = v.number(body.sellingPrice, 'sellingPrice', { min: 0, required: false, def: 0 });
    const variantQty = v.integer(body.quantity, 'quantity', { min: 0, required: false, def: 0 });
    const validMinQuantity = v.integer(body.minQuantity, 'minQuantity', { min: 0, required: false, def: 0 });
    v.throwIfAny();

    await findOwnProduct(productId, req.user.userId);

    // Use interactive transaction so variant creation, parent recalc, and stock movement are atomic
    const variant = await prisma.$transaction(async (tx) => {
      const newVariant = await tx.productVariant.create({
        data: {
          productId,
          name,
          sku,
          costPrice: validCostPrice,
          sellingPrice: validSellingPrice,
          quantity: variantQty,
          minQuantity: validMinQuantity,
        },
      });

      // Set hasVariants = true on parent
      await tx.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      });

      // Recalculate parent aggregate quantity inside the transaction
      await recalcParentQuantity(tx, productId);

      // Create initial stock movement if quantity > 0
      if (variantQty > 0) {
        await tx.stockMovement.create({
          data: {
            userId: req.user!.userId,
            productId,
            variantId: newVariant.id,
            type: 'in',
            quantity: variantQty,
            reason: 'Initial variant stock',
          },
        });
      }

      return newVariant;
    });

    res.status(201).json({ variant });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'VARIANT_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'VARIANT_CREATE_FAILED');
  }
};

// Update a variant
export const updateVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const name = v.optionalString(body.name, 'name', { max: NAME_MAX });
    const sku = body.sku !== undefined ? v.optionalString(body.sku, 'sku', { max: SKU_MAX }) : undefined;
    const validCostPrice = body.costPrice !== undefined ? v.number(body.costPrice, 'costPrice', { min: 0 }) : undefined;
    const validSellingPrice = body.sellingPrice !== undefined ? v.number(body.sellingPrice, 'sellingPrice', { min: 0 }) : undefined;
    const validMinQuantity = body.minQuantity !== undefined ? v.integer(body.minQuantity, 'minQuantity', { min: 0 }) : undefined;
    const isActive = body.isActive !== undefined ? v.boolean(body.isActive, 'isActive') : undefined;
    v.throwIfAny();

    await findOwnProduct(productId, req.user.userId);

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existing) return fail(req, res, 'VARIANT_NOT_FOUND');

    const updateData = {
      ...(name && { name }),
      ...(sku !== undefined && { sku }),
      ...(validCostPrice !== undefined && { costPrice: validCostPrice }),
      ...(validSellingPrice !== undefined && { sellingPrice: validSellingPrice }),
      ...(validMinQuantity !== undefined && { minQuantity: validMinQuantity }),
      ...(isActive !== undefined && { isActive }),
    };

    const isActiveChanged = isActive !== undefined && isActive !== existing.isActive;

    let variant;
    if (isActiveChanged) {
      // (De)activation changes the parent's aggregate quantity — update,
      // write the parent-level ledger delta, and recalc atomically
      variant = await prisma.$transaction(async (tx) => {
        const updated = await tx.productVariant.update({
          where: { id: variantId },
          data: updateData,
        });

        // Parent-level adjustment for the stock that (dis)appears from the
        // aggregate. variantId stays null: the variant's own quantity is
        // unchanged, only the parent-visible total moves.
        if (existing.quantity > 0) {
          await tx.stockMovement.create({
            data: {
              userId: req.user!.userId,
              productId,
              variantId: null,
              type: 'adjustment',
              quantity: updated.isActive ? existing.quantity : -existing.quantity,
              reason: `Variant "${existing.name}" ${updated.isActive ? 'activated' : 'deactivated'}`,
            },
          });
        }

        await recalcParentQuantity(tx, productId);

        return updated;
      });
    } else {
      variant = await prisma.productVariant.update({
        where: { id: variantId },
        data: updateData,
      });
    }

    res.json({ variant });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'VARIANT_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'VARIANT_UPDATE_FAILED');
  }
};

// Delete a variant
export const deleteVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;

    await findOwnProduct(productId, req.user.userId);

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existing) return fail(req, res, 'VARIANT_NOT_FOUND');

    // Use interactive transaction so delete, hasVariants toggle, and recalc are atomic
    await prisma.$transaction(async (tx) => {
      // Ledger entry for the destroyed stock (only active variants count in
      // the parent aggregate). variantId is null on purpose: the FK is
      // onDelete SetNull, so it would be nulled anyway — identify in notes.
      if (existing.isActive && existing.quantity !== 0) {
        await tx.stockMovement.create({
          data: {
            userId: req.user!.userId,
            productId,
            variantId: null,
            type: 'adjustment',
            quantity: -existing.quantity,
            reason: 'Variant deleted',
            notes: `Variant "${existing.name}" (${existing.id}) deleted with ${existing.quantity} units`,
          },
        });
      }

      await tx.productVariant.delete({ where: { id: variantId } });

      // Check if this was the last variant
      const remainingCount = await tx.productVariant.count({ where: { productId } });

      if (remainingCount === 0) {
        await tx.product.update({
          where: { id: productId },
          data: { hasVariants: false },
        });
      }

      // Recalculate parent aggregate quantity
      await recalcParentQuantity(tx, productId);
    });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'VARIANT_DELETE_FAILED');
  }
};

// Adjust variant stock
export const adjustVariantStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const type = v.oneOf(body.type, 'type', MOVEMENT_TYPES);
    const numQuantity = v.integer(body.quantity, 'quantity', { min: 0 });
    const reason = v.optionalString(body.reason, 'reason', { max: REASON_MAX });
    const notes = v.optionalString(body.notes, 'notes', { max: NOTES_MAX });
    // Zero is only meaningful when setting an absolute level (adjustment)
    if (v.ok && type !== 'adjustment' && numQuantity === 0) v.add('quantity', 'STOCK_QUANTITY_ZERO');
    v.throwIfAny();

    await findOwnProduct(productId, req.user.userId);

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) return fail(req, res, 'VARIANT_NOT_FOUND');

    // Apply the change atomically inside the transaction — no outside-read,
    // so concurrent adjustments can neither oversell nor corrupt the ledger delta
    const [updatedVariant, movement] = await prisma.$transaction(async (tx) => {
      let movementQuantity: number;

      if (type === 'in' || type === 'return') {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { quantity: { increment: numQuantity } },
        });
        movementQuantity = numQuantity;
      } else if (type === 'out') {
        const dec = await tx.productVariant.updateMany({
          where: { id: variantId, productId, quantity: { gte: numQuantity } },
          data: { quantity: { decrement: numQuantity } },
        });
        if (dec.count === 0) {
          const current = await tx.productVariant.findUnique({ where: { id: variantId }, select: { quantity: true } });
          throw new ApiError('STOCK_INSUFFICIENT', { name: variant.name, available: current?.quantity ?? 0 });
        }
        movementQuantity = -numQuantity;
      } else {
        // adjustment — set to exact quantity; compute the ledger delta from a
        // locked read (plain findFirst is a non-locking snapshot read on MySQL)
        const rows = await tx.$queryRaw<Array<{ quantity: number }>>`
          SELECT quantity FROM ProductVariant WHERE id = ${variantId} FOR UPDATE
        `;
        const currentQty = Number(rows[0]?.quantity ?? 0);
        movementQuantity = numQuantity - currentQty;
        await tx.productVariant.update({
          where: { id: variantId },
          data: { quantity: numQuantity },
        });
      }

      const mv = await tx.stockMovement.create({
        data: {
          userId: req.user!.userId,
          productId,
          variantId,
          type,
          quantity: movementQuantity,
          reason,
          notes,
        },
      });

      // Recalculate parent aggregate quantity inside the transaction
      await recalcParentQuantity(tx, productId);

      const uv = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });

      return [uv, mv] as const;
    });

    res.json({ variant: updatedVariant, movement });
  } catch (error) {
    handleError(req, res, error, 'VARIANT_STOCK_ADJUST_FAILED');
  }
};
