import { Request, Response } from 'express';
import { verifyWebhook } from '../services/meta.service';
import { generateAIResponse, generateAgentResponse } from '../services/ai.service';
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

    console.log('Webhook received:', JSON.stringify(body, null, 2));

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
    } else if (body.object === 'instagram') {
      console.log('Instagram webhook received');
      for (const entry of body.entry) {
        const igUserId = entry.id;
        console.log(`Instagram entry for user: ${igUserId}`);

        // Handle Instagram messaging events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await handleMessagingEvent(event, igUserId);
          }
        }
      }
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
  }
};

// Unsupported attachment types — AI can't process these yet
const UNSUPPORTED_ATTACHMENT_TYPES = new Set(['audio', 'video', 'file', 'location', 'fallback']);

function extractAttachments(message: any): {
  imageUrls: string[];
  unsupportedType: string | null;
} {
  const imageUrls: string[] = [];
  let unsupportedType: string | null = null;

  if (message.attachments && Array.isArray(message.attachments)) {
    for (const att of message.attachments) {
      if (att.type === 'image' && att.payload?.url) {
        imageUrls.push(att.payload.url);
      } else if (UNSUPPORTED_ATTACHMENT_TYPES.has(att.type)) {
        unsupportedType = att.type;
      }
    }
  }

  return { imageUrls, unsupportedType };
}

async function handleMessagingEvent(event: any, pageId: string): Promise<void> {
  try {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const message = event.message;

    // Ignore echo messages or empty events
    if (!message || message.is_echo) {
      return;
    }

    // Extract text and attachments
    const messageText = message.text || null;
    const { imageUrls, unsupportedType } = extractAttachments(message);

    // Determine primary attachment type for storage
    const attachmentType = imageUrls.length > 0
      ? 'image'
      : unsupportedType || (message.attachments?.[0]?.type ?? null);
    const attachmentUrl = imageUrls[0] || message.attachments?.[0]?.payload?.url || null;

    // Skip if no text, no images, and no attachments at all
    if (!messageText && imageUrls.length === 0 && !unsupportedType) {
      return;
    }

    console.log(`Message from ${senderId} on page ${pageId}: text="${messageText || ''}", images=${imageUrls.length}, unsupported=${unsupportedType || 'none'}`);

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
          orderBy: { timestamp: 'desc' },
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

    // Save incoming message (always — regardless of type)
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: message.mid,
        senderId: senderId,
        recipientId: recipientId,
        text: messageText,
        attachmentType,
        attachmentUrl,
        timestamp: new Date(message.timestamp || Date.now()),
        isFromPage: false,
      },
    });

    // ========================================================================
    // If the message is an unsupported type (voice, video, file, etc.)
    // and has NO text and NO images — reply with a polite message
    // ========================================================================
    if (unsupportedType && !messageText && imageUrls.length === 0) {
      const typeLabels: Record<string, string> = {
        audio: 'voice messages',
        video: 'videos',
        file: 'files',
        location: 'locations',
        fallback: 'this type of message',
      };
      const label = typeLabels[unsupportedType] || 'this type of message';
      const politeReply = `Sorry, I can't process ${label} yet. Please send me a text message and I'll be happy to help! 😊`;

      await sendMessage({
        pageAccessToken: page.pageAccessToken,
        recipientId: senderId,
        message: politeReply,
        platform: page.platform as 'facebook' | 'instagram',
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: `auto_${Date.now()}`,
          senderId: recipientId,
          recipientId: senderId,
          text: politeReply,
          timestamp: new Date(),
          isFromPage: true,
        },
      });

      return;
    }

    // Build conversation history from recent messages
    const conversationHistory = conversation.messages.reverse().map((msg: any) => ({
      role: (msg.isFromPage ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.text || '',
    }));

    // ========================================================================
    // Try Agent-based response first (new system)
    // ========================================================================
    const agentPage = await prisma.agentPage.findUnique({
      where: { pageId: page.id },
      include: {
        agent: {
          include: {
            products: {
              include: {
                product: {
                  include: {
                    variants: {
                      where: { isActive: true },
                      select: { name: true, sellingPrice: true, quantity: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (agentPage && agentPage.agent.isActive) {
      const agent = agentPage.agent;
      console.log(`Agent "${agent.name}" handling message on page ${pageId}`);

      // Get products for the agent
      let products: any[];
      if (agent.sellAllProducts) {
        // Fetch all user's active products
        const allProducts = await prisma.product.findMany({
          where: { userId: page.userId, isActive: true },
          include: {
            variants: {
              where: { isActive: true },
              select: { name: true, sellingPrice: true, quantity: true },
            },
          },
        });
        products = allProducts;
      } else {
        // Use only the agent's linked products
        products = agent.products
          .map((ap) => ap.product)
          .filter((p) => p.isActive);
      }

      // Format products for the AI
      const productInfos = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        sellingPrice: Number(p.sellingPrice),
        quantity: p.quantity,
        hasVariants: p.hasVariants ?? (p.variants && p.variants.length > 0),
        variants: p.variants,
        imageUrl: p.imageUrl,
      }));

      // Generate response via LangChain (pass image URLs for multimodal)
      const aiResponse = await generateAgentResponse({
        agent: {
          name: agent.name,
          personality: agent.personality,
          customInstructions: agent.customInstructions,
          aiModel: agent.aiModel,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        },
        products: productInfos,
        conversationHistory,
        userMessage: messageText || (imageUrls.length > 0 ? 'The customer sent an image.' : ''),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        userId: page.userId,
        conversationId: conversation.id,
      });

      // Send response
      await sendMessage({
        pageAccessToken: page.pageAccessToken,
        recipientId: senderId,
        message: aiResponse,
        platform: page.platform as 'facebook' | 'instagram',
      });

      // Save AI response
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: `agent_${Date.now()}`,
          senderId: recipientId,
          recipientId: senderId,
          text: aiResponse,
          timestamp: new Date(),
          isFromPage: true,
        },
      });

      return;
    }

    // ========================================================================
    // Fallback: Legacy AISettings flow (text only)
    // ========================================================================
    if (!messageText) {
      // Legacy flow doesn't support images — skip
      return;
    }

    const aiSettings = await prisma.aISettings.findUnique({
      where: { userId: page.userId },
    });

    if (!aiSettings || !aiSettings.autoReply) {
      return;
    }

    // Add current message to history
    conversationHistory.push({
      role: 'user',
      content: messageText,
    });

    const aiResponse = await generateAIResponse({
      conversationHistory,
      businessContext: aiSettings.businessContext || undefined,
      customInstructions: aiSettings.customInstructions || undefined,
      model: aiSettings.aiModel,
    });

    await sendMessage({
      pageAccessToken: page.pageAccessToken,
      recipientId: senderId,
      message: aiResponse,
      platform: page.platform as 'facebook' | 'instagram',
    });

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
