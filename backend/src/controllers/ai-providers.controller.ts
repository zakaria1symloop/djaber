import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================================================
// Get active providers + models (public — for agent form)
// ============================================================================

export const getActiveProviders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await prisma.aIProvider.findMany({
      where: { isActive: true },
      select: {
        provider: true,
        displayName: true,
        models: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = providers.map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      models: JSON.parse(p.models) as string[],
    }));

    res.json({ providers: result });
  } catch (error) {
    console.error('Get active providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
};

// ============================================================================
// Get all providers (admin)
// ============================================================================

export const getAllProviders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await prisma.aIProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Mask API keys for security — only show last 8 chars
    const result = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `...${p.apiKey.slice(-8)}` : '',
      models: JSON.parse(p.models),
    }));

    res.json({ providers: result });
  } catch (error) {
    console.error('Get all providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
};

// ============================================================================
// Update provider (admin — set API key, toggle active)
// ============================================================================

export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = String(req.params.provider);
    const { apiKey, isActive, models } = req.body;

    const existing = await prisma.aIProvider.findUnique({ where: { provider } });
    if (!existing) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const updateData: any = {};
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (models !== undefined) updateData.models = JSON.stringify(models);

    const updated = await prisma.aIProvider.update({
      where: { provider },
      data: updateData,
    });

    res.json({
      provider: {
        ...updated,
        apiKey: updated.apiKey ? `...${updated.apiKey.slice(-8)}` : '',
        models: JSON.parse(updated.models),
      },
    });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
};
