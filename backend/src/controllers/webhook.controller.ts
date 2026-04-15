import { Request, Response } from 'express';
import { verifyWebhook } from '../services/meta.service';
import { generateAIResponse, generateAgentResponse } from '../services/ai.service';
import { sendMessage, sendProductCards } from '../services/meta.service';
import { createNotification } from '../services/notification.service';
import { trackImpressions } from '../services/recommendation.service';
import { queueMessage } from '../services/message-batcher';
import prisma from '../config/database';

// Regex to extract [STATUS:OK|UNCLEAR|UNKNOWN:detail] from end of AI response
const STATUS_TAG_RE = /\[STATUS:(OK|UNCLEAR|UNKNOWN)(?::([^\]]*))?\]\s*$/;
// Regex to extract [RECOMMEND:sourceId:recommendedId] tags
const RECOMMEND_TAG_RE = /\[RECOMMEND:([^\]:]+):([^\]]+)\]/g;

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
      } else if (att.type === 'sticker' && att.payload?.url) {
        // Treat stickers as images
        imageUrls.push(att.payload.url);
      } else if (UNSUPPORTED_ATTACHMENT_TYPES.has(att.type)) {
        unsupportedType = att.type;
      }
    }
  }

  // Facebook sometimes sends sticker_id directly on the message
  if (message.sticker_id && imageUrls.length === 0) {
    // Sticker without URL — treat as a thumbs-up or similar reaction, ignore gracefully
    if (!message.text) {
      unsupportedType = 'sticker';
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

    // Auto-link conversation to a client (non-fatal)
    if (!conversation.clientId) {
      try {
        // Look for an existing client linked to any conversation with the same senderId
        const linkedConversation = await prisma.conversation.findFirst({
          where: {
            userId: page.userId,
            senderId: senderId,
            clientId: { not: null },
          },
          select: { clientId: true },
        });

        let autoClientId: string | null = linkedConversation?.clientId || null;

        if (!autoClientId) {
          // Create a new client
          const platformLabel = page.platform === 'instagram' ? 'IG' : 'FB';
          const shortId = senderId.slice(-6);
          const newClient = await prisma.client.create({
            data: {
              userId: page.userId,
              name: `${platformLabel} User ${shortId}`,
              source: 'ai',
            },
          });
          autoClientId = newClient.id;
        }

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { clientId: autoClientId },
        });
        (conversation as any).clientId = autoClientId;
      } catch (autoLinkError) {
        console.error('Auto-link client error (non-fatal):', autoLinkError);
      }
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
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                      select: { filename: true },
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
      // Skip AI if conversation is paused for human intervention
      if (conversation.status !== 'active') {
        console.log(`Conversation ${conversation.id} is "${conversation.status}" — skipping AI, human takeover`);
        // Create insight + notify the owner that customer is waiting
        await prisma.agentInsight.create({
          data: {
            agentId: agentPage.agent.id,
            conversationId: conversation.id,
            type: 'unclear',
            customerMessage: messageText || '(attachment)',
            aiResponse: '(AI paused — human takeover)',
            detail: 'Customer still waiting while AI is paused',
          },
        });
        await createNotification({
          userId: page.userId,
          type: 'agent_insight',
          title: 'Customer Still Waiting',
          message: `Customer sent: "${(messageText || '(attachment)').substring(0, 100)}". AI is paused — please respond manually.`,
          metadata: { conversationId: conversation.id, agentId: agentPage.agent.id, customerMessage: messageText || '(attachment)' },
        });
        return;
      }

      const agent = agentPage.agent;
      console.log(`Agent "${agent.name}" handling message on page ${pageId}`);

      // Gibberish detector — flag obvious nonsense before AI wastes tokens
      const isGibberish = messageText && (
        // Very short random chars (less than 3 chars, no real word)
        (messageText.length <= 3 && !/^(hi|ok|no|da|oui|non|slm|cv|wsh)$/i.test(messageText.trim())) ||
        // Repeated same char
        /^(.)\1{3,}$/i.test(messageText.trim()) ||
        // Random consonants with no vowels (4+ chars)
        (messageText.length >= 4 && !/[aeiouyéèêëàâùûôîïaeiou]/i.test(messageText))
      );

      if (isGibberish) {
        console.log(`Gibberish detected: "${messageText}" — flagging for human`);
        const politeReply = 'Désolé, je n\'ai pas compris votre message. Un membre de notre équipe va vous répondre bientôt. 😊';
        await sendMessage({
          pageAccessToken: page.pageAccessToken,
          recipientId: senderId,
          message: politeReply,
          platform: page.platform as 'facebook' | 'instagram',
        });
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            messageId: `agent_${Date.now()}`,
            senderId: recipientId,
            recipientId: senderId,
            text: politeReply,
            timestamp: new Date(),
            isFromPage: true,
          },
        });
        // Pause conversation for human takeover
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'resolved' },
        });
        // Create insight record (shows in Agent Insights)
        await prisma.agentInsight.create({
          data: {
            agentId: agent.id,
            conversationId: conversation.id,
            type: 'unclear',
            customerMessage: messageText || '[gibberish]',
            aiResponse: politeReply,
            detail: 'Gibberish detected — auto-flagged for human',
          },
        });
        // Create notification
        await createNotification({
          userId: page.userId,
          type: 'agent_insight',
          title: 'Human Intervention Needed',
          message: `Customer sent unclear message: "${messageText}". AI paused — waiting for human response.`,
          metadata: { conversationId: conversation.id, agentId: agent.id, customerMessage: messageText },
        });
        return;
      }

      // Message batching — queue and wait for more messages before responding
      const responseDelay = ((agent as any).responseDelay ?? 3) * 1000;

      queueMessage(
        conversation.id,
        messageText,
        imageUrls,
        responseDelay,
        async (_combinedText: string, _combinedImages: string[]) => {
          // Re-fetch conversation to get latest messages (user may have sent more)
          const freshConvo = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: { messages: { orderBy: { timestamp: 'desc' }, take: 30 } },
          });
          if (!freshConvo || freshConvo.status !== 'active') return;

          const conversationHistory = freshConvo.messages.reverse().map((msg: any) => ({
            role: msg.isFromPage ? 'assistant' as const : 'user' as const,
            content: msg.text || '(attachment)',
          }));

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
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { filename: true },
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
      const { getImageUrl } = require('../config/upload');
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
        primaryImageUrl: p.images?.[0]?.filename
          ? (p.images[0].url?.startsWith('http') ? p.images[0].url : getImageUrl(p.images[0].filename))
          : null,
      }));

      // Generate response via LangChain (pass image URLs for multimodal)
      const rawAiResponse = await generateAgentResponse({
        agent: {
          name: agent.name,
          personality: agent.personality,
          customInstructions: agent.customInstructions,
          productTemplate: (agent as any).productTemplate || null,
          closingInstructions: (agent as any).closingInstructions || null,
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

      // Parse and strip status tag from AI response
      const statusMatch = rawAiResponse.match(STATUS_TAG_RE);
      let aiResponse = rawAiResponse.replace(STATUS_TAG_RE, '').trim();
      const statusType = statusMatch?.[1] || 'OK';
      const statusDetail = statusMatch?.[2]?.trim() || null;

      // Parse and strip RECOMMEND tags + track impressions
      const recommendMatches = [...aiResponse.matchAll(RECOMMEND_TAG_RE)];
      if (recommendMatches.length > 0) {
        // Find matching recommendation IDs and track impressions
        try {
          const pairs = recommendMatches.map(m => ({
            sourceId: m[1],
            recommendedId: m[2],
          }));
          const recRecords = await prisma.productRecommendation.findMany({
            where: {
              userId: page.userId,
              OR: pairs.map(p => ({
                productId: p.sourceId,
                recommendedId: p.recommendedId,
              })),
            },
            select: { id: true },
          });
          if (recRecords.length > 0) {
            await trackImpressions(recRecords.map(r => r.id));
          }
        } catch (recError) {
          // Non-critical
        }
        // Strip RECOMMEND tags from response
        aiResponse = aiResponse.replace(RECOMMEND_TAG_RE, '').replace(/\n{2,}/g, '\n').trim();
      }

      // Extract [PRODUCT_CARD:id] tags from AI response
      const PRODUCT_CARD_RE = /\[PRODUCT_CARD:([^\]]+)\]/g;
      const cardMatches = [...aiResponse.matchAll(PRODUCT_CARD_RE)];
      const cardProductIds = cardMatches.map((m) => m[1]);

      // Strip card tags from text response
      let textResponse = aiResponse.replace(PRODUCT_CARD_RE, '').replace(/\n{3,}/g, '\n\n').trim();

      // Send text response first (clean, without status/recommend/card tags)
      await sendMessage({
        pageAccessToken: page.pageAccessToken,
        recipientId: senderId,
        message: textResponse,
        platform: page.platform as 'facebook' | 'instagram',
      });

      // Then send product cards as a Facebook Generic Template
      if (cardProductIds.length > 0) {
        const cards = cardProductIds
          .map((pid) => {
            const product = productInfos.find((p: any) => p.id === pid);
            if (!product) return null;
            return {
              title: product.name,
              subtitle: `${Number(product.sellingPrice).toLocaleString()} DA`,
              imageUrl: product.primaryImageUrl || product.imageUrl || undefined,
              productId: product.id,
            };
          })
          .filter(Boolean) as Array<{ title: string; subtitle: string; imageUrl?: string; productId: string }>;

        if (cards.length > 0) {
          await sendProductCards({
            pageAccessToken: page.pageAccessToken,
            recipientId: senderId,
            cards,
            platform: page.platform as 'facebook' | 'instagram',
          });
        }
      }

      // Save AI response (clean text, no tags)
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: `agent_${Date.now()}`,
          senderId: recipientId,
          recipientId: senderId,
          text: textResponse,
          timestamp: new Date(),
          isFromPage: true,
        },
      });

      // Set agentId on conversation (once)
      if (!(conversation as any).agentId) {
        try {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { agentId: agent.id },
          });
          (conversation as any).agentId = agent.id;
        } catch {}
      }

      // UNCLEAR/UNKNOWN → pause AI on this conversation so human takes over
      if (statusType === 'UNCLEAR' || statusType === 'UNKNOWN') {
        // Mark conversation as needing human attention — AI won't auto-reply anymore
        try {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: 'resolved' }, // 'resolved' pauses AI auto-reply
          });
        } catch {}
      }
      if (statusType === 'UNCLEAR' || statusType === 'UNKNOWN') {
        try {
          await prisma.agentInsight.create({
            data: {
              agentId: agent.id,
              conversationId: conversation.id,
              type: statusType === 'UNCLEAR' ? 'unclear' : 'unknown_topic',
              customerMessage: messageText || '[image/attachment]',
              aiResponse: textResponse,
              detail: statusDetail,
            },
          });

          await createNotification({
            userId: page.userId,
            type: 'agent_insight',
            title: statusType === 'UNCLEAR' ? 'Agent Couldn\'t Understand' : 'Unknown Question Detected',
            message: `Agent "${agent.name}" flagged: ${statusDetail || (statusType === 'UNCLEAR' ? 'Couldn\'t understand the customer' : 'Customer asked about something unknown')}`,
            metadata: {
              agentId: agent.id,
              agentName: agent.name,
              conversationId: conversation.id,
              type: statusType.toLowerCase(),
              detail: statusDetail,
            },
          });
        } catch (insightError) {
          console.error('Create agent insight error (non-fatal):', insightError);
        }
      }

        } // end of queueMessage callback
      ); // end of queueMessage call
      return; // webhook handler returns immediately, AI processes after delay
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
