// Wire types of the inbox: the read models and inputs of `@djaber/shared` (`schemas/inbox.ts`, one source for the API
// and the web) under the names used by this feature. Only what the shared package does not describe is declared here.
import type {
  ActionDescriptor,
  AiIntent,
  BlockReason,
  ChannelRefView,
  ComposerState as ServerComposerState,
  ConversationClientPanel,
  ConversationCounts,
  ConversationHead,
  ConversationListItemView,
  ConversationNoteView,
  ConversationOrderRef,
  ConversationStatus,
  ConversationView,
  CreateReportInput,
  CustomerBlockView,
  InboxAgentRef,
  InboxBulkAction,
  InboxClientRef,
  MessageAttachmentView,
  MessageCardView,
  MessageType,
  MessageView,
  ReportReason,
  SafetyRules,
  SendMessageInput,
  TemplateKey,
  UpdateConversationInput,
} from '@djaber/shared';

export { TEMPLATE_KEYS } from '@djaber/shared';
export type { InboxBulkAction };
export type { ActionDescriptor, AiIntent, BlockReason, ConversationCounts, ConversationStatus, MessageType, ReportReason, SafetyRules, TemplateKey, ServerComposerState };
export type Platform = 'facebook' | 'instagram';
export type ClientRef = InboxClientRef;
export type ChannelRef = ChannelRefView;
export type AgentRef = InboxAgentRef;
export type ConversationListItem = ConversationListItemView;
/** `GET /conversations/:id`. `creditsExhausted` / `aiUnavailable` arrive with billing (M9) and the AI pipeline (M4). */
export type Conversation = ConversationView & { creditsExhausted?: boolean; aiUnavailable?: boolean };
export type ClientPanel = ConversationClientPanel;
export type OrderRef = ConversationOrderRef;
export type Attachment = MessageAttachmentView;
export type DeliveryStatus = MessageView['deliveryStatus'];
export type ProductCard = MessageCardView;
export type Message = MessageView;
export type SendMessageBody = SendMessageInput;
export type ConversationPatchBody = UpdateConversationInput;
export type Note = ConversationNoteView;
export type CreateReportBody = CreateReportInput;
export type CustomerBlock = CustomerBlockView;

/* ---------- WS payloads (03-events §2): partial heads — only the fields an event carries are applied ---------- */
export type ConversationPatch = Partial<ConversationHead> & { id: string };
export type WsMessageCreated = { conversationId: string; message: Message; conversation?: ConversationPatch };
export type WsMessageUpdated = {
  conversationId: string;
  messageId: string;
  deliveryStatus?: DeliveryStatus;
  error?: string | null;
  transcript?: string | null;
  transcriptStatus?: Message['transcriptStatus'];
  attachments?: Attachment[];
  customerReaction?: Message['customerReaction'];
};
export type WsConversationUpdated = { conversation: ConversationPatch };
export type WsConversationDeleted = { id: string };

/* ---------- queue (GET /agent-insights?status=pending — M4 serves it; the page degrades when it is absent) ---------- */
export type InsightType = 'unclear' | 'unknown_topic' | 'handoff' | 'error';
export type AgentInsight = {
  id: string;
  type: InsightType;
  agent: AgentRef | null;
  conversationId: string;
  client: Pick<ClientRef, 'id' | 'name'> | null;
  customerMessage: string;
  aiResponse: string | null;
  detail: string | null;
  createdAt: string;
};
