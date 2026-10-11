// MSG-06 / 04 §23 — what may leave towards a customer, per platform, relative to the 24 h window that opens with the
// customer's last message. Pure: the same table is used when a message is composed and when it is sent.
import { HUMAN_AGENT_WINDOW_DAYS, MESSAGING_WINDOW_HOURS } from '@djaber/shared';

export type SendKind = 'ai' | 'human' | 'transactional' | 'system';
export type WindowDecision =
  | { action: 'send'; messagingType: 'RESPONSE'; tag?: undefined }
  | { action: 'send'; messagingType: 'MESSAGE_TAG'; tag: 'HUMAN_AGENT' | 'POST_PURCHASE_UPDATE' }
  /** stored with `deliveryStatus = skipped_window`, never sent ("Non délivré — hors fenêtre 24 h") */
  | { action: 'skip' }
  /** refused at once: `422 REPLY_OUTSIDE_WINDOW` (the customer must write first) */
  | { action: 'reject'; code: 'REPLY_OUTSIDE_WINDOW' };

const HOUR = 3600_000;

export const withinWindow = (lastCustomerMessageAt: Date | null | undefined, now: Date, hours = MESSAGING_WINDOW_HOURS) =>
  !!lastCustomerMessageAt && now.getTime() - lastCustomerMessageAt.getTime() < hours * HOUR;

export const decideWindow = (p: { platform: 'facebook' | 'instagram'; kind: SendKind; lastCustomerMessageAt: Date | null | undefined; now?: Date }): WindowDecision => {
  const now = p.now ?? new Date();
  if (withinWindow(p.lastCustomerMessageAt, now)) return { action: 'send', messagingType: 'RESPONSE' };
  if (p.platform === 'instagram') {
    // Instagram has no message tags: nothing can leave outside the window
    return p.kind === 'human' ? { action: 'reject', code: 'REPLY_OUTSIDE_WINDOW' } : { action: 'skip' };
  }
  switch (p.kind) {
    case 'human':
      // HUMAN_AGENT is honoured by Meta for 7 days after the customer's message; a thread that never had one cannot be opened
      return withinWindow(p.lastCustomerMessageAt, now, HUMAN_AGENT_WINDOW_DAYS * 24) ? { action: 'send', messagingType: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' } : { action: 'reject', code: 'REPLY_OUTSIDE_WINDOW' };
    case 'transactional':
      return { action: 'send', messagingType: 'MESSAGE_TAG', tag: 'POST_PURCHASE_UPDATE' };
    default:
      // the AI and system texts never use a tag
      return { action: 'skip' };
  }
};
