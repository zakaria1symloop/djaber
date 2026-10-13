// M11 — Settings › Intégrations: API keys (03 §18 API-01/02, 06 §5 / §8.10), outbound webhooks (API-03, 06 §4,
// api-contract §6, 03-events §6) and Google Sheets (03 §22 GSH-01…08, 05-integrations §3). One source for the API, the web
// and the published OpenAPI document. Permission of every route: `integrations.manage` (Owner + Admin, 06 §9); the
// webhook routes are also reachable with an API key holding `webhooks:manage` (06 §5).
import { z } from 'zod';
import { ApiKeyEnvironmentValues, OrderSourceValues, SheetsStatusValues, WebhookDeliveryStatusValues } from '../enums';
import type { ActionDescriptor } from './common';

const id = z.string({ required_error: 'validation.required', invalid_type_error: 'validation.id' }).uuid('validation.id');
const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(item));
const pageSize = z.coerce.number().refine((n) => n === 25 || n === 50 || n === 100, 'validation.range').default(25);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date');

// --- API keys (API-01 / API-02) ------------------------------------------------------------------------------------------
/** 06 §5 — the only scopes; every route without one of them answers `403 API_SCOPE_FORBIDDEN` to an API key. */
export const API_SCOPES = [
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'conversations:read',
  'conversations:reply',
  'delivery:read',
  'analytics:read',
  'webhooks:manage',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];
/** api-contract §1.9: 600 requests / min / key (`X-RateLimit-Limit/Remaining/Reset` headers). */
export const API_KEY_RATE_LIMIT_PER_MIN = 600;
/** Characters of the key shown in the UI after `dj_live_` / `dj_test_` (api-contract §1.2: "prefix 8 chars"). */
export const API_KEY_PREFIX_CHARS = 8;

/** `POST /api-keys { name, scopes[], environment }` → `ApiKeyCreatedDto` (the full key is returned once). */
export const CreateApiKeySchema = z
  .object({
    name: z.string({ required_error: 'validation.required' }).trim().min(1, 'validation.required').max(80, 'validation.length'),
    scopes: z
      .array(z.enum(API_SCOPES, { errorMap: () => ({ message: 'validation.invalid' }) }))
      .min(1, 'validation.required')
      .max(API_SCOPES.length)
      .transform((s) => [...new Set(s)]),
    environment: z.enum(ApiKeyEnvironmentValues).default('live'),
  })
  .strict();
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

export type ApiKeyDto = {
  id: string;
  name: string;
  environment: 'live' | 'test';
  /** `dj_live_8f2a1b3c` — what the list shows ("ERP interne · dj_live_8f2a…") */
  prefix: string;
  scopes: ApiScope[];
  status: 'active' | 'revoked';
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revokedAt: string | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  /** `revoke` (disabled `CONFLICT` once revoked) */
  actions: ActionDescriptor[];
};
/** The full key (`dj_live_<43 chars>`) is in this response only; only its SHA-256 is stored. */
export type ApiKeyCreatedDto = ApiKeyDto & { key: string };
/** `GET /api-keys` — keys newest first + plan allowance (`Plan.maxApiKeys`, -1 = unlimited; feature `api_keys`). */
export type ApiKeysOverviewDto = {
  keys: ApiKeyDto[];
  /** active keys counted against the plan */
  used: number;
  limit: number;
  /** false ⇒ the plan has no `api_keys` feature: "Créer une clé" disabled with `PLAN_FEATURE_REQUIRED` */
  featureEnabled: boolean;
  rateLimitPerMinute: number;
  scopes: readonly ApiScope[];
  /** `create` action of the card */
  actions: ActionDescriptor[];
};

// --- Outbound webhooks (API-03) ----------------------------------------------------------------------------------------
/** 06 §4 + api-contract §6 (+ `product.updated` of the Figma dialog). `ping` is sent by "Tester" only. */
export const WEBHOOK_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.returned',
  'stock.low',
  'stock.out',
  'product.updated',
  'product.moderation_changed',
  'customer.new',
  'customer.blocked',
  'payment.failed',
  'conversation.escalated',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
/** 06 §4: retries after 1 min, 5 min, 30 min, 2 h, 12 h, 24 h ⇒ at most 7 attempts per delivery (1 + 6 retries). */
export const WEBHOOK_RETRY_DELAYS_S = [60, 300, 1_800, 7_200, 43_200, 86_400] as const;
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_S.length + 1;
/** API-03: the endpoint is disabled after 50 consecutive failed attempts (+ `webhook.disabled` notification). */
export const WEBHOOK_DISABLE_AFTER = 50;
/** 03-events §6: 5 s per attempt; 2xx = delivered. Receivers must reject `|now − t| > 300 s`. */
export const WEBHOOK_TIMEOUT_MS = 5_000;
export const WEBHOOK_SIGNATURE_TOLERANCE_S = 300;
/** 03-events §4 `sched-retention`: deliveries are kept 30 days. */
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30;

const webhookUrl = z
  .string({ required_error: 'validation.required' })
  .trim()
  .max(2048, 'validation.length')
  .url('validation.url_https');
const webhookEvents = z
  .array(z.enum(WEBHOOK_EVENTS, { errorMap: () => ({ message: 'validation.invalid' }) }))
  .min(1, 'validation.required')
  .transform((s) => [...new Set(s)]);

/**
 * `POST /webhooks { url, events[] }` → `WebhookCreatedDto` (secret shown once). Production accepts `https://` public hosts
 * only (`422 WEBHOOK_URL_INVALID`); development / test also accept `http://` and local hosts (test receivers).
 */
export const CreateWebhookSchema = z.object({ url: webhookUrl, events: webhookEvents }).strict();
export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
/** `PATCH /webhooks/:id { url?, events? }` */
export const UpdateWebhookSchema = z.object({ url: webhookUrl.optional(), events: webhookEvents.optional() }).strict();
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;

export type WebhookEndpointDto = {
  id: string;
  url: string;
  events: WebhookEvent[];
  status: 'active' | 'disabled';
  isActive: boolean;
  /** consecutive failed attempts (reset by a success or by "Réactiver") */
  failureCount: number;
  disableAfter: number;
  disabledAt: string | null;
  /** `WEBHOOK_ENDPOINT_DISABLED` when auto-disabled; the banner reads the last response code from `lastFailure` */
  disabledReason: string | null;
  lastFailure: { responseCode: number | null; error: string | null; at: string } | null;
  lastDeliveryAt: string | null;
  secretRotatedAt: string | null;
  /** `whsec_…a1b2` — last 4 characters only */
  secretHint: string;
  createdAt: string;
  updatedAt: string;
  /** `test`, `edit`, `rotate_secret`, `enable` (enabled only while disabled), `deliveries`, `delete` */
  actions: ActionDescriptor[];
};
/** `POST /webhooks` and `POST /webhooks/:id/rotate-secret`: the signing secret (`whsec_…`) is in this response only. */
export type WebhookCreatedDto = WebhookEndpointDto & { secret: string };
export type WebhooksOverviewDto = {
  endpoints: WebhookEndpointDto[];
  used: number;
  limit: number;
  featureEnabled: boolean;
  events: readonly WebhookEvent[];
  maxAttempts: number;
  retryDelaysSeconds: readonly number[];
  actions: ActionDescriptor[];
};

/** `GET /webhooks/:id/deliveries?status&event&page&pageSize` (newest first) and `GET /webhooks/deliveries?…` (all endpoints). */
export const WebhookDeliveriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize,
    status: csv(z.enum(WebhookDeliveryStatusValues)).optional(),
    event: csv(z.string().trim().max(60)).optional(),
    endpointId: id.optional(),
  })
  .strict();
export type WebhookDeliveriesQuery = z.infer<typeof WebhookDeliveriesQuerySchema>;

export type WebhookDeliveryDto = {
  id: string;
  endpointId: string;
  endpointUrl: string;
  event: string;
  /** one-line label of the log: `#CMD-1042`, product name, client name… (null when the payload has nothing to show) */
  summary: string | null;
  /** pending = first attempt not made yet / retry scheduled; success; failed = last attempt failed and no retry pending; exhausted = 7 attempts used */
  status: 'pending' | 'success' | 'failed' | 'exhausted';
  attempt: number;
  maxAttempts: number;
  responseCode: number | null;
  durationMs: number | null;
  error: string | null;
  nextAttemptAt: string | null;
  replayOfId: string | null;
  createdAt: string;
  /** the exact JSON body sent (`{ id, event, createdAt, workspaceId, data }`) — detail drawer */
  payload: unknown;
  actions: ActionDescriptor[];
};

// --- Google Sheets (GSH) -------------------------------------------------------------------------------------------------
/** GSH-03 / 05-integrations §3: fixed columns A…R of the `Commandes` tab (R = hidden `djaber_id`). */
export const SHEETS_COLUMNS = ['number', 'date', 'channel', 'client', 'phone', 'wilaya', 'commune', 'address', 'items', 'subtotal', 'fee', 'total', 'method', 'status', 'courier', 'tracking', 'source', 'djaber_id'] as const;
export type SheetsColumn = (typeof SHEETS_COLUMNS)[number];
/** Header row per workspace locale (05-integrations §3 table). */
export const SHEETS_HEADERS: Record<'fr' | 'ar' | 'en', readonly string[]> = {
  fr: ['Numéro', 'Date', 'Canal', 'Client', 'Téléphone', 'Wilaya', 'Commune', 'Adresse', 'Articles', 'Sous-total', 'Frais', 'Total', 'Mode', 'Statut', 'Transporteur', 'Suivi', 'Source', 'djaber_id'],
  ar: ['الرقم', 'التاريخ', 'القناة', 'العميل', 'الهاتف', 'الولاية', 'البلدية', 'العنوان', 'المنتجات', 'المجموع الفرعي', 'التوصيل', 'الإجمالي', 'طريقة الدفع', 'الحالة', 'الناقل', 'التتبع', 'المصدر', 'djaber_id'],
  en: ['Number', 'Date', 'Channel', 'Client', 'Phone', 'Wilaya', 'Commune', 'Address', 'Items', 'Subtotal', 'Delivery fee', 'Total', 'Method', 'Status', 'Courier', 'Tracking', 'Source', 'djaber_id'],
};
export const SHEETS_DEFAULT_TAB = 'Commandes';
/** GSH-04: an order change is written 5 s after the last change of that order. */
export const SHEETS_DEBOUNCE_MS = 5_000;
/** `https://docs.google.com/spreadsheets/d/<id>/…` (05-integrations §3, "pasted URL"). */
export const SPREADSHEET_URL_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/;

/** GSH-06: rows written only for orders of these channels / sources (empty = all). */
export const SheetsFiltersSchema = z
  .object({
    channelIds: z.array(id).max(50).default([]),
    sources: z.array(z.enum(OrderSourceValues)).max(OrderSourceValues.length).default([]),
  })
  .strict();
export type SheetsFilters = z.infer<typeof SheetsFiltersSchema>;

/**
 * `PUT /integrations/google-sheets` — choose the sheet (exactly one of `spreadsheetId` from the Picker, `spreadsheetUrl`
 * pasted, `createNew: true`) and/or change the filters. Sending only `filters` keeps the chosen sheet.
 * Errors: `SHEETS_NOT_CONNECTED` (no Google consent yet), `SHEETS_SPREADSHEET_NOT_FOUND` (404/403 from Google),
 * `SHEETS_TOKEN_REVOKED`, `VALIDATION_ERROR` (`fields.spreadsheetUrl = validation.url`, or two sources given).
 */
export const PutSheetsSchema = z
  .object({
    spreadsheetId: z.string().trim().regex(/^[a-zA-Z0-9-_]{20,}$/, 'validation.invalid').optional(),
    spreadsheetUrl: z.string().trim().regex(SPREADSHEET_URL_RE, 'validation.invalid').optional(),
    createNew: z.literal(true).optional(),
    sheetName: z.string().trim().min(1, 'validation.required').max(100, 'validation.length').default(SHEETS_DEFAULT_TAB),
    filters: SheetsFiltersSchema.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const n = [v.spreadsheetId, v.spreadsheetUrl, v.createNew].filter((x) => x !== undefined).length;
    if (n > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spreadsheetId'], message: 'validation.invalid' });
  });
export type PutSheetsInput = z.infer<typeof PutSheetsSchema>;

/** `POST /integrations/google-sheets/backfill { from, to }` (YYYY-MM-DD, Africa/Algiers, `to` inclusive, ≤ 732 days) → 202 `{ jobId }`. */
export const SheetsBackfillSchema = z
  .object({ from: day, to: day })
  .strict()
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'validation.range' });
export type SheetsBackfillInput = z.infer<typeof SheetsBackfillSchema>;

/** `GET /integrations/google-sheets/connect?returnTo=` → `{ url }` (Google consent, or the simulated consent page when SHEETS_DRIVER=fake). */
export const SheetsConnectQuerySchema = z.object({ returnTo: z.string().trim().max(300).regex(/^\/[^/]/, 'validation.invalid').optional() }).strict();
export type SheetsConnectQuery = z.infer<typeof SheetsConnectQuerySchema>;

/**
 * UI state of the Sheets card (SET Integrations): `not_connected` · `pick_sheet` (Google consent given, no sheet yet) ·
 * `active` · `error` (`lastError` ∈ SHEETS_TOKEN_REVOKED | SHEETS_SPREADSHEET_NOT_FOUND | SHEETS_QUOTA | INTERNAL).
 */
export type SheetsState = 'not_connected' | 'pick_sheet' | 'active' | 'error';
export type SheetsIntegrationDto = {
  state: SheetsState;
  status: (typeof SheetsStatusValues)[number] | null;
  /** `fake` = simulated Google (dev / test): the consent page and the sheets live in the API's local storage */
  driver: 'fake' | 'google';
  /** plan feature `google_sheets` */
  featureEnabled: boolean;
  /** GOOGLE_OAUTH_VERIFIED=false ⇒ notice "≤ 100 utilisateurs test" (05-integrations §3) */
  verificationPending: boolean;
  googleEmail: string | null;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  spreadsheetUrl: string | null;
  sheetName: string;
  filters: SheetsFilters;
  /** header labels in the workspace locale (A…Q; R `djaber_id` hidden) */
  columns: string[];
  lastSyncAt: string | null;
  lastError: { code: string; message: string } | null;
  rowsSynced: number;
  backfill: { jobId: string; status: string; progress: number } | null;
  connectedAt: string | null;
  /** `connect`, `change_sheet`, `edit_filters`, `backfill`, `disconnect`, `reconnect` */
  actions: ActionDescriptor[];
};
/** `GET /integrations/google-sheets/status` — light poll of the card (sync health, GSH-07). */
export type SheetsStatusDto = Pick<SheetsIntegrationDto, 'state' | 'status' | 'lastSyncAt' | 'lastError' | 'rowsSynced'> & { pendingRows: number };
/**
 * `POST /integrations/google-sheets/picker-token` → short-lived token for the Google Picker (scope `drive.file`).
 * With the simulated Google (`driver: 'fake'`) `files` lists the simulated spreadsheets to pick from (no Picker script).
 */
export type SheetsPickerTokenDto = {
  driver: 'fake' | 'google';
  accessToken: string;
  expiresAt: string;
  developerKey: string | null;
  appId: string | null;
  files: { id: string; name: string }[];
};
