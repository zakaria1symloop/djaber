// Wire types of the credits module: the read models of `@djaber/shared` (`schemas/agents.ts`, api-contract §3.10,
// 02 §6, 04-ai-pipeline §7) under the names the screens use.
import type { CreditAction, CreditLedgerRowDto, CreditsDto, CreditsUpdatedEvent, LedgerQuery } from '@djaber/shared';
import { CreditActionValues } from '@djaber/shared';

export type { LedgerQuery };
export type Credits = CreditsDto;
export type LedgerRow = CreditLedgerRowDto;
export type LedgerAction = CreditAction;
export type Bucket = LedgerRow['bucket'];
/** WS `credits.updated` (03-events §2) */
export type WsCreditsUpdated = Partial<CreditsUpdatedEvent>;
/** `GET /credits/ledger` → `{ data: LedgerRow[], meta: { page, pageSize, total } }` */
export type LedgerPage = { rows: LedgerRow[]; total: number };

export const LEDGER_ACTIONS: readonly LedgerAction[] = CreditActionValues;
/** Actions offered by the filter: the reserve / release pair of a run is bookkeeping, shown in the table only. */
export const FILTER_ACTIONS: LedgerAction[] = ['text_reply', 'image_recognition', 'voice_transcription', 'renewal', 'pack_purchase', 'grant', 'store_refund', 'adjustment'];
export const BUCKETS: Bucket[] = ['plan', 'pack'];
