// Delivery calls used in M5 (06 §2 "Delivery": geo, fee grid, quote, stop-desks) + TanStack Query hooks.
// Couriers, shipments, labels and the overview arrive with M6.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, apiRaw } from '@/lib/api';
import { useWorkspaceId } from '@/lib/session';
import type { Commune, FeeGridMeta, FeeQuote, FeeRule, FeeRuleInput, Stopdesk, Wilaya } from './contracts';

/** `GET /delivery/fees` and `POST /delivery/fees/seed` answer the whole grid (58 rows) + its counters. */
export type FeeGrid = { rows: FeeRule[]; meta: FeeGridMeta & { written?: number } };
const grid = async (p: Promise<{ data: FeeRule[]; meta: unknown }>): Promise<FeeGrid> => {
  const r = await p;
  const m = (r.meta ?? {}) as Partial<FeeGrid['meta']>;
  return { rows: r.data ?? [], meta: { freeDeliveryThreshold: m.freeDeliveryThreshold ?? null, custom: m.custom ?? 0, inactive: m.inactive ?? 0, missing: m.missing ?? 0, written: m.written } };
};

export const deliveryApi = {
  /* geo (public, cached 24 h by the API) */
  wilayas: () => api<Wilaya[]>('/geo/wilayas'),
  communes: (wilayaId: number) => api<Commune[]>(`/geo/wilayas/${wilayaId}/communes`),
  stopdesks: (q: { communeId: number; provider?: string }) => api<Stopdesk[]>('/delivery/stopdesks', { query: q }),

  /* fee grid (DLV-01/02) */
  fees: () => grid(apiRaw<FeeRule[]>('/delivery/fees')),
  saveFee: (wilayaId: number, b: FeeRuleInput) => api<FeeRule>(`/delivery/fees/${wilayaId}`, { method: 'PUT', body: b }),
  /** back to the default prices; `422 FEE_RULE_NOT_FOUND` when the row is not custom */
  resetFee: (wilayaId: number) => api<FeeRule>(`/delivery/fees/${wilayaId}`, { method: 'DELETE' }),
  /** `overwrite: false` = "Compléter les manquants", `true` = "Tout réinitialiser" */
  seedFees: (overwrite: boolean) => grid(apiRaw<FeeRule[]>('/delivery/fees/seed', { method: 'POST', body: { overwrite } })),
  quote: (q: { wilayaId: number; stopdesk: boolean; subtotal: number }) => api<FeeQuote>('/delivery/fees/quote', { query: q }),
};

export const deliveryKeys = {
  wilayas: () => ['session', 'wilayas'] as const,
  communes: (wilayaId: number) => ['session', 'communes', wilayaId] as const,
  stopdesks: (ws: string, communeId: number, provider?: string) => [ws, 'stopdesks', communeId, provider ?? ''] as const,
  fees: (ws: string) => [ws, 'delivery', 'fees'] as const,
  quote: (ws: string, q: { wilayaId: number; stopdesk: boolean; subtotal: number }) => [ws, 'delivery', 'quote', q] as const,
};

const DAY = 24 * 3600 * 1000;
/** Same cache entry as `useWilayas` of the workspace feature (reference data, one fetch per session). */
export const useGeoWilayas = () => useQuery({ queryKey: deliveryKeys.wilayas(), queryFn: deliveryApi.wilayas, staleTime: DAY });
export const useCommunes = (wilayaId: number | null | undefined) =>
  useQuery({ queryKey: deliveryKeys.communes(wilayaId ?? 0), queryFn: () => deliveryApi.communes(wilayaId!), enabled: !!wilayaId, staleTime: DAY });
export const useStopdesks = (communeId: number | null | undefined, provider?: string) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: deliveryKeys.stopdesks(ws, communeId ?? 0, provider), queryFn: () => deliveryApi.stopdesks({ communeId: communeId!, provider }), enabled: !!ws && !!communeId, staleTime: 3600 * 1000, retry: false });
};
export const useFees = (enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: deliveryKeys.fees(ws), queryFn: deliveryApi.fees, enabled: !!ws && enabled });
};
/** Fee quote of the order form / address dialog; the previous quote stays on screen while the next one loads. */
export const useFeeQuote = (q: { wilayaId: number | null; stopdesk: boolean; subtotal: number }) => {
  const ws = useWorkspaceId();
  const key = { wilayaId: q.wilayaId ?? 0, stopdesk: q.stopdesk, subtotal: q.subtotal };
  return useQuery({ queryKey: deliveryKeys.quote(ws, key), queryFn: () => deliveryApi.quote(key), enabled: !!ws && !!q.wilayaId, placeholderData: keepPreviousData, staleTime: 30_000 });
};
