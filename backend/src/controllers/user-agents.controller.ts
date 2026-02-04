import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateAgentResponse } from '../services/ai.service';

// ============================================================================
// Get Agents (list)
// ============================================================================

export const getAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const agents = await prisma.agent.findMany({
      where: { userId: req.user.userId },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ agents });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
};

// ============================================================================
// Get Single Agent
// ============================================================================

export const getAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

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

    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

    res.json({ agent });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
};

// ============================================================================
// Create Agent
// ============================================================================

export const createAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const {
      name,
      description,
      personality = 'professional',
      customInstructions,
      aiModel = 'gpt-4',
      temperature = 0.7,
      maxTokens = 1000,
      sellAllProducts = true,
      pageIds = [],
      productIds = [],
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Agent name is required' });
      return;
    }

    const agent = await prisma.agent.create({
      data: {
        userId: req.user.userId,
        name: name.trim(),
        description: description?.trim() || null,
        personality,
        customInstructions: customInstructions?.trim() || null,
        aiModel,
        temperature,
        maxTokens,
        sellAllProducts,
        pages: {
          create: pageIds.map((pageId: string) => ({ pageId })),
        },
        products: sellAllProducts ? undefined : {
          create: productIds.map((productId: string) => ({ productId })),
        },
      },
      include: {
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
      },
    });

    res.status(201).json({ agent });
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Unique constraint on pageId — page already assigned to another agent
      res.status(400).json({ error: 'One or more pages are already assigned to another agent' });
      return;
    }
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
};

// ============================================================================
// Update Agent
// ============================================================================

export const updateAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const agentId = String(req.params.agentId);
    const {
      name,
      description,
      personality,
      customInstructions,
      aiModel,
      temperature,
      maxTokens,
      sellAllProducts,
      isActive,
      pageIds,
      productIds,
    } = req.body;

    const existing = await prisma.agent.findFirst({
      where: { id: agentId, userId: req.user.userId },
    });

    if (!existing) { res.status(404).json({ error: 'Agent not found' }); return; }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (personality !== undefined) updateData.personality = personality;
    if (customInstructions !== undefined) updateData.customInstructions = customInstructions?.trim() || null;
    if (aiModel !== undefined) updateData.aiModel = aiModel;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (maxTokens !== undefined) updateData.maxTokens = maxTokens;
    if (sellAllProducts !== undefined) updateData.sellAllProducts = sellAllProducts;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update agent + sync page/product links in a transaction
    const agent = await prisma.$transaction(async (tx) => {
      // Sync pages if provided
      if (pageIds !== undefined) {
        await tx.agentPage.deleteMany({ where: { agentId } });
        if (pageIds.length > 0) {
          await tx.agentPage.createMany({
            data: pageIds.map((pageId: string) => ({ agentId, pageId })),
          });
        }
      }

      // Sync products if provided
      if (productIds !== undefined) {
        await tx.agentProduct.deleteMany({ where: { agentId } });
        if (productIds.length > 0) {
          await tx.agentProduct.createMany({
            data: productIds.map((productId: string) => ({ agentId, productId })),
          });
        }
      }

      return tx.agent.update({
        where: { id: agentId },
        data: updateData,
        include: {
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
        },
      });
    });

    res.json({ agent });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'One or more pages are already assigned to another agent' });
      return;
    }
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
};

// ============================================================================
// Delete Agent
// ============================================================================

export const deleteAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const agentId = String(req.params.agentId);

    const existing = await prisma.agent.findFirst({
      where: { id: agentId, userId: req.user.userId },
    });

    if (!existing) { res.status(404).json({ error: 'Agent not found' }); return; }

    await prisma.agent.delete({ where: { id: agentId } }); // Cascades to AgentPage, AgentProduct

    res.json({ success: true });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
};

// ============================================================================
// Test Agent (send a test message)
// ============================================================================

export const testAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const agentId = String(req.params.agentId);
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Fetch the agent with products
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: req.user.userId },
      include: {
        products: {
          include: {
            product: {
              include: { variants: true },
            },
          },
        },
      },
    });

    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

    // Get products — either all user products or agent-linked products
    let products;
    if (agent.sellAllProducts) {
      const allProducts = await prisma.product.findMany({
        where: { userId: req.user.userId, isActive: true },
        include: { variants: true },
      });
      products = allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        sellingPrice: Number(p.sellingPrice),
        quantity: p.quantity,
        hasVariants: p.hasVariants,
        variants: p.variants.map((v) => ({
          name: v.name,
          sellingPrice: Number(v.sellingPrice),
          quantity: v.quantity,
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
          variants: ap.product.variants?.map((v: any) => ({
            name: v.name,
            sellingPrice: Number(v.sellingPrice),
            quantity: v.quantity,
          })) || [],
          imageUrl: ap.product.imageUrl,
        }));
    }

    const response = await generateAgentResponse({
      agent: {
        name: agent.name,
        personality: agent.personality,
        customInstructions: agent.customInstructions,
        aiModel: agent.aiModel,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      },
      products,
      conversationHistory: history,
      userMessage: message.trim(),
      userId: req.user.userId,
    });

    res.json({ response });
  } catch (error) {
    console.error('Test agent error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
};
