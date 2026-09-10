import { Request, Response } from 'express';
import prisma from '../config/database';
import fs from 'fs';
import path from 'path';
import { uploadToCloud } from '../config/upload';
import { ApiError, fail, handleError } from '../errors';

const MAX_REORDER = 100;

/** Product owned by the caller or 404 PRODUCT_NOT_FOUND. */
async function findOwnProduct(productId: string, userId: string): Promise<{ id: string }> {
  const product = await prisma.product.findFirst({
    where: { id: productId, userId },
    select: { id: true },
  });
  if (!product) throw new ApiError('PRODUCT_NOT_FOUND');
  return product;
}

// Upload images to a product
export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const cleanup = () => {
    for (const file of files) fs.unlink(file.path, () => {});
  };
  try {
    if (!req.user) {
      cleanup();
      return fail(req, res, 'UNAUTHORIZED');
    }

    const productId = req.params.productId as string;
    if (files.length === 0) return fail(req, res, 'FILE_REQUIRED');

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });

    if (!product) {
      cleanup();
      return fail(req, res, 'PRODUCT_NOT_FOUND');
    }

    // Upload files to cloud (GCS in prod, local in dev)
    const uploadedUrls: string[] = [];
    for (const file of files) {
      try {
        const url = await uploadToCloud(file.path, file.filename);
        uploadedUrls.push(url);
      } catch (err) {
        console.error('Cloud upload failed for', file.filename, err);
        // Fallback to local URL
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:6001';
        uploadedUrls.push(`${backendUrl}/uploads/products/${file.filename}`);
      }
    }

    // Get current max sortOrder
    const maxSort = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    let sortOrder = (maxSort?.sortOrder ?? -1) + 1;

    // Check if product already has images (for isPrimary)
    const existingCount = await prisma.productImage.count({ where: { productId } });

    const images = await prisma.$transaction(
      files.map((file, i) =>
        prisma.productImage.create({
          data: {
            productId,
            url: uploadedUrls[i],
            filename: file.filename,
            sortOrder: sortOrder + i,
            isPrimary: existingCount === 0 && i === 0,
          },
        })
      )
    );

    res.status(201).json({ images });
  } catch (error) {
    cleanup();
    handleError(req, res, error, 'IMAGE_UPLOAD_FAILED');
  }
};

// Get images for a product
export const getImages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    await findOwnProduct(productId, req.user.userId);

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ images });
  } catch (error) {
    handleError(req, res, error, 'IMAGE_LIST_FAILED');
  }
};

// Delete an image
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const imageId = req.params.imageId as string;

    await findOwnProduct(productId, req.user.userId);

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) return fail(req, res, 'IMAGE_NOT_FOUND');

    // Delete file from disk
    const filePath = path.join(__dirname, '../../uploads/products', image.filename);
    fs.unlink(filePath, () => {});

    // Delete record
    await prisma.productImage.delete({ where: { id: imageId } });

    // If deleted image was primary, make the first remaining image primary
    if (image.isPrimary) {
      const firstImage = await prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (firstImage) {
        await prisma.productImage.update({
          where: { id: firstImage.id },
          data: { isPrimary: true },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'IMAGE_DELETE_FAILED');
  }
};

// Reorder images
export const reorderImages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const { imageIds } = (req.body ?? {}) as { imageIds?: unknown };

    if (!Array.isArray(imageIds) || imageIds.length === 0) return fail(req, res, 'LIST_REQUIRED', { item: 'image' });
    if (imageIds.length > MAX_REORDER) return fail(req, res, 'TOO_MANY_FILES', { max: MAX_REORDER });
    if (imageIds.some((id) => typeof id !== 'string' || id.trim() === '')) return fail(req, res, 'FIELD_INVALID_ID', { field: 'imageIds' });
    const ids = imageIds as string[];
    if (new Set(ids).size !== ids.length) return fail(req, res, 'IMAGE_IDS_INVALID');

    await findOwnProduct(productId, req.user.userId);

    // Every id must belong to this product
    const owned = await prisma.productImage.count({ where: { productId, id: { in: ids } } });
    if (owned !== ids.length) return fail(req, res, 'IMAGE_IDS_INVALID');

    // Update sort orders
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.productImage.updateMany({
          where: { id, productId },
          data: { sortOrder: index },
        })
      )
    );

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ images });
  } catch (error) {
    handleError(req, res, error, 'IMAGE_REORDER_FAILED');
  }
};

// Set primary image
export const setPrimaryImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const imageId = req.params.imageId as string;

    await findOwnProduct(productId, req.user.userId);

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) return fail(req, res, 'IMAGE_NOT_FOUND');

    // Unset all, then set the chosen one
    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'IMAGE_SET_PRIMARY_FAILED');
  }
};
