// Wire types of the billing module: the read models of `@djaber/shared` (`schemas/billing.ts`, api-contract §3.10,
// 06 "Billing & credits") under the names the screens use.
import type {
  BillingCycleName,
  BillingInfoDto,
  BillingInfoInput,
  CheckoutInput,
  CheckoutPreviewDto,
  CheckoutResultDto,
  CheckoutReturnDto,
  CreditPackDto,
  CreditsCalculatorDto,
  DunningStageName,
  InvoiceDto,
  InvoiceStatusName,
  OrderPaymentLinkDto,
  PackCheckoutResultDto,
  PausedResourceView,
  PayInvoiceResultDto,
  PlanPublicDto,
  PromoCheckDto,
  PromoRedeemDto,
  SubscriptionDto,
  SubscriptionStatusName,
} from '@djaber/shared';

export type Cycle = BillingCycleName;
export type SubscriptionStatus = SubscriptionStatusName;
export type DunningStage = DunningStageName;
export type InvoiceStatus = InvoiceStatusName;
export type Plan = PlanPublicDto;
export type PausedResource = PausedResourceView;
export type Subscription = SubscriptionDto;
export type CheckoutPreview = CheckoutPreviewDto;
export type CheckoutBody = CheckoutInput;
export type CheckoutResult = CheckoutResultDto;
export type Invoice = InvoiceDto;
/** `GET /billing/invoices` → `{ data: Invoice[], meta: { page, pageSize, total } }` */
export type InvoicePage = { rows: Invoice[]; total: number };
export type BillingInfo = BillingInfoDto;
export type BillingInfoBody = BillingInfoInput;
export type CheckoutReturn = CheckoutReturnDto;
export type PromoValidation = PromoCheckDto;
export type PromoRedeem = PromoRedeemDto;
export type CreditPack = CreditPackDto;
export type PackCheckoutResult = PackCheckoutResultDto;
export type PayInvoiceResult = PayInvoiceResultDto;
export type Calculator = CreditsCalculatorDto;
export type PaymentLink = OrderPaymentLinkDto;
export type SubscriptionAction = SubscriptionDto['actions'][number];
