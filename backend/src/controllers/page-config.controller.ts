import { Request, Response } from 'express';
import prisma from '../config/database';
import { getPageInsights, sendMessage } from '../services/meta.service';

/**
 * Get Facebook page insights (followers, engagement, reach)
 */
export const getPageInsightsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { pageId } = req.params;

    // Verify page ownership
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        userId: req.user.userId,
        isActive: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Not Found', message: 'Page not found or access denied' });
      return;
    }

    // Fetch insights from Facebook
    try {
      const insights = await getPageInsights({
        pageId: page.pageId,
        accessToken: page.pageAccessToken,
      });

      res.json({ data: insights.data || [] });
    } catch (metaError) {
      console.error('Facebook API error:', metaError);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Unable to fetch insights from Facebook. The page may need to be reconnected or insights may not be available yet.',
      });
    }
  } catch (error) {
    console.error('Get page insights error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch page insights',
    });
  }
};

/**
 * Get conversations for a specific page with pagination and filters
 */
export const getPageConversationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { pageId } = req.params;
    const { status = 'active', limit = '50', offset = '0' } = req.query;

    // Verify page ownership
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        userId: req.user.userId,
        isActive: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Not Found', message: 'Page not found or access denied' });
      return;
    }

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Build where clause
    const where: any = {
      pageId: page.id,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    // Get conversations with latest message
    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: offsetNum,
      take: limitNum,
    });

    // Get total count
    const total = await prisma.conversation.count({ where });

    // Format response
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      senderId: conv.senderId,
      senderName: conv.senderName,
      status: conv.status,
      lastMessage: conv.messages[0]
        ? {
            text: conv.messages[0].text,
            timestamp: conv.messages[0].timestamp,
            isFromPage: conv.messages[0].isFromPage,
          }
        : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    res.json({
      conversations: formattedConversations,
      total,
      page: Math.floor(offsetNum / limitNum) + 1,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Get page conversations error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch conversations',
    });
  }
};

/**
 * Get message history for a specific page with filters and pagination
 */
export const getPageMessagesController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { pageId } = req.params;
    const { dateFrom, dateTo, type, limit = '50', offset = '0' } = req.query;

    // Verify page ownership
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        userId: req.user.userId,
        isActive: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Not Found', message: 'Page not found or access denied' });
      return;
    }

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Build where clause
    const where: any = {
      conversation: {
        pageId: page.id,
      },
    };

    // Date filters
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) {
        where.timestamp.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.timestamp.lte = new Date(dateTo as string);
      }
    }

    // Type filter
    if (type === 'incoming') {
      where.isFromPage = false;
    } else if (type === 'outgoing') {
      where.isFromPage = true;
    }

    // Get messages with conversation context
    const messages = await prisma.message.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            senderId: true,
            senderName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      skip: offsetNum,
      take: limitNum,
    });

    // Get total count
    const total = await prisma.message.count({ where });

    // Format response
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      messageId: msg.messageId,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      text: msg.text,
      timestamp: msg.timestamp,
      isFromPage: msg.isFromPage,
      conversationId: msg.conversationId,
      senderName: msg.conversation.senderName,
    }));

    res.json({
      messages: formattedMessages,
      total,
      page: Math.floor(offsetNum / limitNum) + 1,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Get page messages error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch messages',
    });
  }
};

/**
 * Get AI settings for a specific page
 */
export const getPageAISettingsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { pageId } = req.params;

    // Verify page ownership
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        userId: req.user.userId,
        isActive: true,
      },
      include: {
        aiSettings: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Not Found', message: 'Page not found or access denied' });
      return;
    }

    // If no settings exist, return defaults
    if (!page.aiSettings) {
      const defaults = {
        pageId: page.id,
        aiEnabled: true,
        aiPersonality: 'professional',
        customInstructions: null,
        autoReply: true,
        responseTone: 'balanced',
        responseLength: 'medium',
      };

      res.json({ settings: defaults });
      return;
    }

    res.json({ settings: page.aiSettings });
  } catch (error) {
    console.error('Get page AI settings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch AI settings',
    });
  }
};

/**
 * Update AI settings for a specific page
 */
export const updatePageAISettingsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { pageId } = req.params;
    const {
      aiEnabled,
      aiPersonality,
      customInstructions,
      autoReply,
      responseTone,
      responseLength,
    } = req.body;

    // Verify page ownership
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        userId: req.user.userId,
        isActive: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Not Found', message: 'Page not found or access denied' });
      return;
    }

    // Upsert settings
    const settings = await prisma.pageAISettings.upsert({
      where: { pageId: page.id },
      update: {
        ...(aiEnabled !== undefined && { aiEnabled }),
        ...(aiPersonality && { aiPersonality }),
        ...(customInstructions !== undefined && { customInstructions }),
        ...(autoReply !== undefined && { autoReply }),
        ...(responseTone && { responseTone }),
        ...(responseLength && { responseLength }),
      },
      create: {
        pageId: page.id,
        aiEnabled: aiEnabled ?? true,
        aiPersonality: aiPersonality || 'professional',
        customInstructions: customInstructions || null,
        autoReply: autoReply ?? true,
        responseTone: responseTone || 'balanced',
        responseLength: responseLength || 'medium',
      },
    });

    res.json({ settings });
  } catch (error) {
    console.error('Update page AI settings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update AI settings',
    });
  }
};

/**
 * Send a manual reply to a conversation
 */
export const sendReplyController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Message text is required' });
      return;
    }

    // Get conversation with page
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: req.user.userId,
      },
      include: {
        page: true,
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Not Found', message: 'Conversation not found or access denied' });
      return;
    }

    // Send message via Meta API
    try {
      const metaResponse = await sendMessage({
        pageAccessToken: conversation.page.pageAccessToken,
        recipientId: conversation.senderId,
        message: message.trim(),
        platform: conversation.platform as 'facebook' | 'instagram',
      });

      // Save message to database
      const savedMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: metaResponse.message_id || `manual_${Date.now()}`,
          senderId: conversation.page.pageId,
          recipientId: conversation.senderId,
          text: message.trim(),
          timestamp: new Date(),
          isFromPage: true,
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      res.json({
        success: true,
        message: 'Reply sent successfully',
        messageId: savedMessage.id,
      });
    } catch (metaError) {
      console.error('Meta send message error:', metaError);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Failed to send message via Facebook. Please try again.',
      });
    }
  } catch (error) {
    console.error('Send reply error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send reply',
    });
  }
};
