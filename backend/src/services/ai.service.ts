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
import { getRecommendationsMap, trackConversion } from './recommendation.service';

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
  primaryImageUrl?: string | null;
}

interface AgentConfig {
  name: string;
  personality: string;
  customInstructions: string | null;
  productTemplate: string | null;
  closingInstructions: string | null;
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
// Vision model selection — find the best available vision-capable model
// ============================================================================

const VISION_MODEL_PRIORITY = [
  { model: 'gpt-4o', provider: 'openai' },
  { model: 'gpt-4o-mini', provider: 'openai' },
  { model: 'gpt-4-turbo', provider: 'openai' },
  { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
  { model: 'claude-3-5-sonnet-latest', provider: 'anthropic' },
  { model: 'claude-sonnet-4-6', provider: 'anthropic' },
  { model: 'claude-3-opus-20240229', provider: 'anthropic' },
  { model: 'gemini-1.5-pro', provider: 'google' },
  { model: 'gemini-1.5-flash', provider: 'google' },
  { model: 'gemini-2.0-flash', provider: 'google' },
];

async function findBestVisionModel(): Promise<{ model: string; provider: string }> {
  const activeProviders = await prisma.aIProvider.findMany({
    where: { isActive: true },
    select: { provider: true, models: true },
  });

  const activeProviderMap = new Map<string, string[]>();
  for (const p of activeProviders) {
    try {
      activeProviderMap.set(p.provider, JSON.parse(p.models));
    } catch {
      activeProviderMap.set(p.provider, []);
    }
  }

  // Try priority list first
  for (const candidate of VISION_MODEL_PRIORITY) {
    const providerModels = activeProviderMap.get(candidate.provider);
    if (providerModels && providerModels.includes(candidate.model)) {
      return candidate;
    }
  }

  // Fallback: any active provider with a vision-capable model
  for (const candidate of VISION_MODEL_PRIORITY) {
    if (activeProviderMap.has(candidate.provider)) {
      return candidate;
    }
  }

  throw new Error('No vision-capable AI model is available. Please configure OpenAI (GPT-4o), Anthropic (Claude), or Google (Gemini) in AI Providers.');
}

// ============================================================================
// Analyze product image — extract name, description, category, unit
// ============================================================================

export async function analyzeProductImage(
  imageBase64: string,
  mimeType: string,
  existingCategories: string[],
  existingUnits: string[]
): Promise<{
  name: string;
  description: string;
  suggestedCategory: string;
  suggestedUnit: string;
}> {
  const { model } = await findBestVisionModel();
  const llm = await createLLM(model, 0.3, 1000);

  const categoryList = existingCategories.length > 0
    ? `Existing categories: ${existingCategories.join(', ')}`
    : 'No existing categories yet.';
  const unitList = existingUnits.length > 0
    ? `Existing units: ${existingUnits.join(', ')}`
    : 'Default units: piece, kg, liter, meter, box, pack, dozen';

  const prompt = `You are a product catalog assistant. Analyze this product image and extract the following information.

${categoryList}
${unitList}

IMPORTANT:
- For "suggestedCategory", prefer matching an existing category if the product fits. Otherwise suggest a new category name.
- For "suggestedUnit", prefer matching an existing unit. Use the unit name (e.g., "piece", "kg").
- Keep the product name concise and commercial (as it would appear in a store).
- Write the description in 1-3 sentences focusing on key features, material, use case.
- Respond ONLY with valid JSON, no extra text.

Respond in this exact JSON format:
{
  "name": "Product Name",
  "description": "Brief product description",
  "suggestedCategory": "Category Name",
  "suggestedUnit": "unit name"
}`;

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
  ];

  const response = await llm.invoke([new HumanMessage({ content })]);
  const responseText = typeof response.content === 'string'
    ? response.content
    : (response.content as any[]).map((c: any) => c.text || '').join('');

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON. Please try again.');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    name: parsed.name || '',
    description: parsed.description || '',
    suggestedCategory: parsed.suggestedCategory || '',
    suggestedUnit: parsed.suggestedUnit || '',
  };
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

function buildProductCatalog(
  products: ProductInfo[],
  recommendations?: Map<string, Array<{ type: string; recommended: { id: string; name: string; sellingPrice: any; quantity: number }; reason: string | null }>>
): string {
  if (products.length === 0) {
    return 'No products are currently available in the catalog.';
  }

  const lines = products.map((p, i) => {
    let entry = `${i + 1}. ${p.name} [ID: ${p.id}]`;
    entry += `\n   Price: ${p.sellingPrice.toLocaleString()} DA`;
    entry += `\n   Stock: ${p.quantity > 0 ? `${p.quantity} available` : 'Out of stock'}`;
    if (p.description) entry += `\n   About: ${p.description}`;
    entry += `\n   HasImage: ${p.primaryImageUrl ? 'yes' : 'no'}`;
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      entry += '\n   Variants:';
      p.variants.forEach((v) => {
        entry += `\n     - ${v.name}: ${v.sellingPrice.toLocaleString()} DA (${v.quantity > 0 ? `${v.quantity} in stock` : 'out of stock'})`;
      });
    }
    // Append cross-sell/up-sell recommendations
    const recs = recommendations?.get(p.id);
    if (recs && recs.length > 0) {
      for (const rec of recs) {
        const label = rec.type === 'up_sell' ? 'Up-sell' : 'Cross-sell';
        const price = Number(rec.recommended.sellingPrice).toLocaleString();
        const reason = rec.reason ? ` — ${rec.reason}` : '';
        entry += `\n   → ${label}: ${rec.recommended.name} [ID: ${rec.recommended.id}] (${price} DA)${reason}`;
      }
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
        // Auto-create/link Client (reuse auto-linked client if exists)
        // ================================================================
        let clientId: string | null = null;
        try {
          const clientPhone = input.clientPhone?.trim() || null;
          const clientName = input.clientName.trim();

          // Check if the conversation already has an auto-linked client
          let autoLinkedClient: any = null;
          if (conversationId) {
            const conv = await prisma.conversation.findUnique({
              where: { id: conversationId },
              select: { clientId: true },
            });
            if (conv?.clientId) {
              autoLinkedClient = await prisma.client.findUnique({
                where: { id: conv.clientId },
              });
            }
          }

          if (autoLinkedClient) {
            // Update the auto-linked client with real order details
            await prisma.client.update({
              where: { id: autoLinkedClient.id },
              data: {
                name: clientName,
                phone: clientPhone || autoLinkedClient.phone,
                address: input.clientAddress || autoLinkedClient.address,
                totalOrders: { increment: 1 },
                totalSpent: { increment: total },
                lastOrderDate: today,
              },
            });
            clientId = autoLinkedClient.id;
          } else if (clientPhone) {
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
                  name: clientName,
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

        // Track cross-sell conversions: check if any ordered items were recommended
        try {
          const orderedProductIds = orderItems.map(i => i.productId);
          for (let i = 0; i < orderedProductIds.length; i++) {
            for (let j = 0; j < orderedProductIds.length; j++) {
              if (i === j) continue;
              // Check if product j was recommended for product i
              await trackConversion(
                userId,
                orderedProductIds[i],
                orderedProductIds[j],
                orderItems[j].unitPrice * orderItems[j].quantity
              );
            }
          }
        } catch (convError) {
          // Non-critical — don't fail the order
        }

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

    // Fetch cross-sell/up-sell recommendations for the agent's products
    let recsMap: Map<string, any[]> | undefined;
    try {
      const productIds = products.map(p => p.id);
      recsMap = await getRecommendationsMap(userId, productIds);
    } catch (e) {
      // Non-critical — continue without recommendations
    }

    const productCatalog = buildProductCatalog(products, recsMap);

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
- Respond in the same language the customer uses.

PRODUCT PRESENTATION:
- NEVER output raw image URLs or links to images. The system handles images automatically.
- When you mention a product, add a [PRODUCT_CARD:productId] tag (replace productId with the actual ID from the catalog) on its own line. The system will display a rich card with the product image, name, and price.
- In the user's template below, [PRODUCT_CARD] means "put a product card here" — you MUST replace it with [PRODUCT_CARD:actualId] using the real product ID from the catalog.
${agent.productTemplate
  ? `- IMPORTANT: Follow this EXACT format when presenting products to customers. Replace {name}, {price}, {description} with real product data, and [PRODUCT_CARD] with [PRODUCT_CARD:realProductId]:\n${agent.productTemplate}`
  : `- Write a brief natural intro BEFORE the card tag. Example:
  "Here's our best seller! 🔥
  [PRODUCT_CARD:abc123]"
- Keep your text conversational and short. The card does the visual work.
- When listing multiple products, show each with a brief intro + card:
  "We have a few options:
  [PRODUCT_CARD:id1]
  [PRODUCT_CARD:id2]
  Which one interests you?"`}

IMAGE RECOGNITION:
- If the customer sends a photo/image, compare it visually with the product catalog images to identify which product they're showing or asking about. If you recognize a match, respond with the product details and a [PRODUCT_CARD:id] tag.

CROSS-SELL:
- When a customer shows interest in or orders a product that has "→ Cross-sell" or "→ Up-sell" suggestions, naturally recommend those products. Keep it brief and natural.
- When you suggest a cross-sell/up-sell product, add a [RECOMMEND:sourceProductId:recommendedProductId] tag on its own line at the end (before the STATUS tag).

${agent.closingInstructions ? `CONVERSATION CLOSING:\n${agent.closingInstructions}\n` : `CONVERSATION CLOSING:
- After a successful order, thank the customer warmly and confirm the order details.
- If the customer says goodbye, thanks, or indicates they're done, respond with a brief friendly closing message.
- If the conversation seems finished (customer got their answer, order placed), close naturally — don't keep pushing.
`}
HUMAN INTERVENTION:
- If you cannot help the customer (complaint, refund request, technical issue, angry customer, repeated misunderstanding), tell them politely that a human team member will follow up shortly.
- Use [STATUS:UNCLEAR] or [STATUS:UNKNOWN] tags (below) so the system notifies the business owner immediately.

STATUS (REQUIRED):
- IMPORTANT: At the very end of your response, on a NEW line, you MUST add exactly one status tag (this is for internal tracking and will be removed before delivery):
  [STATUS:OK] — if you understood the customer and answered properly
  [STATUS:UNCLEAR:brief reason] — if you couldn't understand the customer's message or couldn't properly answer. This triggers an URGENT notification to the business owner.
  [STATUS:UNKNOWN:what they asked about] — if the customer asked about something not in your catalog or knowledge. This triggers an URGENT notification to the business owner.`;

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

      // When customer sends an image, also inject product images for visual comparison
      const productsWithImages = products.filter(p => p.primaryImageUrl);
      if (productsWithImages.length > 0 && productsWithImages.length <= 20) {
        content.push({ type: 'text', text: 'PRODUCT CATALOG IMAGES (for visual comparison with customer image):' });
        for (const p of productsWithImages) {
          content.push({ type: 'text', text: `Product: ${p.name} [ID: ${p.id}]` });
          content.push({ type: 'image_url', image_url: { url: p.primaryImageUrl! } });
        }
        content.push({ type: 'text', text: '\nCUSTOMER IMAGE(S) — Compare with catalog images above to identify the product:' });
      }

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
