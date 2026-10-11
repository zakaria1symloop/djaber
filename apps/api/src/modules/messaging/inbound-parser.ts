// 05-integrations §1.3 — turns one `entry[].messaging[]` item of a Meta webhook (Messenger or Instagram) into a
// normalised event. Pure, no I/O. The shapes are the ones the live V1 app receives (webhook.controller.ts of V1).
import { createHash } from 'node:crypto';
import type { MessageType } from '@djaber/db';

export type MetaObject = 'page' | 'instagram';
export type RawMessagingItem = Record<string, any>;
/** What is stored in `InboundEvent.payload`. */
export type StoredInbound = { object: MetaObject; entryId: string; time: number | null; item: RawMessagingItem };

export type ParsedAttachment = {
  type: 'image' | 'audio' | 'video' | 'file' | 'location' | 'sticker';
  /** Meta CDN URL (downloaded later by the `media` job); a maps link for a location */
  url: string | null;
  mime: string;
  name?: string;
  lat?: number;
  lng?: number;
};
type Base = { platform: 'facebook' | 'instagram'; channelExternalId: string; customerId: string; at: Date };
export type ParsedMessage = Base & {
  kind: 'message' | 'echo';
  mid: string;
  text: string | null;
  type: MessageType;
  attachments: ParsedAttachment[];
  payload: Record<string, unknown> | null;
  /** nothing the AI can read: video / file / location / sticker / unsupported only, without text (MSG-09) */
  unsupportedOnly: boolean;
  /** echoes only: the app that sent the message (ours ⇒ already stored; another ⇒ a manual reply from the Page inbox) */
  appId: string | null;
};
export type ParsedInbound =
  | ParsedMessage
  | (Base & { kind: 'postback'; mid: string; title: string | null; data: string | null })
  | (Base & { kind: 'reaction'; mid: string; reaction: 'like' | 'dislike' | null })
  | (Base & { kind: 'read'; watermark: number | null })
  | (Base & { kind: 'delivery'; mids: string[] })
  | (Base & { kind: 'deleted'; mid: string })
  | { kind: 'ignored'; reason: string };

const MIME: Record<string, string> = { image: 'image/jpeg', audio: 'audio/mpeg', video: 'video/mp4', file: 'application/octet-stream', sticker: 'image/png', location: 'application/geo+json' };
const NEGATIVE = new Set(['dislike', 'angry', 'sad', '👎', '😠', '😡', '😢']);

/** Stable id of an event for `InboundEvent.externalId` (dedup of Meta redeliveries): the message id, else a content hash. */
export const inboundExternalId = (entryId: string, item: RawMessagingItem): string => {
  const mid = item?.message?.mid ?? item?.postback?.mid;
  if (typeof mid === 'string' && mid) return mid;
  const hash = createHash('sha256').update(JSON.stringify(item ?? {})).digest('hex').slice(0, 16);
  return `${entryId}:${item?.timestamp ?? 0}:${item?.sender?.id ?? ''}:${hash}`;
};

const attachmentsOf = (message: Record<string, any>): { list: ParsedAttachment[]; story: { kind: 'reply' | 'mention'; url: string | null } | null; unsupported: boolean; shareUrl: string | null } => {
  const list: ParsedAttachment[] = [];
  let story: { kind: 'reply' | 'mention'; url: string | null } | null = null;
  let unsupported = false;
  let shareUrl: string | null = null;
  for (const a of Array.isArray(message.attachments) ? message.attachments : []) {
    const url: string | null = typeof a?.payload?.url === 'string' ? a.payload.url : null;
    switch (a?.type) {
      case 'image':
        // Messenger sends stickers as images carrying a sticker_id
        list.push({ type: message.sticker_id || a.payload?.sticker_id ? 'sticker' : 'image', url, mime: message.sticker_id || a.payload?.sticker_id ? MIME.sticker! : MIME.image! });
        break;
      case 'audio':
      case 'video':
      case 'file':
        list.push({ type: a.type, url, mime: MIME[a.type]!, ...(typeof a.payload?.title === 'string' ? { name: a.payload.title } : {}) });
        break;
      case 'location': {
        const lat = Number(a.payload?.coordinates?.lat);
        const lng = Number(a.payload?.coordinates?.long ?? a.payload?.coordinates?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) list.push({ type: 'location', url: `https://www.google.com/maps?q=${lat},${lng}`, mime: MIME.location!, lat, lng });
        else unsupported = true;
        break;
      }
      case 'story_mention':
        story = { kind: 'mention', url };
        if (url) list.push({ type: 'image', url, mime: MIME.image! });
        break;
      case 'fallback':
      case 'share':
        // a shared link / post: keep the URL as text when Meta gives one
        shareUrl = url ?? (typeof a.url === 'string' ? a.url : null) ?? shareUrl;
        if (!shareUrl && !a.title) unsupported = true;
        break;
      default:
        unsupported = true; // template, reel, ig_reel, unknown: nothing we can show
    }
  }
  const reply = message.reply_to?.story;
  if (reply) story = { kind: 'reply', url: typeof reply.url === 'string' ? reply.url : null };
  return { list, story, unsupported, shareUrl };
};

const UNREADABLE = new Set(['video', 'file', 'location', 'sticker']);

export const parseInbound = (e: StoredInbound): ParsedInbound => {
  const item = e.item ?? {};
  const platform = e.object === 'instagram' ? 'instagram' : 'facebook';
  const senderId = typeof item.sender?.id === 'string' ? item.sender.id : item.sender?.id !== undefined ? String(item.sender.id) : '';
  const recipientId = item.recipient?.id !== undefined ? String(item.recipient.id) : '';
  if (!senderId || !recipientId) return { kind: 'ignored', reason: 'no_participants' };
  const at = new Date(typeof item.timestamp === 'number' && item.timestamp > 0 ? item.timestamp : (e.time ?? Date.now()));
  const message = item.message as Record<string, any> | undefined;
  const isEcho = message?.is_echo === true;
  // an echo is sent BY the page: sender = page, recipient = customer
  const base: Base = { platform, channelExternalId: isEcho ? senderId : recipientId, customerId: isEcho ? recipientId : senderId, at };

  if (message) {
    const mid = typeof message.mid === 'string' ? message.mid : '';
    if (!mid) return { kind: 'ignored', reason: 'no_mid' };
    if (message.is_deleted === true) return { ...base, kind: 'deleted', mid };
    const { list, story, unsupported, shareUrl } = attachmentsOf(message);
    const rawText = typeof message.text === 'string' && message.text.trim() ? message.text : null;
    const text = rawText ?? shareUrl;
    const notShown = message.is_unsupported === true || (unsupported && !list.length && !text);
    if (!list.length && !text && message.sticker_id) list.push({ type: 'sticker', url: null, mime: MIME.sticker! });
    const payload: Record<string, unknown> = {};
    if (typeof message.quick_reply?.payload === 'string') payload.quickReply = message.quick_reply.payload;
    if (story) payload.story = story;
    if (notShown) payload.unsupported = true;
    const loc = list.find((a) => a.type === 'location');
    if (loc) payload.location = { lat: loc.lat, lng: loc.lng };
    const type: MessageType = notShown ? 'file' : list.length ? (list[0]!.type as MessageType) : 'text';
    const unsupportedOnly = !rawText && (notShown || (list.length > 0 && list.every((a) => UNREADABLE.has(a.type))));
    return {
      ...base,
      kind: isEcho ? 'echo' : 'message',
      mid,
      text,
      type,
      attachments: list,
      payload: Object.keys(payload).length ? payload : null,
      unsupportedOnly,
      appId: message.app_id !== undefined && message.app_id !== null ? String(message.app_id) : null,
    };
  }
  if (item.postback) {
    const p = item.postback as Record<string, any>;
    const mid = typeof p.mid === 'string' && p.mid ? p.mid : inboundExternalId(e.entryId, item);
    return { ...base, kind: 'postback', mid, title: typeof p.title === 'string' ? p.title : null, data: typeof p.payload === 'string' ? p.payload : null };
  }
  if (item.reaction) {
    const r = item.reaction as Record<string, any>;
    if (typeof r.mid !== 'string') return { kind: 'ignored', reason: 'reaction_without_mid' };
    const removed = r.action === 'unreact';
    const value = String(r.reaction ?? r.emoji ?? '');
    return { ...base, kind: 'reaction', mid: r.mid, reaction: removed ? null : NEGATIVE.has(value) || NEGATIVE.has(String(r.emoji ?? '')) ? 'dislike' : 'like' };
  }
  if (item.read) return { ...base, kind: 'read', watermark: typeof item.read.watermark === 'number' ? item.read.watermark : null };
  if (item.delivery) return { ...base, kind: 'delivery', mids: Array.isArray(item.delivery.mids) ? item.delivery.mids.map(String) : [] };
  return { kind: 'ignored', reason: 'unhandled_event' };
};

/**
 * Short text of a message for the inbox list (≤ 140 characters). A message without text gives a bracket token of its
 * type (`[image]`, `[audio]`, …) that clients translate; it is never shown as is.
 */
export const previewOf = (m: { text: string | null; type: string }): string => (m.text ? m.text.replace(/\s+/g, ' ').trim().slice(0, 140) : `[${m.type}]`);
