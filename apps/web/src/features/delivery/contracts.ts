// Wire types of the M5 delivery endpoints used by the web (geo, fee grid, quote, stop-desks) = the shared read models
// of `packages/shared/src/schemas/delivery.ts` (api-contract §3.8).
import type { CommuneView, FeeGridMeta, FeeQuoteView, FeeRuleView, StopdeskView, UpdateFeeRuleInput, WilayaView } from '@djaber/shared';

export type Wilaya = WilayaView;
export type Commune = CommuneView;
export type Stopdesk = StopdeskView;
export type FeeRule = FeeRuleView;
export type FeeRuleInput = UpdateFeeRuleInput;
export type FeeQuote = FeeQuoteView;
export type { FeeGridMeta };
export const WILAYA_COUNT = 58;
