// Wire types of the channels module: the read models of `@djaber/shared` (`schemas/channels.ts`, api-contract §3.3,
// 06 §2 "Channels", §8.7) under the names the screens use, plus the WS payload and the list envelope.
import type {
  AppReviewStatusView,
  ChannelApprovalStatusView,
  ChannelCounts,
  ChannelEventView,
  ChannelHealth,
  ChannelInsightsView,
  ChannelRefView,
  ChannelStatus,
  ChannelSummaryView,
  ChannelView,
  ConnectPostMessage,
  ConnectReport,
  ConnectReportPage,
  ConnectReportPageStatus,
  ConnectUrlView,
  HistorySyncResult,
} from '@djaber/shared';
import { ChannelEventKindValues } from '@djaber/shared';

export { CONNECT_MESSAGE_TYPE } from '@djaber/shared';
export type { ChannelCounts, ChannelHealth, ChannelStatus, ConnectReport, ConnectReportPage };
export type Platform = 'facebook' | 'instagram';
export type PausedReason = 'manual' | 'plan' | 'moderation';
export type ChannelRef = ChannelRefView;
export type Channel = ChannelView;
export type PlanLimit = { limit: number; current: number };
/** `GET /channels` → `{ data: Channel[], meta: { planLimit } }` */
export type ChannelsList = { rows: Channel[]; planLimit: PlanLimit | null };

/** `GET /channels/connect/{facebook|instagram}` and `POST /channels/:id/reconnect`: the only URL the browser is sent to. */
export type ConnectStart = ConnectUrlView;
export type ConnectPageStatus = ConnectReportPageStatus;
/** `postMessage` of the callback page to its opener (05-integrations §1). */
export type ConnectMessage = ConnectPostMessage;

/** `GET /channels/app-review-status` (CHN-11) — drives the "approval pending" notices. */
export type AppReviewStatus = AppReviewStatusView;
/** `GET /channels/:id/approval-status` */
export type ApprovalStatus = ChannelApprovalStatusView;
/** `GET /channels/:id/insights` — Meta page insights; `422 INBOX_INSIGHTS_UNAVAILABLE` ⇒ the "unavailable" state. */
export type ChannelInsights = ChannelInsightsView;
/** `GET /channels/:id/summary` — counts, linked agent, health, linked Instagram accounts, last history sync. */
export type ChannelSummary = ChannelSummaryView;

export const CHANNEL_EVENT_KINDS = ChannelEventKindValues;
export type ChannelEventKind = (typeof ChannelEventKindValues)[number];
export type ChannelEvent = ChannelEventView;

export const SYNC_DAYS = [7, 30, 90] as const;
export type SyncDays = (typeof SYNC_DAYS)[number];
/** result of the history-sync job (`JobDto.result`) */
export type SyncResult = HistorySyncResult;

/** WS `channel.updated` (03-events §2) */
export type WsChannelUpdated = { channel: { id: string; status?: ChannelStatus; pausedReason?: PausedReason | null; agentId?: string | null; lastSeenAt?: string | null } };
