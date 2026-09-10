import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

// Enumerations mirrored from the Prisma schema comments (model Client)
const CLIENT_SOURCES = ['manual', 'ai'] as const;
const NAME_MAX = 191;

/** Prisma P2002 on [userId, phone] → 409 CLIENT_PHONE_EXISTS. */
const isPhoneConflict = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

// ============================================================================
// Get Clients
// ============================================================================

export const getClients = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { search, phone, isActive, minOrders, maxOrders, minSpent, maxSpent } = req.query;

    const v = new Validator();
    const startDate = v.date(req.query.startDate, 'startDate');
    const endDate = v.date(req.query.endDate, 'endDate');
    const source = v.oneOf(req.query.source, 'source', CLIENT_SOURCES, CLIENT_SOURCES[0]);
    v.throwIfAny();
    if (startDate && endDate && startDate > endDate) throw new ApiError('INVALID_DATE_RANGE');

    const where: any = { userId: req.user.userId };

    // Date filter on client createdAt
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
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
    if (req.query.source) {
      where.source = source;
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
    return handleError(req, res, error, 'CLIENT_FETCH_FAILED');
  }
};

// ============================================================================
// Get Client
// ============================================================================

export const getClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const clientId = req.params.clientId as string;

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
      include: { _count: { select: { conversations: true } } },
    });

    if (!client) return fail(req, res, 'CLIENT_NOT_FOUND');

    res.json({ client });
  } catch (error) {
    return handleError(req, res, error, 'CLIENT_FETCH_FAILED');
  }
};

// ============================================================================
// Create Client
// ============================================================================

export const createClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const name = v.requiredString(req.body.name, 'name', { max: NAME_MAX });
    const phone = v.phone(req.body.phone, 'phone', false);
    const email = v.email(req.body.email, 'email', false);
    const address = v.optionalString(req.body.address, 'address');
    const notes = v.optionalString(req.body.notes, 'notes');
    const source = v.oneOf(req.body.source, 'source', CLIENT_SOURCES, 'manual');
    v.throwIfAny();

    const client = await prisma.client.create({
      data: {
        userId: req.user.userId,
        name,
        phone,
        email,
        address,
        notes,
        source,
      },
    });

    res.status(201).json({ client });
  } catch (error) {
    if (isPhoneConflict(error)) return fail(req, res, 'CLIENT_PHONE_EXISTS');
    return handleError(req, res, error, 'CLIENT_CREATE_FAILED');
  }
};

// ============================================================================
// Update Client
// ============================================================================

export const updateClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const clientId = req.params.clientId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const name = body.name === undefined ? undefined : v.requiredString(body.name, 'name', { max: NAME_MAX });
    const phone = body.phone === undefined ? undefined : v.phone(body.phone, 'phone', false);
    const email = body.email === undefined ? undefined : v.email(body.email, 'email', false);
    const address = body.address === undefined ? undefined : v.optionalString(body.address, 'address');
    const notes = body.notes === undefined ? undefined : v.optionalString(body.notes, 'notes');
    const isActive = body.isActive === undefined ? undefined : v.boolean(body.isActive, 'isActive');
    v.throwIfAny();

    const existing = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
    });

    if (!existing) return fail(req, res, 'CLIENT_NOT_FOUND');

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ client });
  } catch (error) {
    if (isPhoneConflict(error)) return fail(req, res, 'CLIENT_PHONE_EXISTS');
    return handleError(req, res, error, 'CLIENT_UPDATE_FAILED');
  }
};

// ============================================================================
// Delete Client
// ============================================================================

export const deleteClient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const clientId = req.params.clientId as string;

    const existing = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
    });

    if (!existing) return fail(req, res, 'CLIENT_NOT_FOUND');

    await prisma.client.delete({ where: { id: clientId } });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'CLIENT_DELETE_FAILED');
  }
};

// ============================================================================
// Get Client Metrics (AI conversation stats)
// ============================================================================

export const getClientMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const clientId = req.params.clientId as string;

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId: req.user.userId },
    });

    if (!client) return fail(req, res, 'CLIENT_NOT_FOUND');

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
    return handleError(req, res, error, 'CLIENT_METRICS_FAILED');
  }
};
