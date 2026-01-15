import { Request, Response } from 'express';
import { verifyWebhook } from '../services/meta.service';
import { generateAIResponse } from '../services/ai.service';
import { sendMessage } from '../services/meta.service';
import prisma from '../config/database';

export const verifyMetaWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = verifyWebhook({ mode, token, challenge });

    if (result) {
      res.status(200).send(result);
    } else {
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const handleMetaWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = req.body;

    // Acknowledge webhook immediately
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    if (body.object === 'page') {
      for (const entry of body.entry) {
        const pageId = entry.id;

        // Handle messaging events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await handleMessagingEvent(event, pageId);
          }
        }
      }
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
  }
};

async function handleMessagingEvent(event: any, pageId: string): Promise<void> {
  try {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const message = event.message;

    // Ignore messages sent by the page itself
    if (!message || !message.text) {
      return;
    }

    // Find the page in our database
    const page = await prisma.page.findFirst({
      where: {
        pageId: pageId,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    if (!page) {
      console.log(`Page ${pageId} not found or inactive`);
      return;
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        platform_pageId_senderId: {
          platform: page.platform,
          pageId: page.id,
          senderId: senderId,
        },
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          pageId: page.id,
          senderId: senderId,
          platform: page.platform,
          userId: page.userId,
        },
        include: {
          messages: true,
        },
      });
    }

    // Save incoming message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: message.mid,
        senderId: senderId,
        recipientId: recipientId,
        text: message.text,
        timestamp: new Date(message.timestamp || Date.now()),
        isFromPage: false,
      },
    });

    // Get AI settings for the user
    const aiSettings = await prisma.aISettings.findUnique({
      where: {
        userId: page.userId,
      },
    });

    // Check if auto-reply is enabled
    if (!aiSettings || !aiSettings.autoReply) {
      return;
    }

    // Build conversation history
    const conversationHistory = conversation.messages.reverse().map((msg: any) => ({
      role: (msg.isFromPage ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.text || '',
    }));

    // Add the new message
    conversationHistory.push({
      role: 'user',
      content: message.text,
    });

    // Generate AI response
    const aiResponse = await generateAIResponse({
      conversationHistory,
      businessContext: aiSettings.businessContext || undefined,
      customInstructions: aiSettings.customInstructions || undefined,
      model: aiSettings.aiModel,
    });

    // Send response via Meta API
    await sendMessage({
      pageAccessToken: page.pageAccessToken,
      recipientId: senderId,
      message: aiResponse,
      platform: page.platform as 'facebook' | 'instagram',
    });

    // Save AI response to database
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: `ai_${Date.now()}`,
        senderId: recipientId,
        recipientId: senderId,
        text: aiResponse,
        timestamp: new Date(),
        isFromPage: true,
      },
    });
  } catch (error) {
    console.error('Error handling messaging event:', error);
  }
}
