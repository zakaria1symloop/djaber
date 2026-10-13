// Merchant help center & support tickets (03 §25 HELP-01…06, D38, D46; 06 §8.4; api-contract §3.11) and the public status
// page data (03 §27 OPS-06, 06 §12, api-contract §3.14 StatusPageDto). One source for the API and the web.
import { z } from 'zod';
import { LocaleValues, TicketCategoryValues, TicketStatusValues } from '../enums';
import type { InboxUserRef } from './inbox';
import type { TicketMessageView } from './admin-ops';

const id = z.string({ required_error: 'validation.required', invalid_type_error: 'validation.id' }).uuid('validation.id');
const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(item));
const pageSize = z.coerce.number().refine((n) => n === 25 || n === 50 || n === 100, 'validation.range').default(25);

/** HELP-03: message ≥ 20 characters; attachments (screenshots, CSV) ≤ 5; operators cannot pick `billing` (403 FORBIDDEN). */
export const TICKET_MESSAGE_MIN = 20;
export const TICKET_ATTACHMENTS_MAX = 5;
/** HELP-05: SLA per plan (business hours Sun–Thu 09:00–18:00 Africa/Algiers); unknown plans use the free value. */
export const TICKET_SLA_HOURS: Record<string, number> = { pro: 1, agence: 1, starter: 4, free: 24 };
/** HELP-05: a resolved ticket is closed by the daily job 30 days after `resolvedAt`. */
export const TICKET_AUTO_CLOSE_DAYS = 30;
/** HELP-01: the 8 categories of the help center (`CmsEntry(type=help).category`). */
export const HELP_CATEGORIES = ['getting_started', 'pages_instagram', 'ai_agent', 'orders_delivery', 'stock', 'credits_billing', 'mobile_app', 'security_data'] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

/** `POST /support/tickets` (`support.write`, every role). `subject` defaults to the start of the message. */
export const CreateTicketSchema = z
  .object({
    category: z.enum(TicketCategoryValues),
    priority: z.enum(['normal', 'urgent']).default('normal'),
    subject: z.string().trim().min(3, 'validation.length').max(200, 'validation.length').optional(),
    message: z.string({ required_error: 'validation.required' }).trim().min(TICKET_MESSAGE_MIN, 'validation.length').max(5000, 'validation.length'),
    attachments: z.array(id).max(TICKET_ATTACHMENTS_MAX, 'validation.length').default([]),
    /** auto-context block (workspace, plan, browser / app version, current page, last error) — editable, never customer messages */
    context: z.record(z.string().max(500)).default({}),
    channel: z.enum(['web', 'mobile']).optional(),
  })
  .strict();
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export const TicketReplySchema = z
  .object({ body: z.string().trim().min(1, 'validation.required').max(5000, 'validation.length'), attachments: z.array(id).max(TICKET_ATTACHMENTS_MAX, 'validation.length').default([]) })
  .strict();
export type TicketReplyInput = z.infer<typeof TicketReplySchema>;
export const TicketRateSchema = z.object({ score: z.number({ required_error: 'validation.required' }).int().min(1, 'validation.range').max(5, 'validation.range'), note: z.string().trim().max(1000, 'validation.length').optional() }).strict();
export type TicketRateInput = z.infer<typeof TicketRateSchema>;
/** `GET /support/tickets` — Operators see their own tickets; Admin+ may ask `scope=workspace` (`support.read_all`). */
export const TicketsQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).default(1), pageSize, status: csv(z.enum(TicketStatusValues)).optional(), scope: z.enum(['mine', 'workspace']).default('mine') })
  .strict();
export type TicketsQuery = z.infer<typeof TicketsQuerySchema>;
/** `GET /help/articles?q&category&lang&context` — `context` = current page key (contextual guides of the "?" panel). */
export const HelpArticlesQuerySchema = z
  .object({ q: z.string().trim().min(2, 'validation.length').max(100).optional(), category: z.enum(HELP_CATEGORIES).optional(), lang: z.enum(LocaleValues).optional(), context: z.string().trim().max(80).optional() })
  .strict();
export type HelpArticlesQuery = z.infer<typeof HelpArticlesQuerySchema>;
export const StatusSubscribeSchema = z.object({ email: z.string().trim().toLowerCase().email('validation.email').max(254), locale: z.enum(LocaleValues).default('fr') }).strict();
export type StatusSubscribeInput = z.infer<typeof StatusSubscribeSchema>;

/** api-contract §3.11 `SupportTicketDto` (+ `satisfactionNote`, `resolvedAt`, `actions`). */
export type SupportTicketDto = {
  id: string;
  number: string;
  subject: string;
  category: (typeof TicketCategoryValues)[number];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'web' | 'mobile' | 'email' | 'chat';
  status: (typeof TicketStatusValues)[number];
  createdAt: string;
  lastMessageAt: string;
  /** a support answer is waiting for the merchant (pill RÉPONSE REÇUE) */
  awaitingMe: boolean;
  slaDueAt: string;
  satisfaction: number | null;
  satisfactionNote: string | null;
  resolvedAt: string | null;
  author: InboxUserRef;
  messages: TicketMessageView[];
  context: Record<string, string>;
};
export type CreateTicketResultDto = { id: string; number: string; slaDueAt: string };
export type HelpArticleDto = { key: string; category: string | null; locale: string; requestedLocale: string; fallback: boolean; title: string; excerpt: string; body?: string; version: number; publishedAt: string | null; contexts: string[] };
/** api-contract §3.14 `StatusPageDto` + `maintenance` (route map §1: the web banner reads it from `GET /status`). */
export type StatusPageDto = {
  overall: 'operational' | 'degraded' | 'incident';
  components: { key: string; name: string; status: 'operational' | 'degraded' | 'incident'; uptime90d: number; /** 90 Africa/Algiers days, oldest first (PUB status bars) */ days?: ('ok' | 'degraded' | 'incident')[] }[];
  incidents: { id: string; title: string; status: string; severity: string; components: string[]; startedAt: string; resolvedAt: string | null; durationMinutes: number | null; updates: { at: string; status: string; body: string }[] }[];
  banner: string | null;
  maintenance: { active: boolean; scheduledFrom: string | null; scheduledTo: string | null; scope: string; text: string | null } | null;
  updatedAt: string;
};
