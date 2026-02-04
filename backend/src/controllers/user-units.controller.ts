import { Request, Response } from 'express';
import prisma from '../config/database';

// Get all units (system defaults + user's custom units)
export const getUnits = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const units = await prisma.unit.findMany({
      where: {
        OR: [
          { userId: null },          // system defaults
          { userId: req.user.userId }, // user's custom units
        ],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    res.json({ units });
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
};

// Create a custom unit for the user
export const createUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, abbreviation } = req.body;

    const trimmedName = name?.trim();
    const trimmedAbbr = abbreviation?.trim();

    if (!trimmedName || !trimmedAbbr) {
      res.status(400).json({ error: 'Name and abbreviation are required' });
      return;
    }

    if (trimmedName.length > 255) {
      res.status(400).json({ error: 'Unit name is too long (max 255)' });
      return;
    }

    if (trimmedAbbr.length > 20) {
      res.status(400).json({ error: 'Abbreviation is too long (max 20)' });
      return;
    }

    const unit = await prisma.unit.create({
      data: {
        userId: req.user.userId,
        name: trimmedName,
        abbreviation: trimmedAbbr,
        isDefault: false,
      },
    });

    res.status(201).json({ unit });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Unit with this name already exists' });
      return;
    }
    console.error('Create unit error:', error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
};

// Update a user's custom unit (not system defaults)
export const updateUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const unitId = req.params.unitId as string;
    const { name, abbreviation } = req.body;

    const existing = await prisma.unit.findFirst({
      where: { id: unitId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Unit not found or is a system default' });
      return;
    }

    const unit = await prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(name && { name: name.trim() }),
        ...(abbreviation && { abbreviation: abbreviation.trim() }),
      },
    });

    res.json({ unit });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Unit with this name already exists' });
      return;
    }
    console.error('Update unit error:', error);
    res.status(500).json({ error: 'Failed to update unit' });
  }
};

// Delete a user's custom unit (if no products reference it)
export const deleteUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const unitId = req.params.unitId as string;

    const existing = await prisma.unit.findFirst({
      where: { id: unitId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Unit not found or is a system default' });
      return;
    }

    // Check if any products reference this unit
    const productCount = await prisma.product.count({
      where: { unitId },
    });

    if (productCount > 0) {
      res.status(400).json({ error: `Cannot delete unit: ${productCount} product(s) still use it` });
      return;
    }

    await prisma.unit.delete({ where: { id: unitId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete unit error:', error);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
};
