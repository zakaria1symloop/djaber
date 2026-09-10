import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

const NAME_MAX = 255;
const ABBR_MAX = 20;

/** Custom unit owned by the caller; 403 when it is a system default, 404 otherwise. */
async function findOwnUnit(unitId: string, userId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new ApiError('UNIT_NOT_FOUND');
  if (unit.userId === null) throw new ApiError('UNIT_SYSTEM_READONLY');
  if (unit.userId !== userId) throw new ApiError('UNIT_NOT_FOUND');
  return unit;
}

// Get all units (system defaults + user's custom units)
export const getUnits = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

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
    handleError(req, res, error, 'UNIT_LIST_FAILED');
  }
};

// Create a custom unit for the user
export const createUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const name = v.requiredString(req.body?.name, 'name', { max: NAME_MAX });
    const abbreviation = v.requiredString(req.body?.abbreviation, 'abbreviation', { max: ABBR_MAX });
    v.throwIfAny();

    const unit = await prisma.unit.create({
      data: {
        userId: req.user.userId,
        name,
        abbreviation,
        isDefault: false,
      },
    });

    res.status(201).json({ unit });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'UNIT_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'UNIT_CREATE_FAILED');
  }
};

// Update a user's custom unit (not system defaults)
export const updateUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const unitId = req.params.unitId as string;
    await findOwnUnit(unitId, req.user.userId);

    const v = new Validator();
    const name = v.optionalString(req.body?.name, 'name', { max: NAME_MAX });
    const abbreviation = v.optionalString(req.body?.abbreviation, 'abbreviation', { max: ABBR_MAX });
    v.throwIfAny();

    const unit = await prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(name && { name }),
        ...(abbreviation && { abbreviation }),
      },
    });

    res.json({ unit });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'UNIT_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'UNIT_UPDATE_FAILED');
  }
};

// Delete a user's custom unit (if no products reference it)
export const deleteUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const unitId = req.params.unitId as string;
    await findOwnUnit(unitId, req.user.userId);

    // Check if any products reference this unit
    const productCount = await prisma.product.count({ where: { unitId } });
    if (productCount > 0) return fail(req, res, 'UNIT_IN_USE', { count: productCount });

    await prisma.unit.delete({ where: { id: unitId } });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'UNIT_DELETE_FAILED');
  }
};
