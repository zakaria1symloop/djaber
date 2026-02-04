import { Request, Response } from 'express';
import prisma from '../config/database';
import fs from 'fs';
import path from 'path';

// Upload images to a product
export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });

    if (!product) {
      // Clean up uploaded files
      for (const file of files) {
        fs.unlink(file.path, () => {});
      }
      res.status(404).json({ error: 'Product not found' });
      return;
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
            url: `/uploads/products/${file.filename}`,
            filename: file.filename,
            sortOrder: sortOrder + i,
            isPrimary: existingCount === 0 && i === 0, // First image of product is primary
          },
        })
      )
    );

    res.status(201).json({ images });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
};

// Get images for a product
export const getImages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ images });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
};

// Delete an image
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const imageId = req.params.imageId as string;

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });

    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

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
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

// Reorder images
export const reorderImages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const { imageIds } = req.body as { imageIds: string[] };

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      res.status(400).json({ error: 'imageIds array is required' });
      return;
    }

    if (imageIds.length > 100) {
      res.status(400).json({ error: 'Too many images (max 100)' });
      return;
    }

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Update sort orders
    await prisma.$transaction(
      imageIds.map((id, index) =>
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
    console.error('Reorder images error:', error);
    res.status(500).json({ error: 'Failed to reorder images' });
  }
};

// Set primary image
export const setPrimaryImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const imageId = req.params.imageId as string;

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      select: { id: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });

    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

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
    console.error('Set primary image error:', error);
    res.status(500).json({ error: 'Failed to set primary image' });
  }
};
