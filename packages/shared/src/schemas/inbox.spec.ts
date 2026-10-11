import { describe, expect, it } from 'vitest';
import { ChannelsQuerySchema, SyncHistorySchema, UpdateChannelSchema } from './channels';
import {
  BulkAssignConversationsSchema,
  CreateBlockSchema,
  CreateReportSchema,
  autoBlockThreshold,
  DEFAULT_SAFETY_RULES,
  InboxQuerySchema,
  isWithin24h,
  NotificationsQuerySchema,
  SafetyRulesSchema,
  SendMessageSchema,
  UpdateConversationSchema,
} from './inbox';

const ID = '0191a000-0000-7000-8000-000000000001';
const ID2 = '0191a000-0000-7000-8000-000000000002';
const issues = (r: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}:${i.message}`));

describe('InboxQuerySchema (06 §10 "Boîte")', () => {
  it('parses URL values: comma lists, booleans, defaults', () => {
    const q = InboxQuerySchema.parse({ channelIds: `${ID},${ID2}`, intent: 'sale,info', client: 'risk', unread: 'true', blocked: '1', assigneeId: 'me', limit: '25' });
    expect(q).toMatchObject({ channelIds: [ID, ID2], intent: ['sale', 'info'], client: ['risk'], unread: true, blocked: true, assigneeId: 'me', limit: 25, sort: 'lastMessageAt' });
    expect(InboxQuerySchema.parse({}).limit).toBe(50);
    expect(InboxQuerySchema.parse({ assigneeId: ID }).assigneeId).toBe(ID);
    expect(InboxQuerySchema.parse({ unread: 'false' }).unread).toBe(false);
  });

  it('refuses unknown parameters, bad values and a 1-character search', () => {
    expect(InboxQuerySchema.safeParse({ workspaceId: ID }).success).toBe(false);
    expect(InboxQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
    expect(InboxQuerySchema.safeParse({ assigneeId: 'someone' }).success).toBe(false);
    expect(InboxQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(issues(InboxQuerySchema.safeParse({ q: 'a' }))).toEqual(['q:validation.length']);
    expect(InboxQuerySchema.safeParse({ from: '11/10/2026' }).success).toBe(false);
  });
});

describe('SendMessageSchema (api-contract §3.3 + 06 §8.8)', () => {
  it('accepts exactly one way of composing', () => {
    for (const body of [{ text: 'Bonjour' }, { uploadId: ID }, { text: 'Voici', uploadId: ID }, { quickReplyId: ID }, { templateKey: 'orderShipped' }]) {
      expect(SendMessageSchema.safeParse(body).success).toBe(true);
    }
    expect(issues(SendMessageSchema.safeParse({}))).toEqual(['text:validation.required']);
    expect(issues(SendMessageSchema.safeParse({ text: '   ' }))).toEqual(['text:validation.required']);
    expect(issues(SendMessageSchema.safeParse({ text: 'x', templateKey: 'orderShipped' }))).toEqual(['templateKey:validation.invalid']);
    expect(issues(SendMessageSchema.safeParse({ text: 'x', quickReplyId: ID }))).toEqual(['quickReplyId:validation.invalid']);
    expect(SendMessageSchema.safeParse({ templateKey: 'promo' }).success).toBe(false);
    expect(SendMessageSchema.safeParse({ text: 'x', conversationId: ID }).success).toBe(false);
  });
});

describe('conversation mutations', () => {
  it('PATCH needs a version and at least one change', () => {
    expect(UpdateConversationSchema.safeParse({ status: 'resolved', version: 3 }).success).toBe(true);
    expect(UpdateConversationSchema.safeParse({ assigneeId: null, version: 1 }).success).toBe(true);
    expect(issues(UpdateConversationSchema.safeParse({ aiPaused: true }))).toEqual(['version:validation.required']);
    expect(issues(UpdateConversationSchema.safeParse({ version: 1 }))).toEqual(['status:validation.required']);
    expect(UpdateConversationSchema.safeParse({ status: 'deleted', version: 1 }).success).toBe(false);
  });

  it('bulk assign needs an explicit assignee (null = unassign)', () => {
    expect(BulkAssignConversationsSchema.safeParse({ ids: [ID], assigneeId: null }).success).toBe(true);
    expect(BulkAssignConversationsSchema.safeParse({ ids: [ID] }).success).toBe(false);
    expect(BulkAssignConversationsSchema.safeParse({ ids: [], assigneeId: ID }).success).toBe(false);
  });
});

describe('trust & safety inputs', () => {
  it('a block targets a client or a phone, not both, not none', () => {
    expect(CreateBlockSchema.safeParse({ clientId: ID, reason: 'spam' }).success).toBe(true);
    expect(CreateBlockSchema.safeParse({ phone: '0555 12 34 56' }).success).toBe(true);
    expect(CreateBlockSchema.safeParse({}).success).toBe(false);
    expect(CreateBlockSchema.safeParse({ clientId: ID, phone: '0555123456' }).success).toBe(false);
  });

  it('a report names the target of its type', () => {
    expect(CreateReportSchema.safeParse({ type: 'conversation', conversationId: ID, reason: 'spam' }).success).toBe(true);
    expect(CreateReportSchema.safeParse({ type: 'customer', conversationId: ID, reason: 'fraud', blockAlso: true }).success).toBe(true);
    expect(issues(CreateReportSchema.safeParse({ type: 'ai_message', reason: 'ai_incorrect' }))).toEqual(['messageId:validation.required']);
    expect(issues(CreateReportSchema.safeParse({ type: 'product', reason: 'other' }))).toEqual(['productId:validation.required']);
    expect(CreateReportSchema.safeParse({ type: 'merchant', reason: 'other' }).success).toBe(false); // public page only
    const rules = { riskAfterReturns: 2, autoBlockEnabled: false, autoBlockAfterUncollected: 3, handoffOnRisk: true };
    expect(SafetyRulesSchema.safeParse(rules).success).toBe(true);
    expect(DEFAULT_SAFETY_RULES).toEqual(rules); // the auto-block rule is OFF by default (04 §13)
    expect(SafetyRulesSchema.safeParse({ ...rules, riskAfterReturns: 2.5 }).success).toBe(false);
    expect(issues(SafetyRulesSchema.safeParse({ ...rules, autoBlockAfterUncollected: 0 }))).toEqual(['autoBlockAfterUncollected:validation.range']); // threshold ≥ 1
    expect(issues(SafetyRulesSchema.safeParse({ riskAfterReturns: 2, autoBlockAfterUncollected: 3, handoffOnRisk: true }))).toEqual(['autoBlockEnabled:validation.required']);
    // the rule applies only when switched on
    expect(autoBlockThreshold(rules)).toBeNull();
    expect(autoBlockThreshold({ ...rules, autoBlockEnabled: true })).toBe(3);
    expect(autoBlockThreshold({ riskAfterReturns: 2, autoBlockAfterUncollected: 3, handoffOnRisk: true })).toBeNull(); // rows written before the flag existed
    expect(autoBlockThreshold(null)).toBeNull();
  });
});

describe('channels and notifications queries', () => {
  it('channel list, status change, history sync', () => {
    expect(ChannelsQuerySchema.parse({ status: 'active,paused', noAgent: 'true' })).toMatchObject({ status: ['active', 'paused'], noAgent: true });
    expect(ChannelsQuerySchema.safeParse({ status: 'gone' }).success).toBe(false);
    expect(UpdateChannelSchema.safeParse({ status: 'active', swapWithChannelId: ID }).success).toBe(true);
    expect(UpdateChannelSchema.safeParse({ status: 'disconnected' }).success).toBe(false);
    expect(SyncHistorySchema.parse({})).toEqual({ days: 30 });
    expect(SyncHistorySchema.safeParse({ days: 14 }).success).toBe(false);
  });

  it('notification filters', () => {
    expect(NotificationsQuerySchema.parse({ types: 'conversation_handoff,channel_needs_reconnect', unread: 'true' })).toMatchObject({ types: ['conversation_handoff', 'channel_needs_reconnect'], unread: true, limit: 20 });
    expect(NotificationsQuerySchema.safeParse({ types: 'conversation.handoff' }).success).toBe(false); // enum values are snake_case
  });
});

describe('isWithin24h (04 §23)', () => {
  const now = new Date('2026-10-11T12:00:00.000Z');
  it('is true for less than 24 h since the last customer message', () => {
    expect(isWithin24h('2026-10-10T12:00:01.000Z', now)).toBe(true);
    expect(isWithin24h('2026-10-10T12:00:00.000Z', now)).toBe(false);
    expect(isWithin24h(new Date('2026-10-11T11:59:00.000Z'), now)).toBe(true);
    expect(isWithin24h(null, now)).toBe(false);
    expect(isWithin24h('not a date', now)).toBe(false);
  });
});
