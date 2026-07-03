import { Request, Response } from 'express';
import prisma from '../config/database';

// Thrown inside stock transactions and mapped to a 400 response
class StockAdjustError extends Error {}

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
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ variants });
  } catch (error) {
    console.error('Get variants error:', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
};

// Create a variant
export const createVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const { name, sku, costPrice, sellingPrice, quantity, minQuantity } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Variant name is required' });
      return;
    }

    if (name.trim().length > 255) {
      res.status(400).json({ error: 'Variant name is too long (max 255)' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const variantQty = Math.max(0, Number(quantity) || 0);
    const validCostPrice = Math.max(0, Number(costPrice) || 0);
    const validSellingPrice = Math.max(0, Number(sellingPrice) || 0);
    const validMinQuantity = Math.max(0, Number(minQuantity) || 0);

    // Use interactive transaction so variant creation, parent recalc, and stock movement are atomic
    const variant = await prisma.$transaction(async (tx) => {
      const newVariant = await tx.productVariant.create({
        data: {
          productId,
          name: name.trim(),
          sku: sku?.trim().slice(0, 255) || null,
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
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A variant with this name already exists for this product' });
      return;
    }
    console.error('Create variant error:', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
};

// Update a variant
export const updateVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;
    const { name, sku, costPrice, sellingPrice, minQuantity, isActive } = req.body;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

    // Validate numeric fields
    const validCostPrice = costPrice !== undefined ? Math.max(0, Number(costPrice) || 0) : undefined;
    const validSellingPrice = sellingPrice !== undefined ? Math.max(0, Number(sellingPrice) || 0) : undefined;
    const validMinQuantity = minQuantity !== undefined ? Math.max(0, Number(minQuantity) || 0) : undefined;

    const updateData = {
      ...(name && { name: name.trim().slice(0, 255) }),
      ...(sku !== undefined && { sku: sku?.trim().slice(0, 255) || null }),
      ...(validCostPrice !== undefined && { costPrice: validCostPrice }),
      ...(validSellingPrice !== undefined && { sellingPrice: validSellingPrice }),
      ...(validMinQuantity !== undefined && { minQuantity: validMinQuantity }),
      ...(isActive !== undefined && { isActive }),
    };

    const isActiveChanged = isActive !== undefined && Boolean(isActive) !== existing.isActive;

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
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A variant with this name already exists for this product' });
      return;
    }
    console.error('Update variant error:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
};

// Delete a variant
export const deleteVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

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
    console.error('Delete variant error:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
};

// Adjust variant stock
export const adjustVariantStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;
    const { type, quantity, reason, notes } = req.body;

    if (!type || quantity === undefined || quantity === null) {
      res.status(400).json({ error: 'Type and quantity are required' });
      return;
    }

    if (!['in', 'out', 'adjustment'].includes(type)) {
      res.status(400).json({ error: 'Invalid type. Must be: in, out, or adjustment' });
      return;
    }

    const numQuantity = Number(quantity);
    if (isNaN(numQuantity) || numQuantity < 0) {
      res.status(400).json({ error: 'Quantity must be a non-negative number' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!variant) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

    // Apply the change atomically inside the transaction — no outside-read,
    // so concurrent adjustments can neither oversell nor corrupt the ledger delta
    const [updatedVariant, movement] = await prisma.$transaction(async (tx) => {
      let movementQuantity: number;

      if (type === 'in') {
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
          throw new StockAdjustError('Insufficient stock');
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
    if (error instanceof StockAdjustError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Adjust variant stock error:', error);
    res.status(500).json({ error: 'Failed to adjust variant stock' });
  }
};
