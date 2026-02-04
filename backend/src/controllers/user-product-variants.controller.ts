import { Request, Response } from 'express';
import prisma from '../config/database';

// Helper: recalculate parent product quantity as sum of variants (works inside a transaction)
async function recalcParentQuantity(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], productId: string) {
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

    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(name && { name: name.trim().slice(0, 255) }),
        ...(sku !== undefined && { sku: sku?.trim().slice(0, 255) || null }),
        ...(validCostPrice !== undefined && { costPrice: validCostPrice }),
        ...(validSellingPrice !== undefined && { sellingPrice: validSellingPrice }),
        ...(validMinQuantity !== undefined && { minQuantity: validMinQuantity }),
        ...(isActive !== undefined && { isActive }),
      },
    });

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

    // Calculate new quantity
    let newQuantity = variant.quantity;
    if (type === 'in') {
      newQuantity += numQuantity;
    } else if (type === 'out') {
      newQuantity -= numQuantity;
      if (newQuantity < 0) {
        res.status(400).json({ error: 'Insufficient stock' });
        return;
      }
    } else {
      // adjustment - set to exact quantity
      newQuantity = numQuantity;
    }

    // Use interactive transaction so variant update, stock movement, and parent recalc are atomic
    const [updatedVariant, movement] = await prisma.$transaction(async (tx) => {
      const uv = await tx.productVariant.update({
        where: { id: variantId },
        data: { quantity: newQuantity },
      });

      const mv = await tx.stockMovement.create({
        data: {
          userId: req.user!.userId,
          productId,
          variantId,
          type,
          quantity: type === 'adjustment' ? numQuantity - variant.quantity : (type === 'out' ? -numQuantity : numQuantity),
          reason,
          notes,
        },
      });

      // Recalculate parent aggregate quantity inside the transaction
      await recalcParentQuantity(tx, productId);

      return [uv, mv] as const;
    });

    res.json({ variant: updatedVariant, movement });
  } catch (error) {
    console.error('Adjust variant stock error:', error);
    res.status(500).json({ error: 'Failed to adjust variant stock' });
  }
};
