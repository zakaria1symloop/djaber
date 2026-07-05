// ============================================================================
// AI Analytics API client — /api/user-stock/analytics/*
// The AI story: conversations handled, how the agent responds, and credit
// consumption. Backend: user-ai-analytics.controller.ts. Money is DA.
// ============================================================================

import { apiRequest } from './api-config';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

export interface TimePoint {
  date: string; // YYYY-MM-DD (first-of-month for 'year')
  label: string; // short axis label ("05 Jul" / "Jul")
  [metric: string]: string | number;
}

export interface RankRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  secondary?: number;
  extra?: Record<string, number | string>;
}

const qp = (period: AnalyticsPeriod, extra?: Record<string, string>) =>
  new URLSearchParams({ period, ...(extra || {}) }).toString();

// ---------------------------------------------------------------------------
// CONVERSATIONS — volume, status, engagement, where they come from
// ---------------------------------------------------------------------------
export interface ConversationsAnalytics {
  period: AnalyticsPeriod;
  totals: {
    conversations: number; // conversations with >=1 message in the window
    newConversations: number; // created in window
    activeNow: number; // status active
    resolved: number; // status resolved (AI-paused / human takeover)
    archived: number;
    unread: number; // latest message is from the customer
    messages: number; // total messages in window
    uniqueCustomers: number; // distinct senderId / clientId
    returningCustomers: number; // customers with >1 conversation ever
  };
  avgMessagesPerConversation: number | null;
  series: TimePoint[]; // { date,label, conversations, messages }
  byStatus: RankRow[]; // active / resolved / archived
  byPage: RankRow[]; // value = conversations, secondary = messages
  byHour: Array<{ hour: number; count: number }>; // 0-23 incoming-message volume (activity clock)
  topCustomers: RankRow[]; // by message count in window
}
export const getConversationsAnalytics = (period: AnalyticsPeriod = 'month') =>
  apiRequest<ConversationsAnalytics>(`/api/user-stock/analytics/conversations?${qp(period)}`);

// ---------------------------------------------------------------------------
// RESPONSES — how the AI replies: speed, coverage, handoffs, quality
// ---------------------------------------------------------------------------
export interface ResponsesAnalytics {
  period: AnalyticsPeriod;
  totals: {
    incoming: number; // customer messages in window
    aiReplies: number; // outgoing messages sent by the AI
    humanReplies: number; // outgoing messages sent manually
    replyRatePct: number | null; // conversations that got at least one AI reply
    autoResolvedPct: number | null; // resolved without human reply
    handoffs: number; // conversations paused for human (aiPaused / resolved via insight)
    handoffRatePct: number | null;
  };
  responseTime: {
    avgFirstResponseSec: number | null; // customer msg -> first AI reply
    medianFirstResponseSec: number | null;
    within1MinPct: number | null;
  };
  insights: { unclear: number; unknown: number; handoff: number; resolved: number; pending: number };
  series: TimePoint[]; // { date,label, aiReplies, humanReplies }
  byPage: RankRow[]; // value = aiReplies, secondary = replyRatePct
  byAgent: RankRow[]; // value = aiReplies, secondary = handoffs
}
export const getResponsesAnalytics = (period: AnalyticsPeriod = 'month') =>
  apiRequest<ResponsesAnalytics>(`/api/user-stock/analytics/responses?${qp(period)}`);

// ---------------------------------------------------------------------------
// CONSUMPTION — credits burned: by type, agent, page, over time + runway
// ---------------------------------------------------------------------------
export interface ConsumptionAnalytics {
  period: AnalyticsPeriod;
  credits: {
    used: number; // this billing period (User.creditsUsed)
    limit: number;
    remaining: number;
    percentage: number;
    resetAt: string | null;
  };
  windowUsed: number; // credits consumed inside the selected window (from ledger)
  costEstimateUSD: number | null; // rough $ cost of the window's usage
  burn: {
    perDayAvg: number; // avg credits/day over the window
    projectedMonth: number; // extrapolated monthly consumption
    runwayDays: number | null; // remaining / perDayAvg (null if no burn)
    willExhaust: boolean; // projectedMonth > limit
  };
  byAction: RankRow[]; // text_message / image_recognition / voice_transcription / order_created (value=credits, secondary=count)
  byAgent: RankRow[]; // value = credits
  byPage: RankRow[]; // value = credits
  series: TimePoint[]; // { date,label, credits }
  ledgerReady: boolean; // false => figures reconstructed from message history (estimated)
}
export const getConsumptionAnalytics = (period: AnalyticsPeriod = 'month') =>
  apiRequest<ConsumptionAnalytics>(`/api/user-stock/analytics/consumption?${qp(period)}`);
