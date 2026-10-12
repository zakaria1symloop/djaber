// Wire types of the GDS operations endpoints used by the web (suppliers, purchases, sales, cash register, inventory
// counts, stock recommendations, cross-sell rules, movement / product KPIs) = the shared read models of
// `packages/shared/src/schemas/gds.ts` and `recommendations.ts` (api-contract §3.9, §3.5, §4). Web names are short
// aliases of the shared `…View` names.
import type {
  CashCategoryName,
  CashDayView,
  CashMethodName,
  CashStatsView,
  CashTransactionView,
  CashTypeName,
  CloseCashInput,
  CreateCashEntryInput,
  CreatePurchaseInput,
  CreateRecommendationInput,
  CreateSaleInput,
  CreateSupplierInput,
  GdsPaymentInput,
  GdsPaymentStatusName,
  InventoryLineView,
  InventoryLinesInput,
  InventoryListItemView,
  InventoryScopeName,
  InventoryScopePreviewView,
  InventoryStatusName,
  InventoryView,
  MovementStatsView,
  PaymentEntryView,
  Priority3Name,
  ProductStatsView,
  PurchaseItemView,
  PurchaseListItemView,
  PurchaseStatsView,
  PurchaseStatusName,
  PurchaseView,
  ReceivePurchaseInput,
  RecommendationStatsView,
  RecommendationsJobResult,
  RecommendationView,
  SaleItemView,
  SaleListItemView,
  SaleStatsView,
  SaleStatusName,
  SaleView,
  StartInventoryInput,
  StockPurchasingView,
  StockRecommendationView,
  StockRecoStatsView,
  StockRecoTypeName,
  SupplierListItemView,
  SupplierPaymentInput,
  SupplierView,
  UpdateCashEntryInput,
  UpdatePurchaseInput,
  UpdateRecommendationInput,
  UpdateSaleInput,
  UpdateSupplierInput,
} from '@djaber/shared';
import type { Meta } from '@/lib/api';

export type Supplier = SupplierView;
export type SupplierRow = SupplierListItemView;
export type SupplierInput = CreateSupplierInput;
export type SupplierPatch = UpdateSupplierInput;
export type SupplierPayment = SupplierPaymentInput;

export type Purchase = PurchaseView;
export type PurchaseRow = PurchaseListItemView;
export type PurchaseItem = PurchaseItemView;
export type PurchaseStats = PurchaseStatsView;
export type PurchaseStatus = PurchaseStatusName;
export type PurchaseInput = CreatePurchaseInput;
export type PurchasePatch = UpdatePurchaseInput;
export type ReceiveInput = ReceivePurchaseInput;
export type PaymentInput = GdsPaymentInput;
export type PaymentEntry = PaymentEntryView;
export type GdsPaymentStatus = GdsPaymentStatusName;

export type Sale = SaleView;
export type SaleRow = SaleListItemView;
export type SaleItem = SaleItemView;
export type SaleStats = SaleStatsView;
export type SaleStatus = SaleStatusName;
export type SaleInput = CreateSaleInput;
export type SalePatch = UpdateSaleInput;

export type CashRow = CashTransactionView;
export type CashStats = CashStatsView;
export type CashDay = CashDayView;
export type CashCategory = CashCategoryName;
export type CashMethod = CashMethodName;
export type CashType = CashTypeName;
export type CashEntryInput = CreateCashEntryInput;
export type CashEntryPatch = UpdateCashEntryInput;
export type CloseCashInputT = CloseCashInput;

export type Inventory = InventoryView;
export type InventoryRow = InventoryListItemView;
export type InventoryLine = InventoryLineView;
export type InventoryScope = InventoryScopeName;
export type InventoryStatus = InventoryStatusName;
export type InventoryScopePreview = InventoryScopePreviewView;
export type InventoryStartInput = StartInventoryInput;
export type InventoryLinesBody = InventoryLinesInput;

export type StockReco = StockRecommendationView;
export type StockRecoStats = StockRecoStatsView;
export type StockRecoType = StockRecoTypeName;
export type RecoPriority = Priority3Name;
export type CrossSellRule = RecommendationView;
export type CrossSellStats = RecommendationStatsView;
export type CrossSellInput = CreateRecommendationInput;
export type CrossSellPatch = UpdateRecommendationInput;
export type RecoJobResult = RecommendationsJobResult;

export type MovementStats = MovementStatsView;
export type ProductStats = ProductStatsView;
export type StockPurchasing = StockPurchasingView;

export type GdsPage<T> = { rows: T[]; total: number; meta: Meta };
/** `GET /cash` meta: the opening balance of the selection and its first / last day. */
export type CashPage = GdsPage<CashRow> & { openingBalance: number | null; from: string | null; to: string | null };
/** signed PDF of `GET /purchases/:id/print`, `/sales/:id/receipt`, `/inventories/:id/sheet` */
export type SignedFile = { url: string; fileName: string; size: number; expiresAt: string };

/* ---------- local copies of the shared constants (same values) ---------- */
export const PURCHASE_STATUSES = ['draft', 'pending', 'partial', 'received', 'cancelled'] as const satisfies readonly PurchaseStatus[];
export const GDS_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const satisfies readonly GdsPaymentStatus[];
export const SALE_STATUSES = ['draft', 'completed', 'cancelled'] as const satisfies readonly SaleStatus[];
export const PAYMENT_METHODS = ['cash', 'ccp', 'card', 'transfer', 'other'] as const satisfies readonly CashMethod[];
export const CASH_CATEGORIES = ['sale', 'order', 'purchase', 'rent', 'salary', 'utilities', 'marketing', 'shipping', 'deposit', 'withdrawal', 'correction', 'refund', 'other'] as const satisfies readonly CashCategory[];
/** manual categories offered by the dialog per direction (CSH-03): in = apport / autre recette; out = frais / retrait / salaire */
export const CASH_MANUAL_IN = ['deposit', 'other'] as const satisfies readonly CashCategory[];
export const CASH_MANUAL_OUT = ['shipping', 'rent', 'salary', 'utilities', 'marketing', 'withdrawal', 'other'] as const satisfies readonly CashCategory[];
export const INVENTORY_SCOPES = ['all', 'category', 'alerts_only'] as const satisfies readonly InventoryScope[];
export const INVENTORY_STATUSES = ['draft', 'counting', 'validated', 'cancelled'] as const satisfies readonly InventoryStatus[];
export const STOCK_RECO_TYPES = ['restock', 'promote', 'price', 'stockout_imminent', 'supplier', 'agent'] as const satisfies readonly StockRecoType[];
export const RECO_PRIORITIES = ['high', 'medium', 'low'] as const satisfies readonly RecoPriority[];
export const GDS_PERIOD_KEYS = ['today', '7d', '30d', 'month', 'last_month', '90d', 'year'] as const;
export type GdsPeriodKey = (typeof GDS_PERIOD_KEYS)[number];
