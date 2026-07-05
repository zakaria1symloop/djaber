import prisma from '../config/database';

export interface PageSummary {
  id: string;
  platform: string;
  pageId: string;
  pageName: string;
  pictureUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Stats
  conversations: {
    total: number;
    active: number;
    resolved: number;
    archived: number;
    unread: number; // last incoming message has no outgoing reply after it
  };
  messages: {
    last7d: number;
    last24h: number;
    incoming7d: number;
    outgoing7d: number;
  };
  products: number;
  agent: {
    id: string | null;
    name: string | null;
    enabled: boolean;
    autoReply: boolean;
    personality: string | null;
    hasInstructions: boolean;
  };
  lastActivity: Date | null;
}

/**
 * Aggregated view of a single page for the dashboard card.
 * One round-trip instead of many.
 */
export async function getPageSummary(pageId: string, userId: string): Promise<PageSummary | null> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, userId, isActive: true },
    include: { aiSettings: true },
  });
  if (!page) return null;

  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalConv,
    activeConv,
    resolvedConv,
    archivedConv,
    msgs7d,
    msgs24h,
    incoming7d,
    outgoing7d,
    productCount,
    latestMessage,
    activeConversations,
  ] = await Promise.all([
    prisma.conversation.count({ where: { pageId } }),
    prisma.conversation.count({ where: { pageId, status: 'active' } }),
    prisma.conversation.count({ where: { pageId, status: 'resolved' } }),
    prisma.conversation.count({ where: { pageId, status: 'archived' } }),
    prisma.message.count({ where: { conversation: { pageId }, timestamp: { gte: since7d } } }),
    prisma.message.count({ where: { conversation: { pageId }, timestamp: { gte: since24h } } }),
    prisma.message.count({
      where: { conversation: { pageId }, timestamp: { gte: since7d }, isFromPage: false },
    }),
    prisma.message.count({
      where: { conversation: { pageId }, timestamp: { gte: since7d }, isFromPage: true },
    }),
    prisma.product.count({ where: { userId, isActive: true } }),
    prisma.message.findFirst({
      where: { conversation: { pageId } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
    // For unread count: pull active conversations and check whether the
    // latest message was from the customer (= awaiting reply).
    prisma.conversation.findMany({
      where: { pageId, status: 'active' },
      select: {
        id: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { isFromPage: true },
        },
      },
    }),
  ]);

  // The REAL agent for this page (AgentPage link) — this is what the webhook
  // actually uses. PageAISettings is the legacy mirror, kept as fallback.
  const agentPage = await prisma.agentPage.findUnique({
    where: { pageId },
    include: { agent: { select: { id: true, name: true, isActive: true, personality: true, customInstructions: true } } },
  });

  const unread = activeConversations.filter((c) => c.messages[0] && !c.messages[0].isFromPage).length;

  // Prefer the stored avatar (IG profile_picture_url / FB page picture captured at
  // connect time). Fall back to the FB Graph redirect URL, which works directly in
  // <img> tags and is cached by FB. Instagram has no such fallback, so it relies on
  // the stored pageAvatar.
  const pictureUrl =
    page.pageAvatar ||
    (page.platform === 'facebook'
      ? `https://graph.facebook.com/v18.0/${page.pageId}/picture?type=large`
      : null);

  return {
    id: page.id,
    platform: page.platform,
    pageId: page.pageId,
    pageName: page.pageName,
    pictureUrl,
    isActive: page.isActive,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    conversations: {
      total: totalConv,
      active: activeConv,
      resolved: resolvedConv,
      archived: archivedConv,
      unread,
    },
    messages: {
      last7d: msgs7d,
      last24h: msgs24h,
      incoming7d,
      outgoing7d,
    },
    products: productCount,
    agent: agentPage?.agent
      ? {
          id: agentPage.agent.id,
          name: agentPage.agent.name,
          enabled: agentPage.agent.isActive,
          autoReply: agentPage.agent.isActive,
          personality: agentPage.agent.personality,
          hasInstructions: !!(agentPage.agent.customInstructions && agentPage.agent.customInstructions.trim().length > 0),
        }
      : {
          id: null,
          name: null,
          enabled: page.aiSettings?.aiEnabled ?? false,
          autoReply: page.aiSettings?.autoReply ?? false,
          personality: page.aiSettings?.aiPersonality ?? null,
          hasInstructions: !!(page.aiSettings?.customInstructions && page.aiSettings.customInstructions.trim().length > 0),
        },
    lastActivity: latestMessage?.timestamp ?? null,
  };
}
