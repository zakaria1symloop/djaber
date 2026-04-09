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

    const { search, phone, isActive, source, minOrders, maxOrders, minSpent, maxSpent, startDate, endDate } = req.query;

    const where: any = { userId: req.user.userId };

    // Date filter on client createdAt
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    // Separate phone search
    if (phone) {
      where.phone = { contains: phone as string };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Source filter
    if (source) {
      where.source = source as string;
    }

    // Orders range
    const parsedMinOrders = minOrders ? parseInt(minOrders as string, 10) : NaN;
    const parsedMaxOrders = maxOrders ? parseInt(maxOrders as string, 10) : NaN;
    if (!isNaN(parsedMinOrders) && parsedMinOrders > 0) {
      where.totalOrders = { ...(where.totalOrders || {}), gte: parsedMinOrders };
    }
    if (!isNaN(parsedMaxOrders) && parsedMaxOrders > 0) {
      where.totalOrders = { ...(where.totalOrders || {}), lte: parsedMaxOrders };
    }

    // Spent range
    const parsedMinSpent = minSpent ? parseFloat(minSpent as string) : NaN;
    const parsedMaxSpent = maxSpent ? parseFloat(maxSpent as string) : NaN;
    if (!isNaN(parsedMinSpent) && parsedMinSpent > 0) {
      where.totalSpent = { ...(where.totalSpent || {}), gte: parsedMinSpent };
    }
    if (!isNaN(parsedMaxSpent) && parsedMaxSpent > 0) {
      where.totalSpent = { ...(where.totalSpent || {}), lte: parsedMaxSpent };
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { conversations: true } } },
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
      include: { _count: { select: { conversations: true } } },
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

// ============================================================================
// Get Client Metrics (AI conversation stats)
// ============================================================================

export const getClientMetrics = async (req: Request, res: Response): Promise<void> => {
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

    // Get conversations for this client
    const conversations = await prisma.conversation.findMany({
      where: { clientId, userId: req.user.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { text: true, timestamp: true, isFromPage: true },
        },
        page: {
          select: { pageName: true, platform: true },
        },
      },
    });

    // Aggregate message stats across all client conversations
    const conversationIds = conversations.map(c => c.id);

    let totalMessages = 0;
    let messagesSent = 0;
    let messagesReceived = 0;
    let aiResponseCount = 0;
    let lastMessageDate: Date | null = null;

    if (conversationIds.length > 0) {
      const [total, sent, received, lastMsg] = await Promise.all([
        prisma.message.count({ where: { conversationId: { in: conversationIds } } }),
        prisma.message.count({ where: { conversationId: { in: conversationIds }, isFromPage: true } }),
        prisma.message.count({ where: { conversationId: { in: conversationIds }, isFromPage: false } }),
        prisma.message.findFirst({
          where: { conversationId: { in: conversationIds } },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        }),
      ]);

      totalMessages = total;
      messagesSent = sent;
      messagesReceived = received;
      aiResponseCount = sent; // AI responses = messages sent from page
      lastMessageDate = lastMsg?.timestamp || null;
    }

    res.json({
      metrics: {
        conversationCount: conversations.length,
        totalMessages,
        messagesSent,
        messagesReceived,
        aiResponseCount,
        lastMessageDate,
      },
      conversations: conversations.map(c => ({
        id: c.id,
        platform: c.platform,
        pageName: c.page?.pageName || null,
        status: c.status,
        messageCount: c._count.messages,
        lastMessage: c.messages[0]?.text?.slice(0, 100) || null,
        lastMessageDate: c.messages[0]?.timestamp || null,
        lastMessageIsFromPage: c.messages[0]?.isFromPage || false,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get client metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch client metrics' });
  }
};
