// Credits calls (06 "Billing & credits", api-contract §3.10) + TanStack Query hooks and cache keys.
// M4 is read-only: the balance and the ledger. Packs, calculator and export arrive with billing (M9).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, apiRaw } from '@/lib/api';
import type { ApiQuery } from '@/lib/list-state';
import { useSession, useWorkspaceId } from '@/lib/session';
import type { Credits, LedgerPage, LedgerRow } from './contracts';

export const creditsApi = {
  get: () => api<Credits>('/credits'),
  ledger: async (q: ApiQuery): Promise<LedgerPage> => {
    const r = await apiRaw<LedgerRow[]>('/credits/ledger', { query: q });
    const rows = Array.isArray(r.data) ? r.data : [];
    return { rows, total: r.meta?.total ?? rows.length };
  },
  // M9: GET /credits/ledger/export, GET /credits/calculator, GET /credit-packs, POST /credits/packs/checkout
};

export const creditKeys = {
  all: (ws: string) => [ws, 'credits'] as const,
  balance: (ws: string) => [ws, 'credits', 'balance'] as const,
  ledger: (ws: string, q?: ApiQuery) => (q ? ([ws, 'credits', 'ledger', q] as const) : ([ws, 'credits', 'ledger'] as const)),
};

/** The balance: every member may read it (`billing.read_credits`); kept fresh by WS `credits.updated`. */
export const useCredits = (enabled = true) => {
  const ws = useWorkspaceId();
  const { can, workspace } = useSession();
  return useQuery({
    queryKey: creditKeys.balance(ws),
    queryFn: creditsApi.get,
    enabled: !!ws && enabled && can('billing.read_credits') && workspace?.status !== 'suspended',
    staleTime: 30_000,
    retry: false,
  });
};
export const useLedger = (q: ApiQuery, enabled = true) => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: creditKeys.ledger(ws, q), queryFn: () => creditsApi.ledger(q), enabled: !!ws && enabled, placeholderData: keepPreviousData });
};
