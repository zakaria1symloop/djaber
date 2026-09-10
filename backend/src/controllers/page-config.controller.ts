import { Request, Response } from 'express';
import prisma from '../config/database';
import { getPageInsights, sendMessage } from '../services/meta.service';
import { syncFacebookConversations } from '../services/page-sync.service';
import { analyzePagePosts, importExtractedProducts } from '../services/page-analysis.service';
import { getPageSummary } from '../services/page-summary.service';
import { generateAgentFromInbox, applyGeneratedAgentToPage } from '../services/agent-generation.service';
import { ApiError, fail, handleError, isApiError } from '../errors';
import { Validator, pagination } from '../middleware/validate';

// ---------------------------------------------------------------------------
// Shared enums / helpers
// ---------------------------------------------------------------------------

const CONVERSATION_STATUSES = ['active', 'resolved', 'archived'] as const;
const CONVERSATION_FILTERS = ['all', 'active', 'resolved', 'archived'] as const;
const MESSAGE_TYPES = ['all', 'incoming', 'outgoing'] as const;
const AI_PERSONALITIES = ['professional', 'friendly', 'casual', 'technical'] as const;
const AI_TONES = ['balanced', 'formal', 'casual', 'enthusiastic'] as const;
const AI_LENGTHS = ['short', 'medium', 'detailed'] as const;

const REPLY_MAX_LENGTH = 2000; // Messenger hard limit on text messages
const CUSTOM_INSTRUCTIONS_MAX = 4000;
const BUSINESS_SUMMARY_MAX = 600;

/**
 * Text fields must really be text. `Validator.requiredString/optionalString`
 * fall back to `String(value)`, which would happily turn `{a:1}` into the
 * literal "[object Object]" — and for a Messenger reply that string would be
 * DELIVERED to the customer. Reject the wrong type up front instead.
 * Returns true when the value is usable (absent, or a real string).
 */
function checkTextType(v: Validator, value: unknown, field: string): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return true;
  v.add(field, 'FIELD_INVALID');
  return false;
}

/** Booleans must really be booleans (or their "true"/"false"/0/1 spellings). */
function checkBooleanType(v: Validator, value: unknown, field: string): boolean {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return true;
  if (value === 'true' || value === 'false' || value === 0 || value === 1 || value === '0' || value === '1') return true;
  v.add(field, 'FIELD_INVALID');
  return false;
}

/** Active page owned by the caller, or throws PAGE_NOT_FOUND. */
async function requireOwnedPage(pageId: string, userId: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, userId, isActive: true },
  });
  if (!page) throw new ApiError('PAGE_NOT_FOUND');
  return page;
}

/** Conversation reachable by the caller (own userId or owner of the page). */
function ownedConversationWhere(conversationId: string, userId: string) {
  return {
    id: conversationId,
    OR: [{ userId }, { page: { userId } }],
  };
}

function platformLabel(platform: string | null | undefined): string {
  return platform === 'instagram' ? 'Instagram' : 'Facebook';
}

/** Facebook Graph error payload, when the thrown value is an axios error from Meta. */
function metaGraphError(err: unknown): { code?: number; subcode?: number; type?: string } | null {
  const e = err as { response?: { data?: { error?: { code?: number; error_subcode?: number; type?: string } } } } | null;
  const fb = e?.response?.data?.error;
  if (!fb) return null;
  return { code: fb.code, subcode: fb.error_subcode, type: fb.type };
}

function isAxiosLike(err: unknown): boolean {
  const e = err as { isAxiosError?: boolean; response?: unknown; request?: unknown } | null;
  return !!e && (e.isAxiosError === true || e.response !== undefined || e.request !== undefined);
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

/**
 * Get Facebook page insights (followers, engagement, reach)
 */
export const getPageInsightsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;
    const page = await requireOwnedPage(pageId, req.user.userId);

    let insights: { data?: unknown[] };
    try {
      insights = await getPageInsights({
        pageId: page.pageId,
        accessToken: page.pageAccessToken,
      });
    } catch (metaError) {
      console.error('Facebook API error:', metaError);
      return fail(req, res, 'INBOX_INSIGHTS_UNAVAILABLE');
    }

    res.json({ data: insights.data || [] });
  } catch (error) {
    return handleError(req, res, error, 'INBOX_INSIGHTS_FAILED');
  }
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/**
 * Get conversations for a specific page with pagination and filters
 */
export const getPageConversationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;

    const v = new Validator();
    const status = v.oneOf(req.query.status, 'status', CONVERSATION_FILTERS, 'active');
    v.throwIfAny();
    const { limit, offset } = pagination(req.query, { limit: 50, maxLimit: 200 });

    const page = await requireOwnedPage(pageId, req.user.userId);

    const where: { pageId: string; status?: string } = { pageId: page.id };
    if (status !== 'all') where.status = status;

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prisma.conversation.count({ where });

    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      senderId: conv.senderId,
      senderName: conv.senderName,
      status: conv.status,
      aiPaused: (conv as any).aiPaused ?? false,
      platform: conv.platform,
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
      page: Math.floor(offset / limit) + 1,
      limit,
    });
  } catch (error) {
    return handleError(req, res, error, 'INBOX_LOAD_FAILED');
  }
};

/**
 * Get message history for a specific page with filters and pagination
 */
export const getPageMessagesController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;

    const v = new Validator();
    const dateFrom = v.date(req.query.dateFrom, 'dateFrom');
    const dateTo = v.date(req.query.dateTo, 'dateTo');
    const type = v.oneOf(req.query.type, 'type', MESSAGE_TYPES, 'all');
    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) throw new ApiError('INVALID_DATE_RANGE');
    v.throwIfAny();
    const { limit, offset } = pagination(req.query, { limit: 50, maxLimit: 200 });

    const page = await requireOwnedPage(pageId, req.user.userId);

    const where: any = {
      conversation: { pageId: page.id },
    };

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = dateFrom;
      if (dateTo) where.timestamp.lte = dateTo;
    }

    if (type === 'incoming') where.isFromPage = false;
    else if (type === 'outgoing') where.isFromPage = true;

    const messages = await prisma.message.findMany({
      where,
      include: {
        conversation: {
          select: { id: true, senderId: true, senderName: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prisma.message.count({ where });

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
      page: Math.floor(offset / limit) + 1,
      limit,
    });
  } catch (error) {
    return handleError(req, res, error, 'INBOX_LOAD_FAILED');
  }
};

// ---------------------------------------------------------------------------
// AI settings
// ---------------------------------------------------------------------------

/**
 * Get AI settings for a specific page
 */
export const getPageAISettingsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;
    const page = await requireOwnedPage(pageId, req.user.userId);

    const aiSettings = await prisma.pageAISettings.findUnique({
      where: { pageId: page.id },
    });

    if (!aiSettings) {
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

    res.json({ settings: aiSettings });
  } catch (error) {
    return handleError(req, res, error, 'INBOX_AI_SETTINGS_LOAD_FAILED');
  }
};

/**
 * Update AI settings for a specific page
 */
export const updatePageAISettingsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;
    const body = req.body || {};

    const v = new Validator();
    const aiEnabled = body.aiEnabled === undefined || !checkBooleanType(v, body.aiEnabled, 'aiEnabled')
      ? undefined
      : v.boolean(body.aiEnabled, 'aiEnabled');
    const autoReply = body.autoReply === undefined || !checkBooleanType(v, body.autoReply, 'autoReply')
      ? undefined
      : v.boolean(body.autoReply, 'autoReply');
    // Empty / absent means "leave unchanged" (matches the previous `&&` semantics).
    const aiPersonality = body.aiPersonality ? v.oneOf(body.aiPersonality, 'aiPersonality', AI_PERSONALITIES) : undefined;
    const responseTone = body.responseTone ? v.oneOf(body.responseTone, 'responseTone', AI_TONES) : undefined;
    const responseLength = body.responseLength ? v.oneOf(body.responseLength, 'responseLength', AI_LENGTHS) : undefined;
    let customInstructions: string | null | undefined;
    if (body.customInstructions !== undefined && checkTextType(v, body.customInstructions, 'customInstructions')) {
      customInstructions = body.customInstructions === null
        ? null
        : v.optionalString(body.customInstructions, 'customInstructions', { max: CUSTOM_INSTRUCTIONS_MAX });
    }
    v.throwIfAny();

    const page = await requireOwnedPage(pageId, req.user.userId);

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
    return handleError(req, res, error, 'INBOX_AI_SETTINGS_UPDATE_FAILED');
  }
};

// ---------------------------------------------------------------------------
// Single conversation
// ---------------------------------------------------------------------------

/**
 * Messages of one conversation (ownership: conversation → page → user)
 */
export const getConversationMessagesController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const conversationId = req.params.conversationId as string;

    const conversation = await prisma.conversation.findFirst({
      where: ownedConversationWhere(conversationId, req.user.userId),
      select: { id: true, senderName: true, senderId: true, status: true, platform: true, aiPaused: true },
    });

    if (!conversation) return fail(req, res, 'CONVERSATION_NOT_FOUND');

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      take: 200,
    });

    res.json({
      conversation,
      messages: messages.map((m) => ({
        id: m.id,
        text: m.text,
        timestamp: m.timestamp,
        isFromPage: m.isFromPage,
        senderId: m.senderId,
        attachmentType: m.attachmentType,
        attachmentUrl: m.attachmentUrl,
      })),
    });
  } catch (error) {
    return handleError(req, res, error, 'CONVERSATION_LOAD_FAILED');
  }
};

export const updateConversationController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const conversationId = req.params.conversationId as string;

    const v = new Validator();
    const status = v.oneOf(req.body?.status, 'status', CONVERSATION_STATUSES);
    v.throwIfAny();

    const conversation = await prisma.conversation.findFirst({
      where: ownedConversationWhere(conversationId, req.user.userId),
    });

    if (!conversation) return fail(req, res, 'CONVERSATION_NOT_FOUND');

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      // Reopening a conversation resumes the AI (clears the human-takeover pause)
      data: status === 'active' ? { status, aiPaused: false } : { status },
    });

    res.json({ conversation: updated });
  } catch (error) {
    return handleError(req, res, error, 'CONVERSATION_UPDATE_FAILED');
  }
};

export const sendReplyController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const conversationId = req.params.conversationId as string;

    const v = new Validator();
    checkTextType(v, req.body?.message, 'message');
    const message = v.requiredString(req.body?.message, 'message', { max: REPLY_MAX_LENGTH });
    v.throwIfAny();

    const conversation = await prisma.conversation.findFirst({
      where: ownedConversationWhere(conversationId, req.user.userId),
    });

    if (!conversation) return fail(req, res, 'CONVERSATION_NOT_FOUND');

    const page = await prisma.page.findUnique({
      where: { id: conversation.pageId },
    });

    if (!page) return fail(req, res, 'PAGE_NOT_FOUND');

    const platform = conversation.platform as 'facebook' | 'instagram';

    let metaResponse: { message_id?: string };
    try {
      metaResponse = await sendMessage({
        pageAccessToken: page.pageAccessToken,
        recipientId: conversation.senderId,
        message,
        platform,
      });
    } catch (metaError: any) {
      console.error('Meta send message error:', metaError?.message || metaError);
      if (metaError?.outsideWindow) return fail(req, res, 'REPLY_OUTSIDE_WINDOW');
      return fail(req, res, 'REPLY_SEND_FAILED', { platform: platformLabel(platform) });
    }

    const savedMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: metaResponse.message_id || `manual_${Date.now()}`,
        senderId: page.pageId,
        recipientId: conversation.senderId,
        text: message,
        timestamp: new Date(),
        isFromPage: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Reply sent successfully',
      messageId: savedMessage.id,
    });
  } catch (error) {
    return handleError(req, res, error, 'REPLY_FAILED');
  }
};

// ---------------------------------------------------------------------------
// Sync / analysis / summary / agent
// ---------------------------------------------------------------------------

/**
 * Pull the latest conversations + messages from Facebook into our DB.
 * Used by the Refresh button in the Messages tab.
 */
export const syncPageConversationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;
    const page = await requireOwnedPage(pageId, req.user.userId);

    let result;
    try {
      result = await syncFacebookConversations(pageId);
    } catch (syncError: any) {
      if (isApiError(syncError)) throw syncError;
      console.error('Sync conversations error:', syncError?.response?.data || syncError?.message || syncError);
      const fb = metaGraphError(syncError);
      // 190 = invalid / expired OAuth access token
      if (fb?.code === 190 || fb?.type === 'OAuthException') return fail(req, res, 'PAGE_SYNC_TOKEN_EXPIRED');
      if (isAxiosLike(syncError)) return fail(req, res, 'PAGE_SYNC_FAILED', { platform: platformLabel(page.platform) });
      throw syncError;
    }

    res.json(result);
  } catch (error) {
    return handleError(req, res, error, 'INBOX_LOAD_FAILED');
  }
};

/**
 * Analyze the page's recent posts with vision AI to suggest products.
 */
export const analyzePagePostsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;

    const v = new Validator();
    const limit = v.integer(req.query.limit, 'limit', { min: 1, max: 50, required: false, def: 30 });
    v.throwIfAny();

    const page = await requireOwnedPage(pageId, req.user.userId);

    let result;
    try {
      result = await analyzePagePosts(pageId, limit);
    } catch (analysisError: any) {
      if (isApiError(analysisError)) throw analysisError;
      console.error('Analyze posts error:', analysisError?.message || analysisError);
      if (analysisError?.name === 'MetaPermissionError') return fail(req, res, 'PAGE_ANALYSIS_PERMISSION_REQUIRED');
      if (isAxiosLike(analysisError)) return fail(req, res, 'PAGE_ANALYSIS_UPSTREAM_FAILED', { platform: platformLabel(page.platform) });
      throw analysisError;
    }

    res.json(result);
  } catch (error) {
    return handleError(req, res, error, 'PAGE_ANALYSIS_FAILED');
  }
};

/**
 * Aggregated dashboard stats for one page (counts, agent status, etc.)
 */
export const getPageSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;
    const summary = await getPageSummary(pageId, req.user.userId);
    if (!summary) return fail(req, res, 'PAGE_NOT_FOUND');

    res.json(summary);
  } catch (error) {
    return handleError(req, res, error, 'INBOX_SUMMARY_FAILED');
  }
};

/**
 * Read the page's recent inbox and draft a tailored AI agent for it.
 * Returns a preview the user can apply via POST /:pageId/apply-agent.
 */
export const generatePageAgentController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;

    let result;
    try {
      result = await generateAgentFromInbox(pageId, req.user.userId);
    } catch (genError: any) {
      if (isApiError(genError)) throw genError;
      console.error('Generate agent error:', genError?.message || genError);
      // The OpenAI call (timeout / HTTP failure / empty completion) is the only upstream here.
      if (isAxiosLike(genError) || genError?.message === 'Empty response from model') {
        return fail(req, res, 'PAGE_AGENT_AI_UNAVAILABLE');
      }
      throw genError;
    }

    res.json(result);
  } catch (error) {
    return handleError(req, res, error, 'PAGE_AGENT_GENERATION_FAILED');
  }
};

/**
 * Apply a (possibly edited) generated-agent draft to the user's Agent record
 * and link it to this page. Creates the Agent if missing, otherwise updates it.
 * Mirrors to PageAISettings so the page card and webhook flow see consistent state.
 */
export const applyPageAgentController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;
    const body = req.body || {};

    // Accept the same shape the generate endpoint returns; allow user edits.
    // Absent values fall back to defaults; present values must be valid.
    const v = new Validator();
    const personality = v.oneOf(body.personality, 'personality', AI_PERSONALITIES, 'friendly');
    const responseTone = v.oneOf(body.responseTone, 'responseTone', AI_TONES, 'balanced');
    const responseLength = v.oneOf(body.responseLength, 'responseLength', AI_LENGTHS, 'medium');
    checkTextType(v, body.customInstructions, 'customInstructions');
    checkTextType(v, body.businessSummary, 'businessSummary');
    const customInstructions = v.optionalString(body.customInstructions, 'customInstructions', { max: CUSTOM_INSTRUCTIONS_MAX }) ?? '';
    const businessSummary = v.optionalString(body.businessSummary, 'businessSummary', { max: BUSINESS_SUMMARY_MAX }) ?? '';
    v.throwIfAny();

    const result = await applyGeneratedAgentToPage({
      pageId,
      userId: req.user.userId,
      generated: { personality, responseTone, responseLength, customInstructions, businessSummary },
    });

    res.json(result);
  } catch (error) {
    return handleError(req, res, error, 'PAGE_AGENT_APPLY_FAILED');
  }
};

/**
 * Import a list of confirmed extracted products into the user's main stock.
 */
export const importExtractedProductsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pageId = req.params.pageId as string;

    const v = new Validator();
    const items = v.nonEmptyArray<{ name: string; priceDA: number }>(req.body?.items, 'items', 'product');
    // Validate every entry: the importer does `item.name.trim()` and would crash
    // with a 500 on a malformed item, and a junk price would be written to stock.
    items.forEach((item, i) => {
      const raw = item as unknown;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        v.add(`items[${i}]`, 'FIELD_INVALID');
        return;
      }
      const entry = raw as { name?: unknown; priceDA?: unknown };
      if (checkTextType(v, entry.name, `items[${i}].name`)) {
        v.requiredString(entry.name, `items[${i}].name`, { max: 120 });
      }
      v.number(entry.priceDA, `items[${i}].priceDA`, { positive: true });
    });
    v.throwIfAny();

    await requireOwnedPage(pageId, req.user.userId);

    const result = await importExtractedProducts(req.user.userId, items as any);
    res.json(result);
  } catch (error) {
    return handleError(req, res, error, 'PAGE_ANALYSIS_IMPORT_FAILED');
  }
};
