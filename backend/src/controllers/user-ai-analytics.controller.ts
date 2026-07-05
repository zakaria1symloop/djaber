import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================================================
// AI Analytics — conversations / responses / consumption
// Response shapes MUST match the frontend contract in src/lib/ai-analytics-api.ts
// Everything is scoped by req.user.userId.
// ============================================================================

type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

interface PeriodWindow {
  period: AnalyticsPeriod;
  start: Date;
  days: number; // window length in days (used for burn / velocity)
}

// Same convention as user-analytics.controller: start of day for 'today',
// otherwise a rolling 7 / 30 / 365 day window back from now.
const resolvePeriodWindow = (raw: unknown): PeriodWindow => {
  const period: AnalyticsPeriod =
    raw === 'today' || raw === 'week' || raw === 'year' ? raw : 'month';
  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;

  switch (period) {
    case 'today':
      return { period, start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), days: 1 };
    case 'week':
      return { period, start: new Date(now.getTime() - 7 * DAY_MS), days: 7 };
    case 'year':
      return { period, start: new Date(now.getTime() - 365 * DAY_MS), days: 365 };
    default:
      return { period: 'month', start: new Date(now.getTime() - 30 * DAY_MS), days: 30 };
  }
};

// ----------------------------------------------------------------------------
// Shared shapes + bucketing helpers
// ----------------------------------------------------------------------------

interface RankRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  secondary?: number;
  extra?: Record<string, number | string>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number): string => String(n).padStart(2, '0');
const dayKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
const dayLabel = (d: Date): string => `${pad2(d.getDate())} ${MONTHS[d.getMonth()]}`;
const monthLabel = (d: Date): string => MONTHS[d.getMonth()];

// Build an ordered set of {date,label} buckets (daily, or monthly for 'year')
// plus a key->index map so callers can fill metrics without gaps.
const buildSeriesScaffold = (start: Date, period: AnalyticsPeriod) => {
  const now = new Date();
  const isMonthly = period === 'year';
  const buckets: Array<{ date: string; label: string }> = [];
  const indexByKey = new Map<string, number>();
  const cursor = isMonthly
    ? new Date(start.getFullYear(), start.getMonth(), 1)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = isMonthly
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (cursor <= end) {
    const key = isMonthly ? monthKey(cursor) : dayKey(cursor);
    indexByKey.set(key, buckets.length);
    buckets.push({ date: key, label: isMonthly ? monthLabel(cursor) : dayLabel(cursor) });
    if (isMonthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  const keyOf = (d: Date): string => (isMonthly ? monthKey(d) : dayKey(d));
  return { buckets, indexByKey, keyOf };
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// An outgoing message counts as an AI reply when its platform messageId was
// stamped by the agent runtime ('agent_' / 'ai_'). Anything else outgoing is
// treated as a human reply.
const isAiReplyMsg = (m: { isFromPage: boolean; messageId: string }): boolean =>
  m.isFromPage && (m.messageId.startsWith('agent_') || m.messageId.startsWith('ai_'));

// ============================================================================
// CONVERSATIONS — volume, status, engagement, where they come from
// ============================================================================

export const getConversationsAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, start } = resolvePeriodWindow(req.query.period);
    const { buckets, indexByKey, keyOf } = buildSeriesScaffold(start, period);

    const [allConvs, windowMessages, activeConvs, pages, clients] = await Promise.all([
      // All conversations ever (current status + returning-customer detection)
      prisma.conversation.findMany({
        where: { userId },
        select: { id: true, senderId: true, senderName: true, clientId: true, pageId: true, status: true, createdAt: true },
      }),
      // Every message in the window (one pass powers most aggregates)
      prisma.message.findMany({
        where: { conversation: { userId }, timestamp: { gte: start } },
        select: { conversationId: true, isFromPage: true, timestamp: true },
      }),
      // Active conversations + their latest message (for the unread count)
      prisma.conversation.findMany({
        where: { userId, status: 'active' },
        select: { messages: { orderBy: { timestamp: 'desc' }, take: 1, select: { isFromPage: true } } },
      }),
      prisma.page.findMany({ where: { userId }, select: { id: true, pageName: true } }),
      prisma.client.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);

    const convById = new Map(allConvs.map((c) => [c.id, c]));
    const pageNameById = new Map(pages.map((p) => [p.id, p.pageName]));
    const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

    // ---- Current-status totals (state, not window-scoped) --------------------
    let activeNow = 0;
    let resolved = 0;
    let archived = 0;
    for (const c of allConvs) {
      if (c.status === 'active') activeNow += 1;
      else if (c.status === 'resolved') resolved += 1;
      else if (c.status === 'archived') archived += 1;
    }

    const unread = activeConvs.filter((c) => c.messages[0] && !c.messages[0].isFromPage).length;

    // newConversations = created inside the window
    const newConversations = allConvs.filter((c) => c.createdAt >= start).length;

    // returningCustomers = distinct senderId with >1 conversation ever
    const convsPerSender = new Map<string, number>();
    for (const c of allConvs) convsPerSender.set(c.senderId, (convsPerSender.get(c.senderId) ?? 0) + 1);
    let returningCustomers = 0;
    for (const n of convsPerSender.values()) if (n > 1) returningCustomers += 1;

    // ---- Window message aggregates ------------------------------------------
    const messages = windowMessages.length;
    const windowConvIds = new Set<string>();
    const uniqueSenders = new Set<string>();

    // byPage: conversations (distinct) + messages, keyed by page
    const perPage = new Map<string, { convs: Set<string>; messages: number }>();
    // topCustomers: message volume keyed by customer (senderId)
    const perCustomer = new Map<string, { messages: number; senderName: string | null; clientId: string | null }>();
    // byHour: incoming-message activity clock (0-23)
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    // series buckets + per-day distinct-conversation sets
    const series = buckets.map((b) => ({ ...b, conversations: 0, messages: 0 }));
    const daySets: Array<Set<string>> = buckets.map(() => new Set<string>());

    for (const m of windowMessages) {
      const conv = convById.get(m.conversationId);
      if (!conv) continue;
      windowConvIds.add(m.conversationId);
      uniqueSenders.add(conv.senderId);

      // byPage
      const pg = perPage.get(conv.pageId) ?? { convs: new Set<string>(), messages: 0 };
      pg.convs.add(m.conversationId);
      pg.messages += 1;
      perPage.set(conv.pageId, pg);

      // topCustomers (total message volume in the window)
      const cust = perCustomer.get(conv.senderId) ?? { messages: 0, senderName: conv.senderName, clientId: conv.clientId };
      cust.messages += 1;
      if (!cust.senderName && conv.senderName) cust.senderName = conv.senderName;
      if (!cust.clientId && conv.clientId) cust.clientId = conv.clientId;
      perCustomer.set(conv.senderId, cust);

      // byHour — incoming only
      if (!m.isFromPage) byHour[m.timestamp.getHours()].count += 1;

      // series
      const idx = indexByKey.get(keyOf(m.timestamp));
      if (idx !== undefined) {
        series[idx].messages += 1;
        daySets[idx].add(m.conversationId);
      }
    }
    for (let i = 0; i < series.length; i++) series[i].conversations = daySets[i].size;

    const conversations = windowConvIds.size;

    const byStatus: RankRow[] = [
      { id: 'active', label: 'Active', value: activeNow },
      { id: 'resolved', label: 'Resolved', value: resolved },
      { id: 'archived', label: 'Archived', value: archived },
    ];

    const byPage: RankRow[] = [...perPage.entries()]
      .map(([pageId, v]) => ({
        id: pageId,
        label: pageNameById.get(pageId) ?? 'Unknown page',
        value: v.convs.size,
        secondary: v.messages,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const topCustomers: RankRow[] = [...perCustomer.entries()]
      .map(([senderId, v]) => ({
        id: senderId,
        label:
          v.senderName ||
          (v.clientId ? clientNameById.get(v.clientId) : undefined) ||
          `Customer ${senderId.slice(-6)}`,
        value: v.messages,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    res.json({
      period,
      totals: {
        conversations,
        newConversations,
        activeNow,
        resolved,
        archived,
        unread,
        messages,
        uniqueCustomers: uniqueSenders.size,
        returningCustomers,
      },
      avgMessagesPerConversation: conversations > 0 ? messages / conversations : null,
      series,
      byStatus,
      byPage,
      byHour,
      topCustomers,
    });
  } catch (error) {
    console.error('Get conversations analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations analytics' });
  }
};

// ============================================================================
// RESPONSES — how the AI replies: speed, coverage, handoffs, quality
// ============================================================================

// Cap on how many conversations we walk for first-response-time sampling.
// Keeps the endpoint fast for very active stores; the sample is representative.
const RESPONSE_TIME_CONV_CAP = 300;

export const getResponsesAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, start } = resolvePeriodWindow(req.query.period);
    const { buckets, indexByKey, keyOf } = buildSeriesScaffold(start, period);

    const [windowMessages, convMeta, insightRows, pages, agents] = await Promise.all([
      prisma.message.findMany({
        where: { conversation: { userId }, timestamp: { gte: start } },
        select: { conversationId: true, isFromPage: true, messageId: true, timestamp: true },
      }),
      prisma.conversation.findMany({
        where: { userId },
        select: { id: true, pageId: true, agentId: true, status: true, aiPaused: true, updatedAt: true },
      }),
      prisma.agentInsight.findMany({
        where: { agent: { userId }, createdAt: { gte: start } },
        select: { type: true, status: true, conversationId: true },
      }),
      prisma.page.findMany({ where: { userId }, select: { id: true, pageName: true } }),
      prisma.agent.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);

    const convMetaById = new Map(convMeta.map((c) => [c.id, c]));
    const pageNameById = new Map(pages.map((p) => [p.id, p.pageName]));
    const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

    // ---- Group window messages per conversation (sorted for response time) ---
    type Msg = { conversationId: string; isFromPage: boolean; messageId: string; timestamp: Date };
    const msgsByConv = new Map<string, Msg[]>();
    let incoming = 0;
    let aiReplies = 0;
    let humanReplies = 0;

    // series: outgoing split ai/human per bucket
    const series = buckets.map((b) => ({ ...b, aiReplies: 0, humanReplies: 0 }));

    for (const m of windowMessages) {
      const list = msgsByConv.get(m.conversationId);
      if (list) list.push(m);
      else msgsByConv.set(m.conversationId, [m]);

      if (!m.isFromPage) {
        incoming += 1;
        continue;
      }
      const idx = indexByKey.get(keyOf(m.timestamp));
      if (isAiReplyMsg(m)) {
        aiReplies += 1;
        if (idx !== undefined) series[idx].aiReplies += 1;
      } else {
        humanReplies += 1;
        if (idx !== undefined) series[idx].humanReplies += 1;
      }
    }

    // ---- Per-conversation flags + first-response-time sampling ---------------
    interface ConvAgg {
      incoming: number;
      ai: number;
      human: number;
    }
    const convAgg = new Map<string, ConvAgg>();
    const firstResponseSecs: number[] = [];
    let sampled = 0;

    for (const [convId, list] of msgsByConv) {
      list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const agg: ConvAgg = { incoming: 0, ai: 0, human: 0 };
      let firstIncomingTs: number | null = null;
      let firstAiAfter: number | null = null;
      for (const m of list) {
        if (!m.isFromPage) {
          agg.incoming += 1;
          if (firstIncomingTs === null) firstIncomingTs = m.timestamp.getTime();
        } else if (isAiReplyMsg(m)) {
          agg.ai += 1;
          if (firstIncomingTs !== null && firstAiAfter === null && m.timestamp.getTime() >= firstIncomingTs) {
            firstAiAfter = m.timestamp.getTime();
          }
        } else {
          agg.human += 1;
        }
      }
      convAgg.set(convId, agg);
      if (sampled < RESPONSE_TIME_CONV_CAP && firstIncomingTs !== null && firstAiAfter !== null) {
        firstResponseSecs.push((firstAiAfter - firstIncomingTs) / 1000);
        sampled += 1;
      }
    }

    // ---- Reply / auto-resolve / handoff rates -------------------------------
    let convsWithIncoming = 0;
    let convsWithAi = 0;
    let resolvedInWindow = 0;
    let resolvedNoHuman = 0;
    for (const [convId, agg] of convAgg) {
      if (agg.incoming > 0) {
        convsWithIncoming += 1;
        if (agg.ai > 0) convsWithAi += 1;
      }
      const meta = convMetaById.get(convId);
      if (meta?.status === 'resolved') {
        resolvedInWindow += 1;
        if (agg.human === 0) resolvedNoHuman += 1;
      }
    }

    // handoffs = conversations paused for a human (aiPaused set, updated in
    // window) OR flagged by a 'handoff' insight in the window.
    const handoffConvIds = new Set<string>();
    for (const c of convMeta) if (c.aiPaused && c.updatedAt >= start) handoffConvIds.add(c.id);
    for (const i of insightRows) if (i.type === 'handoff') handoffConvIds.add(i.conversationId);
    const handoffs = handoffConvIds.size;
    const windowConvCount = msgsByConv.size;

    // ---- Insight counters (in window) ---------------------------------------
    const insights = { unclear: 0, unknown: 0, handoff: 0, resolved: 0, pending: 0 };
    for (const i of insightRows) {
      if (i.type === 'unclear') insights.unclear += 1;
      else if (i.type === 'unknown_topic') insights.unknown += 1;
      else if (i.type === 'handoff') insights.handoff += 1;
      if (i.status === 'resolved') insights.resolved += 1;
      else if (i.status === 'pending') insights.pending += 1;
    }

    // ---- byPage / byAgent ----------------------------------------------------
    const perPage = new Map<string, { ai: number; convIncoming: number; convAi: number }>();
    const perAgentAi = new Map<string, number>();
    for (const [convId, agg] of convAgg) {
      const meta = convMetaById.get(convId);
      if (!meta) continue;
      const pg = perPage.get(meta.pageId) ?? { ai: 0, convIncoming: 0, convAi: 0 };
      pg.ai += agg.ai;
      if (agg.incoming > 0) {
        pg.convIncoming += 1;
        if (agg.ai > 0) pg.convAi += 1;
      }
      perPage.set(meta.pageId, pg);
      if (meta.agentId) perAgentAi.set(meta.agentId, (perAgentAi.get(meta.agentId) ?? 0) + agg.ai);
    }
    const perAgentHandoffs = new Map<string, number>();
    for (const convId of handoffConvIds) {
      const agentId = convMetaById.get(convId)?.agentId;
      if (agentId) perAgentHandoffs.set(agentId, (perAgentHandoffs.get(agentId) ?? 0) + 1);
    }

    const byPage: RankRow[] = [...perPage.entries()]
      .map(([pageId, v]) => ({
        id: pageId,
        label: pageNameById.get(pageId) ?? 'Unknown page',
        value: v.ai,
        secondary: v.convIncoming > 0 ? (v.convAi / v.convIncoming) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const agentIdsForRank = new Set<string>([...perAgentAi.keys(), ...perAgentHandoffs.keys()]);
    const byAgent: RankRow[] = [...agentIdsForRank]
      .map((agentId) => ({
        id: agentId,
        label: agentNameById.get(agentId) ?? 'Unknown agent',
        value: perAgentAi.get(agentId) ?? 0,
        secondary: perAgentHandoffs.get(agentId) ?? 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    res.json({
      period,
      totals: {
        incoming,
        aiReplies,
        humanReplies,
        replyRatePct: convsWithIncoming > 0 ? (convsWithAi / convsWithIncoming) * 100 : null,
        autoResolvedPct: resolvedInWindow > 0 ? (resolvedNoHuman / resolvedInWindow) * 100 : null,
        handoffs,
        handoffRatePct: windowConvCount > 0 ? (handoffs / windowConvCount) * 100 : null,
      },
      responseTime: {
        avgFirstResponseSec:
          firstResponseSecs.length > 0
            ? firstResponseSecs.reduce((s, v) => s + v, 0) / firstResponseSecs.length
            : null,
        medianFirstResponseSec: median(firstResponseSecs),
        within1MinPct:
          firstResponseSecs.length > 0
            ? (firstResponseSecs.filter((s) => s <= 60).length / firstResponseSecs.length) * 100
            : null,
      },
      insights,
      series,
      byPage,
      byAgent,
    });
  } catch (error) {
    console.error('Get responses analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch responses analytics' });
  }
};

// ============================================================================
// CONSUMPTION — credits burned: by type / agent / page, over time + runway
// ============================================================================

// Cost assumption: a rough flat $0.0005 per credit-action. Documented so the
// figure can be tuned centrally without changing the shape.
const USD_PER_CREDIT = 0.0005;

const ACTION_LABELS: Record<string, string> = {
  text_message: 'Text replies',
  image_recognition: 'Image recognition',
  voice_transcription: 'Voice notes',
  order_created: 'Orders created',
};

export const getConsumptionAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, start, days } = resolvePeriodWindow(req.query.period);
    const { buckets, indexByKey, keyOf } = buildSeriesScaffold(start, period);

    const [user, ledgerRows, pages, agents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true, creditsResetAt: true },
      }),
      prisma.creditUsage.findMany({
        where: { userId, createdAt: { gte: start } },
        select: { action: true, credits: true, agentId: true, pageId: true, createdAt: true },
      }),
      prisma.page.findMany({ where: { userId }, select: { id: true, pageName: true } }),
      prisma.agent.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const pageNameById = new Map(pages.map((p) => [p.id, p.pageName]));
    const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

    // Accumulators (shared by ledger + reconstruction paths)
    const byActionMap = new Map<string, { credits: number; count: number }>();
    const byAgentMap = new Map<string, number>();
    const byPageMap = new Map<string, number>();
    const series = buckets.map((b) => ({ ...b, credits: 0 }));
    let windowUsed = 0;

    const addCredit = (
      action: string,
      credits: number,
      when: Date,
      agentId: string | null,
      pageId: string | null
    ): void => {
      windowUsed += credits;
      const a = byActionMap.get(action) ?? { credits: 0, count: 0 };
      a.credits += credits;
      a.count += 1;
      byActionMap.set(action, a);
      if (agentId) byAgentMap.set(agentId, (byAgentMap.get(agentId) ?? 0) + credits);
      if (pageId) byPageMap.set(pageId, (byPageMap.get(pageId) ?? 0) + credits);
      const idx = indexByKey.get(keyOf(when));
      if (idx !== undefined) series[idx].credits += credits;
    };

    let ledgerReady: boolean;

    if (ledgerRows.length > 0) {
      // ---- Live ledger --------------------------------------------------------
      ledgerReady = true;
      for (const row of ledgerRows) {
        addCredit(row.action, row.credits, row.createdAt, row.agentId, row.pageId);
      }
    } else {
      // ---- Reconstruct an estimate from message + order history --------------
      ledgerReady = false;
      const [windowMessages, convMeta, aiOrders] = await Promise.all([
        prisma.message.findMany({
          where: { conversation: { userId }, timestamp: { gte: start } },
          select: { conversationId: true, isFromPage: true, messageId: true, attachmentType: true, timestamp: true },
        }),
        prisma.conversation.findMany({
          where: { userId },
          select: { id: true, agentId: true, pageId: true, clientId: true, updatedAt: true },
        }),
        prisma.order.findMany({
          where: { userId, source: 'ai', orderDate: { gte: start } },
          select: { orderDate: true, createdAt: true, clientId: true },
        }),
      ]);

      const convMetaById = new Map(convMeta.map((c) => [c.id, c]));

      // Group + sort messages so we can look back to the nearest preceding
      // incoming message and price image / voice replies accordingly.
      type RMsg = { isFromPage: boolean; messageId: string; attachmentType: string | null; timestamp: Date };
      const msgsByConv = new Map<string, RMsg[]>();
      for (const m of windowMessages) {
        const list = msgsByConv.get(m.conversationId);
        if (list) list.push(m);
        else msgsByConv.set(m.conversationId, [m]);
      }
      for (const [convId, list] of msgsByConv) {
        list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const meta = convMetaById.get(convId);
        const agentId = meta?.agentId ?? null;
        const pageId = meta?.pageId ?? null;
        let lastIncomingAttachment: string | null = null;
        for (const m of list) {
          if (!m.isFromPage) {
            lastIncomingAttachment = m.attachmentType ?? null;
            continue;
          }
          if (!isAiReplyMsg(m)) continue;
          // Price the AI reply by the nearest preceding incoming attachment.
          if (lastIncomingAttachment === 'image') addCredit('image_recognition', 5, m.timestamp, agentId, pageId);
          else if (lastIncomingAttachment === 'audio') addCredit('voice_transcription', 3, m.timestamp, agentId, pageId);
          else addCredit('text_message', 1, m.timestamp, agentId, pageId);
        }
      }

      // +2 credits per AI order, attributed to the client's most recent
      // conversation predating the order (same approach as user-analytics).
      const convsByClient = new Map<string, Array<{ agentId: string | null; pageId: string; updatedAt: Date }>>();
      for (const c of convMeta) {
        if (!c.clientId) continue;
        const list = convsByClient.get(c.clientId) ?? [];
        list.push({ agentId: c.agentId, pageId: c.pageId, updatedAt: c.updatedAt });
        convsByClient.set(c.clientId, list);
      }
      for (const list of convsByClient.values()) list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      for (const order of aiOrders) {
        let agentId: string | null = null;
        let pageId: string | null = null;
        if (order.clientId) {
          const convs = convsByClient.get(order.clientId) ?? [];
          const match = convs.find((c) => c.updatedAt <= order.createdAt) ?? convs[0];
          if (match) {
            agentId = match.agentId;
            pageId = match.pageId;
          }
        }
        addCredit('order_created', 2, order.orderDate, agentId, pageId);
      }
    }

    // ---- Assemble rank rows -------------------------------------------------
    const byAction: RankRow[] = [...byActionMap.entries()]
      .map(([action, v]) => ({
        id: action,
        label: ACTION_LABELS[action] ?? action,
        value: v.credits,
        secondary: v.count,
      }))
      .sort((a, b) => b.value - a.value);

    const byAgent: RankRow[] = [...byAgentMap.entries()]
      .map(([agentId, credits]) => ({
        id: agentId,
        label: agentNameById.get(agentId) ?? 'Unknown agent',
        value: credits,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const byPage: RankRow[] = [...byPageMap.entries()]
      .map(([pageId, credits]) => ({
        id: pageId,
        label: pageNameById.get(pageId) ?? 'Unknown page',
        value: credits,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    // ---- Credits / burn / runway --------------------------------------------
    const used = user.creditsUsed;
    const limit = user.creditsLimit;
    const remaining = Math.max(0, limit - used);
    const perDayAvg = windowUsed / days;
    const projectedMonth = perDayAvg * 30;

    res.json({
      period,
      credits: {
        used,
        limit,
        remaining,
        percentage: limit > 0 ? (used / limit) * 100 : 0,
        resetAt: user.creditsResetAt ? user.creditsResetAt.toISOString() : null,
      },
      windowUsed,
      costEstimateUSD: Number((windowUsed * USD_PER_CREDIT).toFixed(4)),
      burn: {
        perDayAvg,
        projectedMonth,
        runwayDays: perDayAvg > 0 ? remaining / perDayAvg : null,
        willExhaust: projectedMonth > limit,
      },
      byAction,
      byAgent,
      byPage,
      series,
      ledgerReady,
    });
  } catch (error) {
    console.error('Get consumption analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch consumption analytics' });
  }
};
