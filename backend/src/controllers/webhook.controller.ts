import { Request, Response } from 'express';
import { verifyWebhook } from '../services/meta.service';
import { generateAIResponse, generateAgentResponse } from '../services/ai.service';
import { sendMessage, sendProductCards } from '../services/meta.service';
import { createNotification } from '../services/notification.service';
import { trackImpressions } from '../services/recommendation.service';
import { queueMessage } from '../services/message-batcher';
import { hasCredits, consumeCredits, CREDIT_COSTS } from '../services/credits.service';
import { transcribeAudio } from '../services/transcription.service';
import prisma from '../config/database';

// Regex to extract [STATUS:OK|UNCLEAR|UNKNOWN|HANDOFF:detail] from end of AI response
const STATUS_TAG_RE = /\[STATUS:(OK|UNCLEAR|UNKNOWN|HANDOFF)(?::([^\]]*))?\]\s*$/;
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

// ============================================================================
// Meta Data Deletion Callback (required for App Review)
// Meta POSTs form-encoded { signed_request } when a user requests deletion of
// their data. We verify the HMAC signature, delete the person's conversations
// and messages, and reply with { url, confirmation_code } per the spec:
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
// ============================================================================

function parseSignedRequest(signedRequest: string, appSecret: string): Record<string, any> | null {
  try {
    const [encodedSig, payload] = signedRequest.split('.', 2);
    if (!encodedSig || !payload) return null;
    const crypto = require('crypto');
    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export const handleDataDeletion = async (req: Request, res: Response): Promise<void> => {
  try {
    const signedRequest = req.body?.signed_request;
    const appSecret = process.env.META_APP_SECRET;
    if (!signedRequest || !appSecret) {
      res.status(400).json({ error: 'Missing signed_request' });
      return;
    }

    const data = parseSignedRequest(String(signedRequest), appSecret);
    if (!data?.user_id) {
      res.status(400).json({ error: 'Invalid signed_request' });
      return;
    }

    const userId = String(data.user_id);
    const confirmationCode = `del_${Date.now().toString(36)}_${userId.slice(-6)}`;

    // Delete every conversation (and cascaded messages) tied to this person.
    // senderId stores the platform-scoped user id we receive in webhooks.
    try {
      const deleted = await prisma.conversation.deleteMany({ where: { senderId: userId } });
      console.log(`Data deletion request for ${userId}: removed ${deleted.count} conversations (code ${confirmationCode})`);
    } catch (delError) {
      console.error('Data deletion error (still confirming to Meta):', delError);
    }

    const backendUrl = process.env.BACKEND_URL || 'https://djaber.72-60-190-211.sslip.io';
    res.json({
      url: `${backendUrl}/api/webhooks/meta/data-deletion/status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error('Data deletion callback error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
};

export const dataDeletionStatus = async (req: Request, res: Response): Promise<void> => {
  const code = String(req.query.code || 'unknown');
  res.type('html').send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Suppression des données — Djaber.ai</title></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="max-width:480px;padding:2rem;text-align:center">
<h1 style="font-size:1.25rem">Demande de suppression traitée</h1>
<p style="color:#a1a1aa;font-size:.9rem">Vos conversations et messages ont été supprimés de Djaber.ai.<br>Code de confirmation&nbsp;: <code style="color:#fff">${code.replace(/[^a-z0-9_-]/gi, '')}</code></p>
<p style="color:#71717a;font-size:.8rem">Questions&nbsp;? contact@djaber.ai</p>
</div></body></html>`);
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

// Unsupported attachment types — AI can't process these yet (audio is now handled via Whisper)
const UNSUPPORTED_ATTACHMENT_TYPES = new Set(['video', 'file', 'location', 'fallback']);

function extractAttachments(message: any): {
  imageUrls: string[];
  audioUrls: string[];
  unsupportedType: string | null;
} {
  const imageUrls: string[] = [];
  const audioUrls: string[] = [];
  let unsupportedType: string | null = null;

  if (message.attachments && Array.isArray(message.attachments)) {
    console.log('Attachments found:', JSON.stringify(message.attachments.map((a: any) => ({ type: a.type, hasUrl: !!a.payload?.url }))));
    for (const att of message.attachments) {
      if (att.type === 'image' && att.payload?.url) {
        imageUrls.push(att.payload.url);
      } else if (att.type === 'sticker' && att.payload?.url) {
        // Treat stickers as images
        imageUrls.push(att.payload.url);
      } else if (att.type === 'audio' && att.payload?.url) {
        audioUrls.push(att.payload.url);
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

  return { imageUrls, audioUrls, unsupportedType };
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
    let messageText: string | null = message.text || null;
    const { imageUrls, audioUrls, unsupportedType } = extractAttachments(message);
    let voiceTranscribed = false;
    // Audio transcription is gated behind agent.voiceTranscription — done after we have the agent

    // Determine primary attachment type for storage
    const attachmentType = imageUrls.length > 0
      ? 'image'
      : audioUrls.length > 0
      ? 'audio'
      : unsupportedType || (message.attachments?.[0]?.type ?? null);
    const attachmentUrl = imageUrls[0] || audioUrls[0] || message.attachments?.[0]?.payload?.url || null;

    // Skip if nothing usable (audio counts — it may be transcribed below)
    if (!messageText && imageUrls.length === 0 && audioUrls.length === 0 && !unsupportedType) {
      return;
    }

    console.log(`Message from ${senderId} on page ${pageId}: text="${messageText || ''}", images=${imageUrls.length}, audio=${audioUrls.length}, unsupported=${unsupportedType || 'none'}`);

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
                      select: { filename: true, url: true },
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
      // Human takeover: when aiPaused is set (HANDOFF/UNCLEAR/UNKNOWN), the AI
      // stays silent no matter how many new messages arrive. The merchant
      // resumes the AI by setting the conversation back to "active" in the UI.
      if ((conversation as any).aiPaused) {
        console.log(`Conversation ${conversation.id} is paused for human takeover — AI will not reply`);
        return;
      }

      // Auto-reopen resolved conversations when customer sends a new message
      // (customer is trying again — let the AI handle it)
      if (conversation.status !== 'active') {
        console.log(`Auto-reopening conversation ${conversation.id} (was "${conversation.status}") — customer sent new message`);
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'active' },
        });
        conversation.status = 'active';
      }

      const agent = agentPage.agent;
      console.log(`Agent "${agent.name}" handling message on page ${pageId}`);

      // Voice transcription gate — only transcribe if agent has it enabled
      if (audioUrls.length > 0) {
        if ((agent as any).voiceTranscription) {
          const transcripts: string[] = [];
          for (const url of audioUrls) {
            const t = await transcribeAudio(url);
            if (t) transcripts.push(t);
          }
          if (transcripts.length > 0) {
            const joined = transcripts.join(' ');
            messageText = messageText
              ? `${messageText}\n\n[voice note] ${joined}`
              : `[voice note] ${joined}`;
            voiceTranscribed = true;
          }
        } else if (!messageText && imageUrls.length === 0) {
          // Voice off and nothing else to work with — reply politely and stop
          const polite = "Sorry, I can't process voice messages yet. Please send a text message and I'll be happy to help! 😊";
          await sendMessage({
            pageAccessToken: page.pageAccessToken,
            recipientId: senderId,
            message: polite,
            platform: page.platform as 'facebook' | 'instagram',
          });
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              messageId: `auto_${Date.now()}`,
              senderId: recipientId,
              recipientId: senderId,
              text: polite,
              timestamp: new Date(),
              isFromPage: true,
            },
          });
          return;
        }
      }

      // Check credits before AI call
      let creditCost: number;
      if (imageUrls.length > 0 && (agent as any).imageRecognition) {
        creditCost = CREDIT_COSTS.AI_IMAGE_RECOGNITION;
      } else if (voiceTranscribed) {
        creditCost = CREDIT_COSTS.AI_VOICE_TRANSCRIPTION;
      } else {
        creditCost = CREDIT_COSTS.AI_TEXT_MESSAGE;
      }
      const creditCheck = await hasCredits(page.userId, creditCost);
      if (!creditCheck.ok) {
        console.log(`User ${page.userId} out of credits (${creditCheck.used}/${creditCheck.limit})`);
        const outOfCreditsMsg = 'Désolé, notre service est temporairement indisponible. Veuillez réessayer plus tard. 🙏';
        await sendMessage({
          pageAccessToken: page.pageAccessToken,
          recipientId: senderId,
          message: outOfCreditsMsg,
          platform: page.platform as 'facebook' | 'instagram',
        });
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            messageId: `agent_${Date.now()}`,
            senderId: recipientId,
            recipientId: senderId,
            text: outOfCreditsMsg,
            timestamp: new Date(),
            isFromPage: true,
          },
        });
        // Notify user
        await createNotification({
          userId: page.userId,
          type: 'stock_alert',
          title: 'Credits Exhausted',
          message: `You've used all ${creditCheck.limit} credits. AI agent is paused. Upgrade your plan to continue.`,
          metadata: { creditsUsed: creditCheck.used, creditsLimit: creditCheck.limit },
        });
        return;
      }

      // If image recognition is disabled, strip image URLs
      if (imageUrls.length > 0 && !(agent as any).imageRecognition) {
        console.log('Image recognition disabled for this agent — ignoring images');
        imageUrls.length = 0; // Clear images, process as text only
      }

      // Message batching — queue and wait for more messages before responding
      const responseDelay = ((agent as any).responseDelay ?? 3) * 1000;

      queueMessage(
        conversation.id,
        messageText,
        imageUrls,
        responseDelay,
        async (combinedText: string, combinedImages: string[]) => {
          // Re-fetch conversation to get latest messages (user may have sent more)
          const freshConvo = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: { messages: { orderBy: { timestamp: 'desc' }, take: 30 } },
          });
          if (!freshConvo || freshConvo.status !== 'active' || (freshConvo as any).aiPaused) return;

          // Use the full batch: all texts joined + all images across the burst
          const batchText = combinedText || messageText || '';
          const batchImages = combinedImages.length > 0 ? combinedImages : imageUrls;

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
              select: { filename: true, url: true },
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
          humanHandoffRules: (agent as any).humanHandoffRules || null,
          aiModel: agent.aiModel,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        },
        products: productInfos,
        conversationHistory,
        userMessage: batchText || (batchImages.length > 0 ? 'The customer sent an image.' : ''),
        imageUrls: batchImages.length > 0 ? batchImages : undefined,
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

      // Consume credits after successful AI response
      const action = batchImages.length > 0 ? 'image_recognition' : voiceTranscribed ? 'voice_transcription' : 'text_message';
      await consumeCredits(page.userId, creditCost, action, {
        conversationId: conversation.id,
        agentId: agent.id,
        pageId: page.id,
      });

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

      // UNCLEAR → the AI already answered "I didn't get it, please rephrase" and keeps
      // handling the conversation. UNKNOWN/HANDOFF → pause AI so a human takes over.
      // aiPaused persists across new customer messages; the merchant resumes the AI
      // by reopening the conversation (status -> active) in the dashboard.
      if (statusType === 'UNCLEAR' || statusType === 'UNKNOWN' || statusType === 'HANDOFF') {
        if (statusType === 'UNKNOWN' || statusType === 'HANDOFF') {
          try {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { status: 'resolved', aiPaused: true },
            });
          } catch {}
        }

        try {
          const insightType =
            statusType === 'UNCLEAR' ? 'unclear'
            : statusType === 'UNKNOWN' ? 'unknown_topic'
            : 'handoff';
          const titles: Record<string, string> = {
            UNCLEAR: 'Agent Couldn\'t Understand',
            UNKNOWN: 'Unknown Question Detected',
            HANDOFF: 'Human Intervention Requested',
          };
          const fallbackDetails: Record<string, string> = {
            UNCLEAR: 'Couldn\'t understand the customer',
            UNKNOWN: 'Customer asked about something unknown',
            HANDOFF: 'Customer needs a human team member',
          };

          await prisma.agentInsight.create({
            data: {
              agentId: agent.id,
              conversationId: conversation.id,
              type: insightType,
              customerMessage: batchText || '[image/attachment]',
              aiResponse: textResponse,
              detail: statusDetail,
            },
          });

          await createNotification({
            userId: page.userId,
            type: 'agent_insight',
            title: titles[statusType],
            message: `Agent "${agent.name}" flagged: ${statusDetail || fallbackDetails[statusType]}`,
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
