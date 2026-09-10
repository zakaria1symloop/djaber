import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateAgentResponse } from '../services/ai.service';
import { ApiError, fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

const PERSONALITIES = ['professional', 'friendly', 'casual', 'technical'] as const;
const INSIGHT_STATUSES = ['pending', 'resolved', 'dismissed'] as const;
const INSIGHT_ACTIONS = ['resolve', 'dismiss'] as const;
const AGENT_LIMIT = 1;

const AGENT_INCLUDE = {
  pages: {
    include: {
      page: { select: { id: true, pageName: true, platform: true, pageId: true, isActive: true } },
    },
  },
  products: {
    include: {
      product: { select: { id: true, name: true, sku: true, sellingPrice: true, imageUrl: true, isActive: true } },
    },
  },
  _count: { select: { pages: true, products: true } },
} as const;

/** Optional array of string ids; `undefined` when absent (so "not provided" stays distinguishable). */
function idList(v: Validator, value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((x) => typeof x !== 'string' || x.trim() === '')) {
    v.add(field, 'FIELD_INVALID');
    return [];
  }
  return Array.from(new Set(value.map((x: string) => x.trim())));
}

/** Throws PAGE_NOT_FOUND / PRODUCT_NOT_FOUND when any id is not owned by the user. */
async function assertOwnedLinks(userId: string, pageIds: string[] | undefined, productIds: string[] | undefined): Promise<void> {
  if (pageIds && pageIds.length > 0) {
    const owned = await prisma.page.findMany({ where: { id: { in: pageIds }, userId }, select: { id: true } });
    if (owned.length !== pageIds.length) throw new ApiError('PAGE_NOT_FOUND');
  }
  if (productIds && productIds.length > 0) {
    const owned = await prisma.product.findMany({ where: { id: { in: productIds }, userId }, select: { id: true } });
    if (owned.length !== productIds.length) throw new ApiError('PRODUCT_NOT_FOUND');
  }
}

// ============================================================================
// Get Agents (list)
// ============================================================================

export const getAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agents = await prisma.agent.findMany({
      where: { userId: req.user.userId },
      include: AGENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ agents });
  } catch (error) {
    handleError(req, res, error, 'AGENT_LIST_FAILED');
  }
};

// ============================================================================
// Get Single Agent
// ============================================================================

export const getAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agent = await prisma.agent.findFirst({
      where: { id: String(req.params.agentId), userId: req.user.userId },
      include: {
        pages: {
          include: {
            page: { select: { id: true, pageName: true, platform: true, pageId: true, isActive: true } },
          },
        },
        products: {
          include: {
            product: { select: { id: true, name: true, sku: true, sellingPrice: true, imageUrl: true, isActive: true, quantity: true } },
          },
        },
      },
    });

    if (!agent) return fail(req, res, 'AGENT_NOT_FOUND');

    res.json({ agent });
  } catch (error) {
    handleError(req, res, error, 'AGENT_FETCH_FAILED');
  }
};

// ============================================================================
// Create Agent
// ============================================================================

export const createAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const b = req.body ?? {};
    const v = new Validator();
    const name = v.requiredString(b.name, 'name', { max: 100 });
    const description = v.optionalString(b.description, 'description', { max: 1000 });
    const personality = v.oneOf(b.personality, 'personality', PERSONALITIES, 'professional');
    const customInstructions = v.optionalString(b.customInstructions, 'customInstructions', { max: 10000 });
    const productTemplate = v.optionalString(b.productTemplate, 'productTemplate', { max: 5000 });
    const closingInstructions = v.optionalString(b.closingInstructions, 'closingInstructions', { max: 5000 });
    const humanHandoffRules = v.optionalString(b.humanHandoffRules, 'humanHandoffRules', { max: 5000 });
    const imageRecognition = v.boolean(b.imageRecognition, 'imageRecognition', false);
    const voiceTranscription = v.boolean(b.voiceTranscription, 'voiceTranscription', false);
    const responseDelay = v.integer(b.responseDelay, 'responseDelay', { min: 0, max: 60, required: false, def: 3 });
    const aiModel = b.aiModel === undefined ? 'gpt-4' : v.requiredString(b.aiModel, 'aiModel', { max: 100 });
    const temperature = v.number(b.temperature, 'temperature', { min: 0, max: 2, required: false, def: 0.7 });
    const maxTokens = v.integer(b.maxTokens, 'maxTokens', { min: 1, max: 8000, required: false, def: 1000 });
    const sellAllProducts = v.boolean(b.sellAllProducts, 'sellAllProducts', true);
    const pageIds = idList(v, b.pageIds, 'pageIds') ?? [];
    const productIds = idList(v, b.productIds, 'productIds') ?? [];
    v.throwIfAny();

    // Enforce the plan's agent limit (one agent per user today)
    const existingCount = await prisma.agent.count({ where: { userId: req.user.userId } });
    if (existingCount >= AGENT_LIMIT) return fail(req, res, 'PLAN_LIMIT_REACHED', { limit: AGENT_LIMIT, item: 'agent' });

    await assertOwnedLinks(req.user.userId, pageIds, sellAllProducts ? undefined : productIds);

    // Remove any stale AgentPage records for these pages (e.g. from deleted/orphaned agents)
    if (pageIds.length > 0) {
      await prisma.agentPage.deleteMany({ where: { pageId: { in: pageIds } } });
    }

    const agent = await prisma.agent.create({
      data: {
        userId: req.user.userId,
        name,
        description,
        personality,
        customInstructions,
        productTemplate,
        closingInstructions,
        humanHandoffRules,
        imageRecognition,
        voiceTranscription,
        responseDelay,
        aiModel,
        temperature,
        maxTokens,
        sellAllProducts,
        pages: { create: pageIds.map((pageId) => ({ pageId })) },
        products: sellAllProducts ? undefined : { create: productIds.map((productId) => ({ productId })) },
      },
      include: AGENT_INCLUDE,
    });

    res.status(201).json({ agent });
  } catch (error) {
    // Unique constraint on pageId — page already assigned to another agent
    if ((error as { code?: string })?.code === 'P2002') return fail(req, res, 'AGENT_PAGE_ALREADY_ASSIGNED');
    handleError(req, res, error, 'AGENT_CREATE_FAILED');
  }
};

// ============================================================================
// Update Agent
// ============================================================================

export const updateAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agentId = String(req.params.agentId);
    const b = req.body ?? {};

    const v = new Validator();
    const updateData: Record<string, unknown> = {};
    if (b.name !== undefined) updateData.name = v.requiredString(b.name, 'name', { max: 100 });
    if (b.description !== undefined) updateData.description = v.optionalString(b.description, 'description', { max: 1000 });
    if (b.personality !== undefined) updateData.personality = v.oneOf(b.personality, 'personality', PERSONALITIES);
    if (b.customInstructions !== undefined) updateData.customInstructions = v.optionalString(b.customInstructions, 'customInstructions', { max: 10000 });
    if (b.productTemplate !== undefined) updateData.productTemplate = v.optionalString(b.productTemplate, 'productTemplate', { max: 5000 });
    if (b.closingInstructions !== undefined) updateData.closingInstructions = v.optionalString(b.closingInstructions, 'closingInstructions', { max: 5000 });
    if (b.humanHandoffRules !== undefined) updateData.humanHandoffRules = v.optionalString(b.humanHandoffRules, 'humanHandoffRules', { max: 5000 });
    if (b.imageRecognition !== undefined) updateData.imageRecognition = v.boolean(b.imageRecognition, 'imageRecognition');
    if (b.voiceTranscription !== undefined) updateData.voiceTranscription = v.boolean(b.voiceTranscription, 'voiceTranscription');
    if (b.responseDelay !== undefined) updateData.responseDelay = v.integer(b.responseDelay, 'responseDelay', { min: 0, max: 60 });
    if (b.aiModel !== undefined) updateData.aiModel = v.requiredString(b.aiModel, 'aiModel', { max: 100 });
    if (b.temperature !== undefined) updateData.temperature = v.number(b.temperature, 'temperature', { min: 0, max: 2 });
    if (b.maxTokens !== undefined) updateData.maxTokens = v.integer(b.maxTokens, 'maxTokens', { min: 1, max: 8000 });
    if (b.sellAllProducts !== undefined) updateData.sellAllProducts = v.boolean(b.sellAllProducts, 'sellAllProducts');
    if (b.isActive !== undefined) updateData.isActive = v.boolean(b.isActive, 'isActive');
    const pageIds = idList(v, b.pageIds, 'pageIds');
    const productIds = idList(v, b.productIds, 'productIds');
    v.throwIfAny();

    const existing = await prisma.agent.findFirst({ where: { id: agentId, userId: req.user.userId } });
    if (!existing) return fail(req, res, 'AGENT_NOT_FOUND');

    await assertOwnedLinks(req.user.userId, pageIds, productIds);

    // Update agent + sync page/product links in a transaction
    const agent = await prisma.$transaction(async (tx) => {
      if (pageIds !== undefined) {
        // Delete this agent's existing AgentPages AND any stale links for the requested pages
        await tx.agentPage.deleteMany({ where: { agentId } });
        if (pageIds.length > 0) {
          await tx.agentPage.deleteMany({ where: { pageId: { in: pageIds } } });
          await tx.agentPage.createMany({ data: pageIds.map((pageId) => ({ agentId, pageId })) });
        }
      }

      if (productIds !== undefined) {
        await tx.agentProduct.deleteMany({ where: { agentId } });
        if (productIds.length > 0) {
          await tx.agentProduct.createMany({ data: productIds.map((productId) => ({ agentId, productId })) });
        }
      }

      return tx.agent.update({
        where: { id: agentId },
        data: updateData,
        include: AGENT_INCLUDE,
      });
    });

    res.json({ agent });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return fail(req, res, 'AGENT_PAGE_ALREADY_ASSIGNED');
    handleError(req, res, error, 'AGENT_UPDATE_FAILED');
  }
};

// ============================================================================
// Delete Agent
// ============================================================================

export const deleteAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agentId = String(req.params.agentId);

    const existing = await prisma.agent.findFirst({ where: { id: agentId, userId: req.user.userId } });
    if (!existing) return fail(req, res, 'AGENT_NOT_FOUND');

    // Explicitly clean up related records before deleting (belt + suspenders with cascade)
    await prisma.agentPage.deleteMany({ where: { agentId } });
    await prisma.agentProduct.deleteMany({ where: { agentId } });
    await prisma.agentInsight.deleteMany({ where: { agentId } });
    await prisma.agent.delete({ where: { id: agentId } });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'AGENT_DELETE_FAILED');
  }
};

// ============================================================================
// Test Agent (send a test message)
// ============================================================================

export const testAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agentId = String(req.params.agentId);
    const b = req.body ?? {};

    const v = new Validator();
    const message = v.requiredString(b.message, 'message', { max: 4000 });
    const history = b.history === undefined || b.history === null ? [] : b.history;
    if (!Array.isArray(history)) v.add('history', 'FIELD_INVALID');
    v.throwIfAny();

    // Fetch the agent with products
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: req.user.userId },
      include: {
        products: {
          include: {
            product: {
              // Match the production webhook catalog: active variants only
              include: { variants: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    if (!agent) return fail(req, res, 'AGENT_NOT_FOUND');

    // Get products — either all user products or agent-linked products
    let products;
    if (agent.sellAllProducts) {
      const allProducts = await prisma.product.findMany({
        where: { userId: req.user.userId, isActive: true },
        // Match the production webhook catalog: active variants only
        include: { variants: { where: { isActive: true } } },
      });
      products = allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        sellingPrice: Number(p.sellingPrice),
        quantity: p.quantity,
        hasVariants: p.hasVariants,
        variants: p.variants.map((vr) => ({
          name: vr.name,
          sellingPrice: Number(vr.sellingPrice),
          quantity: vr.quantity,
        })),
        imageUrl: p.imageUrl,
      }));
    } else {
      products = agent.products
        .filter((ap) => ap.product.isActive)
        .map((ap) => ({
          id: ap.product.id,
          name: ap.product.name,
          sku: ap.product.sku,
          description: ap.product.description,
          sellingPrice: Number(ap.product.sellingPrice),
          quantity: ap.product.quantity,
          hasVariants: ap.product.hasVariants,
          variants: ap.product.variants?.map((vr: any) => ({
            name: vr.name,
            sellingPrice: Number(vr.sellingPrice),
            quantity: vr.quantity,
          })) || [],
          imageUrl: ap.product.imageUrl,
        }));
    }

    let response;
    try {
      response = await generateAgentResponse({
        agent: {
          name: agent.name,
          personality: agent.personality,
          customInstructions: agent.customInstructions,
          productTemplate: agent.productTemplate || null,
          closingInstructions: agent.closingInstructions || null,
          humanHandoffRules: agent.humanHandoffRules || null,
          aiModel: agent.aiModel,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        },
        products,
        conversationHistory: history,
        userMessage: message,
        userId: req.user.userId,
        // Test playground must NEVER create real orders/clients/stock movements
        dryRun: true,
      });
    } catch (aiError) {
      // ApiErrors (e.g. INSUFFICIENT_CREDITS) keep their meaning; anything else is an AI provider failure
      if (aiError instanceof ApiError) throw aiError;
      console.error(`[${req.method} ${req.originalUrl}] AGENT_AI_UNAVAILABLE:`, aiError);
      throw new ApiError('AGENT_AI_UNAVAILABLE');
    }

    res.json({ response });
  } catch (error) {
    handleError(req, res, error, 'AGENT_TEST_FAILED');
  }
};

// ============================================================================
// Get Agent Metrics (KPIs)
// ============================================================================

export const getAgentMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agentId = String(req.params.agentId);

    const agent = await prisma.agent.findFirst({ where: { id: agentId, userId: req.user.userId } });
    if (!agent) return fail(req, res, 'AGENT_NOT_FOUND');

    // Get conversations handled by this agent
    const conversations = await prisma.conversation.findMany({
      where: { agentId, userId: req.user.userId },
      select: { id: true },
    });

    const conversationIds = conversations.map(c => c.id);

    let totalMessages = 0;
    let messagesFromCustomers = 0;
    let messagesFromAgent = 0;
    let lastActiveDate: Date | null = null;

    if (conversationIds.length > 0) {
      const [total, fromCustomers, fromAgent, lastMsg] = await Promise.all([
        prisma.message.count({ where: { conversationId: { in: conversationIds } } }),
        prisma.message.count({ where: { conversationId: { in: conversationIds }, isFromPage: false } }),
        prisma.message.count({ where: { conversationId: { in: conversationIds }, isFromPage: true } }),
        prisma.message.findFirst({
          where: { conversationId: { in: conversationIds } },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        }),
      ]);

      totalMessages = total;
      messagesFromCustomers = fromCustomers;
      messagesFromAgent = fromAgent;
      lastActiveDate = lastMsg?.timestamp || null;
    }

    // Count orders linked via conversations this agent handled
    const ordersCreated = await prisma.order.count({
      where: {
        userId: req.user.userId,
        source: 'ai',
        client: {
          conversations: { some: { agentId } },
        },
      },
    });

    // Count insights
    const [insightsPending, insightsResolved] = await Promise.all([
      prisma.agentInsight.count({ where: { agentId, status: 'pending' } }),
      prisma.agentInsight.count({ where: { agentId, status: { in: ['resolved', 'dismissed'] } } }),
    ]);

    res.json({
      metrics: {
        conversationCount: conversations.length,
        totalMessages,
        messagesFromCustomers,
        messagesFromAgent,
        ordersCreated,
        insightsPending,
        insightsResolved,
        lastActiveDate,
      },
    });
  } catch (error) {
    handleError(req, res, error, 'AGENT_METRICS_FAILED');
  }
};

// ============================================================================
// Get Agent Insights (flagged conversations)
// ============================================================================

export const getAgentInsights = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const agentId = String(req.params.agentId);

    const v = new Validator();
    const statusFilter = req.query.status === undefined || req.query.status === ''
      ? undefined
      : v.oneOf(req.query.status, 'status', INSIGHT_STATUSES);
    v.throwIfAny();

    const agent = await prisma.agent.findFirst({ where: { id: agentId, userId: req.user.userId } });
    if (!agent) return fail(req, res, 'AGENT_NOT_FOUND');

    const insights = await prisma.agentInsight.findMany({
      where: { agentId, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          select: { senderId: true, platform: true },
        },
      },
    });

    res.json({ insights });
  } catch (error) {
    handleError(req, res, error, 'INSIGHT_LIST_FAILED');
  }
};

// ============================================================================
// Resolve Agent Insight (add instruction or dismiss)
// ============================================================================

export const resolveInsight = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const insightId = String(req.params.insightId);
    const b = req.body ?? {};

    const v = new Validator();
    const action = v.oneOf(b.action, 'action', INSIGHT_ACTIONS);
    const newInstruction = v.optionalString(b.newInstruction, 'newInstruction', { max: 2000 });
    v.throwIfAny();

    const insight = await prisma.agentInsight.findUnique({
      where: { id: insightId },
      include: { agent: true },
    });

    if (!insight || insight.agent.userId !== req.user.userId) return fail(req, res, 'INSIGHT_NOT_FOUND');

    // If resolving with a new instruction, append to agent's customInstructions
    if (action === 'resolve' && newInstruction) {
      const existing = insight.agent.customInstructions || '';
      const updated = existing ? `${existing}\n- ${newInstruction}` : `- ${newInstruction}`;

      await prisma.agent.update({
        where: { id: insight.agentId },
        data: { customInstructions: updated },
      });
    }

    // Mark insight as resolved/dismissed
    const updatedInsight = await prisma.agentInsight.update({
      where: { id: insightId },
      data: {
        status: action === 'resolve' ? 'resolved' : 'dismissed',
        resolvedAt: new Date(),
      },
    });

    res.json({ insight: updatedInsight });
  } catch (error) {
    handleError(req, res, error, 'INSIGHT_RESOLVE_FAILED');
  }
};
