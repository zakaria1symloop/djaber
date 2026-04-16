import { Request, Response } from 'express';
import prisma from '../config/database';
import { wilayas } from '../data/wilayas';
import { decrypt } from '../utils/encryption';
import * as deliveryService from '../services/delivery.service';

// Default fallback pricing (DA) — user can override per-wilaya
const DEFAULT_FEES: Record<number, { home: number; stopdesk: number; return: number }> = {
  // Algiers region (cheapest)
  16: { home: 400, stopdesk: 250, return: 200 },
  9: { home: 450, stopdesk: 300, return: 200 }, 35: { home: 450, stopdesk: 300, return: 200 }, 42: { home: 450, stopdesk: 300, return: 200 },
  // Center-North
  6: { home: 600, stopdesk: 400, return: 300 }, 10: { home: 600, stopdesk: 400, return: 300 }, 15: { home: 600, stopdesk: 400, return: 300 },
  19: { home: 600, stopdesk: 400, return: 300 }, 25: { home: 700, stopdesk: 450, return: 300 }, 26: { home: 600, stopdesk: 400, return: 300 },
  34: { home: 600, stopdesk: 400, return: 300 }, 43: { home: 600, stopdesk: 400, return: 300 }, 44: { home: 600, stopdesk: 400, return: 300 },
  // East
  4: { home: 700, stopdesk: 450, return: 300 }, 5: { home: 700, stopdesk: 450, return: 300 }, 18: { home: 700, stopdesk: 450, return: 300 },
  21: { home: 700, stopdesk: 450, return: 300 }, 23: { home: 700, stopdesk: 450, return: 300 }, 24: { home: 700, stopdesk: 450, return: 300 },
  36: { home: 750, stopdesk: 500, return: 350 }, 40: { home: 750, stopdesk: 500, return: 350 }, 41: { home: 750, stopdesk: 500, return: 350 },
  // West
  13: { home: 700, stopdesk: 450, return: 300 }, 22: { home: 700, stopdesk: 450, return: 300 }, 27: { home: 650, stopdesk: 400, return: 300 },
  29: { home: 650, stopdesk: 400, return: 300 }, 31: { home: 600, stopdesk: 400, return: 300 }, 46: { home: 700, stopdesk: 450, return: 300 },
  48: { home: 650, stopdesk: 400, return: 300 },
  // Center-South
  2: { home: 550, stopdesk: 400, return: 300 }, 14: { home: 650, stopdesk: 400, return: 300 }, 17: { home: 700, stopdesk: 450, return: 300 },
  20: { home: 650, stopdesk: 400, return: 300 }, 28: { home: 650, stopdesk: 400, return: 300 }, 38: { home: 650, stopdesk: 400, return: 300 },
  // Hauts-Plateaux / South (more expensive)
  3: { home: 800, stopdesk: 500, return: 400 }, 7: { home: 800, stopdesk: 500, return: 400 }, 12: { home: 800, stopdesk: 500, return: 400 },
  32: { home: 900, stopdesk: 600, return: 400 }, 39: { home: 900, stopdesk: 600, return: 400 }, 45: { home: 900, stopdesk: 600, return: 400 },
  47: { home: 900, stopdesk: 600, return: 400 }, 51: { home: 950, stopdesk: 650, return: 450 }, 55: { home: 950, stopdesk: 650, return: 450 },
  57: { home: 950, stopdesk: 650, return: 450 }, 58: { home: 950, stopdesk: 650, return: 450 },
  // Deep South (most expensive)
  1: { home: 1200, stopdesk: 800, return: 500 }, 8: { home: 1100, stopdesk: 700, return: 500 }, 11: { home: 1400, stopdesk: 900, return: 600 },
  30: { home: 1100, stopdesk: 700, return: 500 }, 33: { home: 1500, stopdesk: 1000, return: 700 }, 37: { home: 1400, stopdesk: 900, return: 600 },
  49: { home: 1300, stopdesk: 850, return: 600 }, 50: { home: 1500, stopdesk: 1000, return: 700 }, 52: { home: 1300, stopdesk: 850, return: 600 },
  53: { home: 1500, stopdesk: 1000, return: 700 }, 54: { home: 1600, stopdesk: 1100, return: 700 }, 56: { home: 1500, stopdesk: 1000, return: 700 },
};

const defaultFor = (wilayaId: number) => DEFAULT_FEES[wilayaId] || { home: 800, stopdesk: 500, return: 400 };

// ============================================================================
// List rules (returns full 58-wilaya table with user overrides merged)
// ============================================================================

export const getDeliveryFeeRules = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const rules = await prisma.deliveryFeeRule.findMany({
      where: { userId: req.user.userId },
    });
    const ruleMap = new Map(rules.map(r => [r.wilayaId, r]));

    const table = wilayas.map(w => {
      const rule = ruleMap.get(w.id);
      const def = defaultFor(w.id);
      return {
        wilayaId: w.id,
        code: w.code,
        name: w.nameFr,
        nameAr: w.name,
        homePrice: rule ? Number(rule.homePrice) : def.home,
        stopdeskPrice: rule ? Number(rule.stopdeskPrice) : def.stopdesk,
        returnPrice: rule ? Number(rule.returnPrice) : def.return,
        isCustom: !!rule,
        isActive: rule ? rule.isActive : true,
      };
    });

    res.json({ rules: table });
  } catch (error) {
    console.error('Get delivery fees error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery fees' });
  }
};

// ============================================================================
// Upsert a single rule
// ============================================================================

export const upsertDeliveryFeeRule = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { wilayaId, homePrice, stopdeskPrice, returnPrice, isActive } = req.body;

    const wid = Number(wilayaId);
    if (!wid || wid < 1 || wid > 58) {
      res.status(400).json({ error: 'Invalid wilayaId (1-58)' });
      return;
    }

    const rule = await prisma.deliveryFeeRule.upsert({
      where: { userId_wilayaId: { userId: req.user.userId, wilayaId: wid } },
      create: {
        userId: req.user.userId,
        wilayaId: wid,
        homePrice: Number(homePrice) || 0,
        stopdeskPrice: Number(stopdeskPrice) || 0,
        returnPrice: Number(returnPrice) || 0,
        isActive: isActive !== false,
      },
      update: {
        homePrice: homePrice !== undefined ? Number(homePrice) : undefined,
        stopdeskPrice: stopdeskPrice !== undefined ? Number(stopdeskPrice) : undefined,
        returnPrice: returnPrice !== undefined ? Number(returnPrice) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    res.json({ rule });
  } catch (error) {
    console.error('Upsert delivery fee error:', error);
    res.status(500).json({ error: 'Failed to save delivery fee' });
  }
};

// ============================================================================
// Bulk seed defaults for all 58 wilayas
// ============================================================================

export const seedDeliveryFees = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { overwrite = false } = req.body;

    const existing = await prisma.deliveryFeeRule.findMany({
      where: { userId: req.user.userId },
      select: { wilayaId: true },
    });
    const existingIds = new Set(existing.map(e => e.wilayaId));

    const ops = wilayas
      .filter(w => overwrite || !existingIds.has(w.id))
      .map(w => {
        const def = defaultFor(w.id);
        return prisma.deliveryFeeRule.upsert({
          where: { userId_wilayaId: { userId: req.user!.userId, wilayaId: w.id } },
          create: {
            userId: req.user!.userId,
            wilayaId: w.id,
            homePrice: def.home,
            stopdeskPrice: def.stopdesk,
            returnPrice: def.return,
          },
          update: overwrite
            ? { homePrice: def.home, stopdeskPrice: def.stopdesk, returnPrice: def.return }
            : {},
        });
      });

    await prisma.$transaction(ops);

    res.json({ success: true, seeded: ops.length });
  } catch (error) {
    console.error('Seed delivery fees error:', error);
    res.status(500).json({ error: 'Failed to seed delivery fees' });
  }
};

// ============================================================================
// Delete a rule (revert to default)
// ============================================================================

export const deleteDeliveryFeeRule = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const wilayaId = Number(req.params.wilayaId);

    await prisma.deliveryFeeRule.deleteMany({
      where: { userId: req.user.userId, wilayaId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete delivery fee error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
};

// ============================================================================
// Quote a single fee (used by orders UI + AI agent)
// ============================================================================

export async function computeDeliveryFee(
  userId: string,
  wilayaId: number,
  isStopdesk: boolean = false
): Promise<{ fee: number; source: 'provider' | 'custom' | 'default'; currency: string }> {
  // 1. Try default provider real-time rates
  const provider = await prisma.deliveryProvider.findFirst({
    where: { userId, isActive: true, isDefault: true },
  });
  if (provider) {
    try {
      const creds = JSON.parse(decrypt(provider.credentials)) as Record<string, string>;
      const rates = await deliveryService.getDeliveryRates(
        provider.provider,
        creds,
        provider.senderWilayaId || 16,
        wilayaId
      );
      if (rates?.success && rates.rates) {
        const r = rates.rates as { home?: number; stopdesk?: number; desk?: number };
        const fee = isStopdesk ? (r.stopdesk ?? r.desk ?? 0) : (r.home ?? 0);
        if (fee > 0) return { fee, source: 'provider', currency: 'DA' };
      }
    } catch {
      // Fall through to custom/default
    }
  }

  // 2. User's custom rule
  const rule = await prisma.deliveryFeeRule.findUnique({
    where: { userId_wilayaId: { userId, wilayaId } },
  });
  if (rule && rule.isActive) {
    return {
      fee: Number(isStopdesk ? rule.stopdeskPrice : rule.homePrice),
      source: 'custom',
      currency: 'DA',
    };
  }

  // 3. System default
  const def = defaultFor(wilayaId);
  return { fee: isStopdesk ? def.stopdesk : def.home, source: 'default', currency: 'DA' };
}

export const quoteDeliveryFee = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const wilayaId = Number(req.query.wilayaId);
    const isStopdesk = req.query.isStopdesk === 'true';

    if (!wilayaId || wilayaId < 1 || wilayaId > 58) {
      res.status(400).json({ error: 'Invalid wilayaId' });
      return;
    }

    const quote = await computeDeliveryFee(req.user.userId, wilayaId, isStopdesk);
    const wilaya = wilayas.find(w => w.id === wilayaId);

    res.json({
      ...quote,
      wilayaId,
      wilayaName: wilaya?.nameFr,
      isStopdesk,
    });
  } catch (error) {
    console.error('Quote delivery fee error:', error);
    res.status(500).json({ error: 'Failed to quote fee' });
  }
};
