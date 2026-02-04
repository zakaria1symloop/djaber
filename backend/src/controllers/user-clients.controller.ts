import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================================================
// Get Clients
// ============================================================================

export const getClients = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { search, isActive } = req.query;

    const where: any = { userId: req.user.userId };

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
};

// ============================================================================
// Get Client
// ============================================================================

export const getClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const clientId = req.params.clientId as string;

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json({ client });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
};

// ============================================================================
// Create Client
// ============================================================================

export const createClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, phone, email, address, notes, source } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Client name is required' });
      return;
    }

    const client = await prisma.client.create({
      data: {
        userId: req.user.userId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        source: source || 'manual',
      },
    });

    res.status(201).json({ client });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A client with this phone number already exists' });
      return;
    }
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
};

// ============================================================================
// Update Client
// ============================================================================

export const updateClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const clientId = req.params.clientId as string;
    const { name, phone, email, address, notes, isActive } = req.body;

    const existing = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ client });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A client with this phone number already exists' });
      return;
    }
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
};

// ============================================================================
// Delete Client
// ============================================================================

export const deleteClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const clientId = req.params.clientId as string;

    const existing = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await prisma.client.delete({ where: { id: clientId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
};
