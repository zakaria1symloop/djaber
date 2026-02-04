import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import prisma from '../config/database';
import { createNotification } from './notification.service';

// ============================================================================
// Types
// ============================================================================

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  sellingPrice: number;
  quantity: number;
  hasVariants: boolean;
  variants?: { name: string; sellingPrice: number; quantity: number }[];
  imageUrl: string | null;
}

interface AgentConfig {
  name: string;
  personality: string;
  customInstructions: string | null;
  aiModel: string;
  temperature: number;
  maxTokens: number;
}

export interface GenerateAgentResponseParams {
  agent: AgentConfig;
  products: ProductInfo[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  imageUrls?: string[];
  userId: string;
  conversationId?: string;
}

// Legacy params (for backward compat with old AISettings flow)
interface GenerateResponseParams {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  businessContext?: string;
  customInstructions?: string;
  model?: string;
}

// ============================================================================
// Provider detection
// ============================================================================

function getProviderForModel(modelName: string): string {
  if (modelName.startsWith('claude-')) return 'anthropic';
  if (modelName.startsWith('gemini-')) return 'google';
  if (modelName.startsWith('llama-') || modelName.startsWith('mixtral-') || modelName.startsWith('deepseek-')) return 'groq';
  return 'openai';
}

// ============================================================================
// LLM Factory — creates the right provider, reads API key from database
// ============================================================================

async function createLLM(modelName: string, temperature: number, maxTokens: number): Promise<BaseChatModel> {
  const providerName = getProviderForModel(modelName);

  // Fetch API key from AIProvider table
  const provider = await prisma.aIProvider.findUnique({
    where: { provider: providerName },
  });

  if (!provider || !provider.isActive) {
    throw new Error(`AI provider "${providerName}" is not active. Contact the administrator.`);
  }

  if (!provider.apiKey) {
    throw new Error(`No API key configured for provider "${providerName}". Contact the administrator.`);
  }

  const apiKey = provider.apiKey;

  switch (providerName) {
    case 'anthropic':
      return new ChatAnthropic({
        model: modelName,
        temperature,
        maxTokens,
        apiKey,
      });

    case 'google':
      return new ChatGoogleGenerativeAI({
        model: modelName,
        temperature,
        maxOutputTokens: maxTokens,
        apiKey,
      });

    case 'groq':
      return new ChatGroq({
        model: modelName,
        temperature,
        maxTokens,
        apiKey,
      });

    default: // openai
      return new ChatOpenAI({
        model: modelName,
        temperature,
        maxTokens,
        apiKey,
      });
  }
}

// ============================================================================
// Personality prompts
// ============================================================================

const personalityPrompts: Record<string, string> = {
  professional: `You are a professional sales assistant. You communicate in a formal, business-like manner.
You are polite, precise, and focused on providing accurate product information.
You use proper grammar and maintain a respectful tone throughout the conversation.`,

  friendly: `You are a warm and friendly sales assistant. You communicate like a helpful friend who genuinely wants to help.
You use a conversational tone, show enthusiasm about products, and make customers feel welcome.
You're approachable and make the shopping experience enjoyable.`,

  casual: `You are a relaxed and casual sales assistant. You keep things simple and easy-going.
You use informal language, short sentences, and get straight to the point.
You're laid-back but still helpful and knowledgeable about products.`,

  technical: `You are a technical and detail-oriented sales assistant. You provide in-depth product specifications and comparisons.
You focus on features, specifications, and technical details that help customers make informed decisions.
You're precise and thorough in your explanations.`,
};

// ============================================================================
// Build product catalog context (now includes IDs for tool calling)
// ============================================================================

function buildProductCatalog(products: ProductInfo[]): string {
  if (products.length === 0) {
    return 'No products are currently available in the catalog.';
  }

  const lines = products.map((p, i) => {
    let entry = `${i + 1}. ${p.name} [ID: ${p.id}] (SKU: ${p.sku})`;
    entry += `\n   Price: ${p.sellingPrice.toLocaleString()} DA`;
    entry += `\n   Stock: ${p.quantity > 0 ? `${p.quantity} available` : 'Out of stock'}`;
    if (p.description) entry += `\n   Description: ${p.description}`;
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      entry += '\n   Variants:';
      p.variants.forEach((v) => {
        entry += `\n     - ${v.name}: ${v.sellingPrice.toLocaleString()} DA (${v.quantity > 0 ? `${v.quantity} in stock` : 'out of stock'})`;
      });
    }
    return entry;
  });

  return lines.join('\n\n');
}

// ============================================================================
// Create Order Tool — allows the AI to place orders in the database
// ============================================================================

function makeCreateOrderTool(userId: string, products: ProductInfo[], agentName?: string, conversationId?: string) {
  return tool(
    async (input) => {
      try {
        // Validate items against product catalog
        const orderItems: Array<{
          productId: string;
          productName: string;
          quantity: number;
          unitPrice: number;
        }> = [];

        for (const item of input.items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product) {
            return JSON.stringify({
              success: false,
              error: `Product with ID "${item.productId}" not found in catalog. Check the product ID.`,
            });
          }
          if (product.quantity < item.quantity) {
            return JSON.stringify({
              success: false,
              error: `Not enough stock for "${product.name}". Available: ${product.quantity}, requested: ${item.quantity}.`,
            });
          }
          orderItems.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.sellingPrice,
          });
        }

        // Calculate totals
        const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const total = subtotal;

        // Generate order number
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const orderNumber = `ORD-${dateStr}-${rand}`;

        // ================================================================
        // Auto-create/link Client
        // ================================================================
        let clientId: string | null = null;
        try {
          const clientPhone = input.clientPhone?.trim() || null;
          const clientName = input.clientName.trim();

          if (clientPhone) {
            // Try to find existing client by phone
            const existing = await prisma.client.findFirst({
              where: { userId, phone: clientPhone },
            });

            if (existing) {
              // Update existing client stats
              await prisma.client.update({
                where: { id: existing.id },
                data: {
                  totalOrders: { increment: 1 },
                  totalSpent: { increment: total },
                  lastOrderDate: today,
                  name: clientName, // Update name in case it changed
                  address: input.clientAddress || existing.address,
                },
              });
              clientId = existing.id;
            } else {
              // Create new client
              const newClient = await prisma.client.create({
                data: {
                  userId,
                  name: clientName,
                  phone: clientPhone,
                  address: input.clientAddress || null,
                  source: 'ai',
                  totalOrders: 1,
                  totalSpent: total,
                  lastOrderDate: today,
                },
              });
              clientId = newClient.id;
            }
          } else {
            // No phone — create client by name
            const newClient = await prisma.client.create({
              data: {
                userId,
                name: clientName,
                address: input.clientAddress || null,
                source: 'ai',
                totalOrders: 1,
                totalSpent: total,
                lastOrderDate: today,
              },
            });
            clientId = newClient.id;
          }
        } catch (clientError) {
          console.error('Auto-create client error (non-fatal):', clientError);
        }

        // Create order in database
        const order = await prisma.order.create({
          data: {
            userId,
            orderNumber,
            clientId: clientId || undefined,
            clientName: input.clientName,
            clientPhone: input.clientPhone || null,
            clientAddress: input.clientAddress || null,
            subtotal,
            discount: 0,
            tax: 0,
            total,
            amountPaid: 0,
            paymentMethod: 'cash',
            paymentStatus: 'pending',
            status: 'pending',
            confirmationStatus: 'not_called',
            deliveryStatus: 'not_sent',
            source: 'ai',
            notes: input.notes || null,
            orderDate: today,
            items: {
              create: orderItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: 0,
                total: item.unitPrice * item.quantity,
              })),
            },
          },
          include: { items: true },
        });

        // Update stock for each item
        for (const item of orderItems) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
          await prisma.stockMovement.create({
            data: {
              userId,
              productId: item.productId,
              type: 'out',
              quantity: item.quantity,
              reference: order.orderNumber,
              reason: 'AI order',
            },
          });
        }

        // ================================================================
        // Link conversation to client
        // ================================================================
        if (conversationId && clientId) {
          try {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { clientId },
            });
          } catch (convError) {
            console.error('Link conversation to client error (non-fatal):', convError);
          }
        }

        // ================================================================
        // Create notification
        // ================================================================
        await createNotification({
          userId,
          type: 'ai_order',
          title: 'New AI Order',
          message: `Agent "${agentName || 'AI'}" created order ${orderNumber} for ${input.clientName} — ${total.toLocaleString()} DA`,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            agentName: agentName || 'AI',
            clientName: input.clientName,
            clientId,
            total,
            itemCount: orderItems.length,
          },
        });

        return JSON.stringify({
          success: true,
          orderNumber: order.orderNumber,
          total,
          itemCount: orderItems.length,
          items: orderItems.map((i) => ({
            name: i.productName,
            qty: i.quantity,
            price: i.unitPrice,
            subtotal: i.unitPrice * i.quantity,
          })),
        });
      } catch (error) {
        console.error('Create order tool error:', error);
        return JSON.stringify({
          success: false,
          error: 'Failed to create order. Please try again.',
        });
      }
    },
    {
      name: 'create_order',
      description:
        'Create a new order when the customer confirms they want to buy. You MUST collect the customer name, phone number, and delivery address BEFORE calling this tool. Only call this when the customer has explicitly confirmed the order.',
      schema: z.object({
        clientName: z.string().describe('Customer full name'),
        clientPhone: z.string().optional().describe('Customer phone number'),
        clientAddress: z.string().optional().describe('Customer delivery address'),
        items: z
          .array(
            z.object({
              productId: z.string().describe('Product ID from the catalog (the value in [ID: ...])'),
              quantity: z.number().describe('Quantity to order'),
            })
          )
          .describe('Products the customer wants to buy'),
        notes: z.string().optional().describe('Any additional order notes'),
      }),
    }
  );
}

// ============================================================================
// Agent-based response (LangChain — multi-provider + tool calling)
// ============================================================================

export const generateAgentResponse = async ({
  agent,
  products,
  conversationHistory,
  userMessage,
  imageUrls,
  userId,
  conversationId,
}: GenerateAgentResponseParams): Promise<string> => {
  try {
    const llm = await createLLM(agent.aiModel, agent.temperature, agent.maxTokens);

    const personalityPrompt = personalityPrompts[agent.personality] || personalityPrompts.professional;
    const productCatalog = buildProductCatalog(products);

    const systemPrompt = `${personalityPrompt}

Your name is "${agent.name}".

${agent.customInstructions ? `SPECIAL INSTRUCTIONS:\n${agent.customInstructions}\n` : ''}
PRODUCT CATALOG:
${productCatalog}

RULES:
- You are a sales assistant. Your goal is to help customers find and purchase products.
- When a customer asks about a product, provide accurate info from the catalog above.
- If a product is out of stock, let the customer know and suggest alternatives if available.
- When a customer wants to buy, confirm the product, quantity, and total price.
- Ask for their name, phone number, and delivery address to complete the order.
- Once the customer confirms the order AND provides their name, phone, and address, use the create_order tool to place the order.
- After placing an order, confirm the order number and total to the customer.
- Use prices in "DA" (Algerian Dinar) currency.
- Keep responses concise — this is a chat conversation, not an email.
- If asked about something not in the catalog, politely say you don't have that product.
- Never make up products or prices that aren't in the catalog.
- Respond in the same language the customer uses.`;

    // Build messages
    const messages: any[] = [
      new SystemMessage(systemPrompt),
      ...conversationHistory.map((msg) =>
        msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
      ),
    ];

    // Build the current user message — multimodal if images are present
    if (imageUrls && imageUrls.length > 0) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (userMessage) {
        content.push({ type: 'text', text: userMessage });
      }
      for (const url of imageUrls) {
        content.push({ type: 'image_url', image_url: { url } });
      }
      messages.push(new HumanMessage({ content }));
    } else {
      messages.push(new HumanMessage(userMessage));
    }

    // Create the order tool
    const orderTool = makeCreateOrderTool(userId, products, agent.name, conversationId);
    // All our providers (OpenAI, Anthropic, Google, Groq) support bindTools
    const llmWithTools = (llm as any).bindTools([orderTool]);

    // Invoke with tool calling loop (max 3 iterations)
    let response = await llmWithTools.invoke(messages);

    for (let i = 0; i < 3; i++) {
      const toolCalls = (response as any).tool_calls;
      if (!toolCalls || toolCalls.length === 0) break;

      // Add the AI message (with tool calls) to messages
      messages.push(response);

      // Execute each tool call
      for (const tc of toolCalls) {
        let result: string;
        if (tc.name === 'create_order') {
          const toolResult = await orderTool.invoke(tc.args as any);
          result = typeof toolResult === 'string' ? toolResult : String(toolResult);
        } else {
          result = JSON.stringify({ error: 'Unknown tool' });
        }
        messages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }));
      }

      // Get the next response
      response = await llmWithTools.invoke(messages);
    }

    // Extract text content
    const content = response.content;
    if (typeof content === 'string') {
      return content || 'Sorry, I could not generate a response.';
    }
    // Handle array content (some models return array of content blocks)
    if (Array.isArray(content)) {
      const textParts = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text);
      return textParts.join('') || 'Sorry, I could not generate a response.';
    }
    return 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('LangChain agent response error:', error);
    throw new Error('Failed to generate AI response');
  }
};

// ============================================================================
// Legacy response (backward compat with AISettings)
// ============================================================================

export const generateAIResponse = async ({
  conversationHistory,
  businessContext,
  customInstructions,
  model = 'gpt-4',
}: GenerateResponseParams): Promise<string> => {
  try {
    const llm = await createLLM(model, 0.7, 500);

    const systemPrompt = `You are an AI assistant helping with customer service for a business.
${businessContext ? `Business context: ${businessContext}` : ''}
${customInstructions ? `Custom instructions: ${customInstructions}` : ''}

Guidelines:
- Be helpful, professional, and friendly
- Keep responses concise and clear
- If you don't know something, be honest about it
- Always prioritize customer satisfaction`;

    const historyMessages = conversationHistory.map((msg) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('history'),
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const response = await chain.invoke({
      history: historyMessages,
    });

    return response || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate AI response');
  }
};
