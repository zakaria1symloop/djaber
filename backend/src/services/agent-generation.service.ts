import axios from 'axios';
import prisma from '../config/database';

export interface GeneratedAgent {
  personality: 'professional' | 'friendly' | 'casual' | 'technical';
  responseTone: 'balanced' | 'formal' | 'casual' | 'enthusiastic';
  responseLength: 'short' | 'medium' | 'detailed';
  customInstructions: string;
  businessSummary: string;
  languages: string[];
  topQuestions: string[];
  sampledMessages: number;
  sampledConversations: number;
  warning: string | null;
}

async function getOpenAIKey(): Promise<string | null> {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;
  try {
    const row = await prisma.aIProvider.findUnique({
      where: { provider: 'openai' },
      select: { apiKey: true, isActive: true },
    });
    if (row?.isActive && row.apiKey) return row.apiKey;
  } catch {}
  return null;
}

const ALLOWED_PERSONALITY = ['professional', 'friendly', 'casual', 'technical'] as const;
const ALLOWED_TONE = ['balanced', 'formal', 'casual', 'enthusiastic'] as const;
const ALLOWED_LENGTH = ['short', 'medium', 'detailed'] as const;

const DEFAULT_AGENT: Omit<GeneratedAgent, 'sampledMessages' | 'sampledConversations' | 'warning'> = {
  personality: 'friendly',
  responseTone: 'balanced',
  responseLength: 'medium',
  customInstructions:
    'You are the AI customer-service agent for an Algerian e-commerce merchant. Reply in the language of the customer (Arabic, Darja, or French). Be helpful, friendly, and concise. When asked about products, prices, availability, or delivery, use the merchant\'s product catalog. If you don\'t know an answer, say so politely and offer to forward to the merchant.',
  businessSummary: 'Algerian e-commerce merchant selling products via Facebook Messenger.',
  languages: ['Arabic', 'French'],
  topQuestions: [],
};

/**
 * Read up to N recent conversations + messages for a page, run them
 * through GPT-4o-mini, and return a draft AI agent configuration
 * the user can preview + apply.
 */
export async function generateAgentFromInbox(
  internalPageId: string,
  userId: string,
  opts: { conversationLimit?: number; messagesPerConversation?: number } = {},
): Promise<GeneratedAgent> {
  const conversationLimit = opts.conversationLimit ?? 25;
  const messagesPerConversation = opts.messagesPerConversation ?? 10;

  const page = await prisma.page.findFirst({
    where: { id: internalPageId, userId, isActive: true },
  });
  if (!page) throw new Error('Page not found');

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return {
      ...DEFAULT_AGENT,
      sampledMessages: 0,
      sampledConversations: 0,
      warning: 'AI is temporarily unavailable — we drafted a sensible default for you. Try regenerating in a few minutes.',
    };
  }

  // Pull most-recent conversations with a window of recent messages each
  const conversations = await prisma.conversation.findMany({
    where: { pageId: internalPageId },
    orderBy: { updatedAt: 'desc' },
    take: conversationLimit,
    include: {
      messages: {
        orderBy: { timestamp: 'desc' },
        take: messagesPerConversation,
        select: { text: true, isFromPage: true, timestamp: true },
      },
    },
  });

  const allMessages = conversations.flatMap((c) =>
    c.messages
      .filter((m) => m.text && m.text.trim().length > 0)
      .map((m) => ({ ...m, conversationId: c.id })),
  );

  if (allMessages.length < 3) {
    return {
      ...DEFAULT_AGENT,
      businessSummary: `Page "${page.pageName}" — not enough conversations yet to analyze.`,
      sampledMessages: allMessages.length,
      sampledConversations: conversations.length,
      warning: 'Not enough conversation history to analyze. Returned a sensible default — sync more messages from Facebook then regenerate.',
    };
  }

  // Build a compact transcript: per conversation, oldest → newest
  const transcript = conversations
    .map((c, i) => {
      const ordered = [...c.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const lines = ordered
        .filter((m) => m.text && m.text.trim().length > 0)
        .map((m) => `${m.isFromPage ? 'MERCHANT' : 'CUSTOMER'}: ${m.text!.slice(0, 220)}`);
      if (lines.length === 0) return null;
      const handle = c.senderName || `customer ${i + 1}`;
      return `--- Conversation with ${handle} ---\n${lines.join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');

  // Cap the prompt size so we don't blow up the token budget
  const trimmed = transcript.length > 12000 ? transcript.slice(0, 12000) + '\n…(truncated)' : transcript;

  const systemPrompt = `You are a senior customer-service consultant. Analyze the conversations between an Algerian e-commerce merchant ("MERCHANT") and their customers ("CUSTOMER") on Facebook Messenger / Instagram DMs, and produce a configuration for an AI agent that will reply on the merchant's behalf.

Conversations may mix Arabic, Darja (Algerian dialect, often written in Latin letters), and French. The agent must reply in the language of the customer.

Respond with strict JSON ONLY in this exact shape (no extra keys, no commentary):
{
  "personality": "professional" | "friendly" | "casual" | "technical",
  "responseTone": "balanced" | "formal" | "casual" | "enthusiastic",
  "responseLength": "short" | "medium" | "detailed",
  "businessSummary": "1–2 sentences describing what this merchant sells, in English",
  "languages": ["primary languages used by customers, e.g. Arabic, Darja, French"],
  "topQuestions": ["3–6 short topics customers ask about, e.g. price, sizes, delivery time, payment, returns"],
  "customInstructions": "200–500 words of CONCRETE, OPERATIONAL instructions tailored to THIS merchant. Cover: language matching, how to greet, how to handle price/availability questions, how to handle delivery questions, how to handle haggling, when to escalate to the human merchant, what NOT to do (no fake promises, no inventing prices). Use merchant-specific details from the transcripts (product types, common objections, common shipping cities, etc.) — be specific, not generic."
}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Conversations (${conversations.length} total, ${allMessages.length} messages):\n\n${trimmed}`,
          },
        ],
        max_tokens: 1100,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 45000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from model');
    const parsed = JSON.parse(content);

    const personality = (ALLOWED_PERSONALITY as readonly string[]).includes(parsed.personality)
      ? parsed.personality
      : DEFAULT_AGENT.personality;
    const responseTone = (ALLOWED_TONE as readonly string[]).includes(parsed.responseTone)
      ? parsed.responseTone
      : DEFAULT_AGENT.responseTone;
    const responseLength = (ALLOWED_LENGTH as readonly string[]).includes(parsed.responseLength)
      ? parsed.responseLength
      : DEFAULT_AGENT.responseLength;

    return {
      personality: personality as GeneratedAgent['personality'],
      responseTone: responseTone as GeneratedAgent['responseTone'],
      responseLength: responseLength as GeneratedAgent['responseLength'],
      customInstructions: String(parsed.customInstructions || DEFAULT_AGENT.customInstructions).slice(0, 4000),
      businessSummary: String(parsed.businessSummary || `${page.pageName} on ${page.platform}`).slice(0, 600),
      languages: Array.isArray(parsed.languages) ? parsed.languages.slice(0, 5).map((s: any) => String(s).slice(0, 30)) : DEFAULT_AGENT.languages,
      topQuestions: Array.isArray(parsed.topQuestions) ? parsed.topQuestions.slice(0, 8).map((s: any) => String(s).slice(0, 80)) : [],
      sampledMessages: allMessages.length,
      sampledConversations: conversations.length,
      warning: null,
    };
  } catch (err: any) {
    console.error('[agent-generation] failed:', err.response?.data || err.message);
    return {
      ...DEFAULT_AGENT,
      sampledMessages: allMessages.length,
      sampledConversations: conversations.length,
      warning: 'AI analysis failed. Returned a sensible default — please try again or refine manually.',
    };
  }
}
