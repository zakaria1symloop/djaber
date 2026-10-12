// Recommendations: stock recommendations (GDS-10 rule cards · FIG GDS-10, D18, D69) and cross-sell rules (03 §13
// REC-01…03 · FIG DLG GDS II "Règle de recommandation"). api-contract §3.5 StockRecommendationDto, §4 StockRecosQuery;
// 06 "Recommendations", §8.6. Field names = contract names. Texts are localized by the server (Accept-Language).
import { z } from 'zod';
import { Priority3Values, RecommendationSourceValues, RecommendationTypeValues, StockRecoStatusValues, StockRecoTypeValues } from '../enums';
import type { ActionDescriptor } from './common';

export type StockRecoTypeName = (typeof StockRecoTypeValues)[number];
export type StockRecoStatusName = (typeof StockRecoStatusValues)[number];
export type Priority3Name = (typeof Priority3Values)[number];
export type RecommendationTypeName = (typeof RecommendationTypeValues)[number];

/** api-contract §1.9: regenerate 1 / 10 min / workspace (429 RECO_RATE_LIMITED {retryAfter}). */
export const RECO_REGENERATE_COOLDOWN_S = 600;
/** REC-01: at most 3 recommendations per AI turn. */
export const RECO_MAX_PER_TURN = 3;
/** REC-03: a conversion counts when the product is ordered in the same conversation within 7 days of the impression. */
export const RECO_ATTRIBUTION_DAYS = 7;
export const RECO_SNOOZE_DAYS = 7;
/** Simple stock mode shows only these types (FIG GDS-10 "MODE SIMPLE": no margin / supplier cards). */
export const STOCK_RECO_SIMPLE_TYPES: readonly StockRecoTypeName[] = ['restock', 'stockout_imminent', 'agent'];
/**
 * Rule keys of the engine (FIG GDS-10 "RÈGLE : …"): one card per (rule, product / variant / supplier / agent).
 * `inventory_variance` = INV-02 "écarts inventaire > 10 % à vérifier" (raised by the validation, type `restock`).
 */
export const STOCK_RECO_RULES = {
  restock_lead_time: { type: 'restock', priority: 'high' },
  stockout_variant: { type: 'stockout_imminent', priority: 'high' },
  dead_stock: { type: 'promote', priority: 'medium' },
  margin_below_target: { type: 'price', priority: 'medium' },
  supplier_late: { type: 'supplier', priority: 'low' },
  agent_unknown_product: { type: 'agent', priority: 'low' },
  inventory_variance: { type: 'restock', priority: 'medium' },
} as const satisfies Record<string, { type: StockRecoTypeName; priority: Priority3Name }>;
export type StockRecoRuleKey = keyof typeof STOCK_RECO_RULES;
/** `suggestedAction.kind` (05 §StockRecommendation) → the web route it opens. */
export const STOCK_RECO_ACTIONS = ['create_purchase', 'create_promo', 'update_price', 'open_supplier', 'open_insights', 'open_product'] as const;
export type StockRecoActionKind = (typeof STOCK_RECO_ACTIONS)[number];

const id = z.string({ required_error: 'validation.required', invalid_type_error: 'validation.id' }).uuid('validation.id');
const csv = <T extends z.ZodTypeAny>(item: T) => z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(item));
const flag = z.preprocess((v) => (v === 'true' || v === '1' || v === true ? true : v === 'false' || v === '0' || v === false ? false : v), z.boolean());
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' ? null : v), schema.nullable().optional());

// --- stock recommendations (GDS-10) -------------------------------------------------------------------------------------
export const StockRecosQuerySchema = z
  .object({
    type: csv(z.enum(StockRecoTypeValues)).optional(),
    priority: csv(z.enum(Priority3Values)).optional(),
    /** default `active` (snoozed cards whose date passed come back as active) */
    status: z.enum(StockRecoStatusValues).optional(),
    categoryId: id.optional(),
    productId: id.optional(),
  })
  .strict();
export type StockRecosQuery = z.infer<typeof StockRecosQuerySchema>;
export const StockRecoHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .refine((n) => n === 25 || n === 50 || n === 100, 'validation.range')
      .default(25),
    status: csv(z.enum(['applied', 'dismissed', 'expired'])).optional(),
    type: csv(z.enum(StockRecoTypeValues)).optional(),
  })
  .strict();
export type StockRecoHistoryQuery = z.infer<typeof StockRecoHistoryQuerySchema>;
/** `POST /stock-recommendations/:id/apply { refType?, refId? }` — the card turns APPLIQUÉE, linked to what it created. */
export const ApplyStockRecoSchema = z.object({ refType: emptyToNull(z.enum(['purchase', 'product', 'promo', 'supplier', 'insight'])), refId: emptyToNull(id) }).strict();
export type ApplyStockRecoInput = z.infer<typeof ApplyStockRecoSchema>;
/** `POST /stock-recommendations/:id/snooze { days }` — "Rappeler dans 7 j". */
export const SnoozeStockRecoSchema = z.object({ days: z.number().int().min(1, 'validation.range').max(90, 'validation.range').default(RECO_SNOOZE_DAYS) }).strict();
export type SnoozeStockRecoInput = z.infer<typeof SnoozeStockRecoSchema>;
/** `POST /stock-recommendations/mute { productId, type }` — "Désactiver cette règle pour ce produit"; `DELETE` unmutes. */
export const MuteStockRecoSchema = z.object({ productId: id, type: z.enum(StockRecoTypeValues) }).strict();
export type MuteStockRecoInput = z.infer<typeof MuteStockRecoSchema>;

export type StockRecoProductRef = { id: string; name: string; sku: string; price: number; primaryImageUrl: string | null; hasVariants: boolean; trackStock: boolean; variant: { id: string; name: string } | null };
export type StockRecommendationView = {
  id: string;
  type: StockRecoTypeName;
  priority: Priority3Name;
  status: StockRecoStatusName;
  /** localized card title (product / supplier / agent name) */
  title: string;
  /** localized explanation ("Stock 12 · ventes 64 / 30 j → rupture dans ~5 jours…") */
  body: string;
  /** rule key + its localized label ("STOCK / VITESSE < DÉLAI FOURNISSEUR") */
  rule: string;
  ruleLabel: string;
  suggestedAction: { kind: StockRecoActionKind; label: string; params: Record<string, unknown> };
  product: StockRecoProductRef | null;
  supplier: { id: string; name: string } | null;
  agent: { id: string; name: string; status: 'draft' | 'active' | 'paused' } | null;
  estimatedValue: number | null;
  generatedAt: string;
  snoozedUntil: string | null;
  appliedAt: string | null;
  applied: { refType: string; refId: string | null } | null;
  dismissedAt: string | null;
  actions: ActionDescriptor[];
};
/** `[FIG GDS-10 KPIs + tabs]` */
export type StockRecoStatsView = {
  active: number;
  highPriority: number;
  byType: Record<StockRecoTypeName, number>;
  restock: { count: number; estimatedValue: number };
  /** dormant stock > 60 d (promote cards) */
  promote: { count: number };
  /** last 30 d: applied / (applied + dismissed + expired) */
  last30d: { applied: number; dismissed: number; expired: number; applicationRatePct: number | null };
  lastRun: { jobId: string | null; at: string | null; status: string | null; productsAnalyzed: number | null };
  /** seconds before `POST /stock-recommendations/generate` is accepted again (0 = now) */
  regenerateAvailableIn: number;
};

// --- cross-sell rules (REC-01…03) -------------------------------------------------------------------------------------
/** `POST /recommendations` — manual rule (409 CONFLICT when the pair + type exists; same product ⇒ 422 `fields.recommendedId`). */
export const CreateRecommendationSchema = z
  .object({
    productId: id,
    recommendedId: id,
    type: z.enum(RecommendationTypeValues).default('cross_sell'),
    score: z.number().int().min(0, 'validation.range').max(100, 'validation.range').default(50),
    reason: emptyToNull(z.string().trim().max(500, 'validation.length')),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.productId === v.recommendedId) ctx.addIssue({ code: 'custom', path: ['recommendedId'], message: 'validation.invalid' });
  });
export type CreateRecommendationInput = z.infer<typeof CreateRecommendationSchema>;
/** `PATCH /recommendations/:id` — a rule-generated pair edited by a person becomes `source=manual` (kept by the next run). */
export const UpdateRecommendationSchema = z
  .object({
    type: z.enum(RecommendationTypeValues).optional(),
    score: z.number().int().min(0, 'validation.range').max(100, 'validation.range').optional(),
    reason: emptyToNull(z.string().trim().max(500, 'validation.length')),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateRecommendationInput = z.infer<typeof UpdateRecommendationSchema>;
export const RecommendationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .refine((n) => n === 25 || n === 50 || n === 100, 'validation.range')
      .default(25),
    sort: z
      .string()
      .regex(/^-?[a-zA-Z]+$/)
      .optional(),
    productId: id.optional(),
    type: csv(z.enum(RecommendationTypeValues)).optional(),
    source: csv(z.enum(RecommendationSourceValues)).optional(),
    isActive: flag.optional(),
    q: z.string().trim().max(120, 'validation.length').optional(),
  })
  .strict();
export type RecommendationsQuery = z.infer<typeof RecommendationsQuerySchema>;
export const RECOMMENDATION_SORTS = ['score', 'impressions', 'conversions', 'revenue', 'createdAt'] as const;

type RecoProductRef = { id: string; name: string; sku: string; price: number; primaryImageUrl: string | null; isActive: boolean; archived: boolean };
export type RecommendationView = {
  id: string;
  product: RecoProductRef;
  recommended: RecoProductRef;
  type: RecommendationTypeName;
  score: number;
  reason: string | null;
  source: (typeof RecommendationSourceValues)[number];
  isActive: boolean;
  impressions: number;
  conversions: number;
  /** conversions / impressions, one decimal (null without impressions) */
  conversionRatePct: number | null;
  revenue: number;
  createdAt: string;
  updatedAt: string;
  actions: ActionDescriptor[];
};
export type RecommendationStatsView = {
  rules: number;
  active: number;
  manual: number;
  generated: number;
  impressions30d: number;
  conversions30d: number;
  conversionRatePct30d: number | null;
  revenue30d: number;
  lastRun: { jobId: string | null; at: string | null; status: string | null; created: number | null; removed: number | null };
};
/** `Job.result` of `POST /recommendations/generate` and of `POST /stock-recommendations/generate`. */
export type RecommendationsJobResult = { kind: 'cross_sell' | 'stock'; productsAnalyzed: number; created: number; updated: number; removed: number; expired?: number };
