// Orders list — URL state definition (api-contract §4 `OrdersQuery`, 06 §10 "Commandes [ORD-05 filter panel]").
// The status tab IS the status filter (ORD-05 fix, 08 §1): `?tab=new` ⇒ `status=new`; there is no second status filter.
// Pure functions (unit tested); the page wires them to `useListState`.
import { formatMoney } from '@djaber/shared';
import type { ApiQuery, ListSpec, ListState } from '@/lib/list-state';
import { filterBool, filterList, filterText } from '@/lib/list-state';
import { ORDER_PERIODS, ORDER_SORTS, ORDER_STATUSES, type OrderStatus } from '../contracts';

export const ORDERS_LIST: ListSpec = {
  filters: {
    confirmationStatus: 'list',
    minCalls: 'int',
    neverCalled: 'bool',
    paymentStatus: 'list',
    paymentMethod: 'list',
    hasRemaining: 'bool',
    deliveryStatus: 'list',
    shipmentProvider: 'list',
    source: 'list',
    channelId: 'list',
    agentId: 'list',
    assigneeId: 'text',
    wilayaId: 'list',
    isStopdesk: 'text',
    minTotal: 'int',
    maxTotal: 'int',
    period: 'text',
    from: 'date',
    to: 'date',
    productId: 'text',
    riskLevel: 'text',
    clientId: 'text',
    callbackDue: 'bool',
    ids: 'list',
  },
  sorts: ORDER_SORTS,
  defaultSort: '-orderedAt',
  tabs: ORDER_STATUSES,
};

/** Tabs in the Figma order (ORD-05 v2 + 12 §5: Préparation): `null` = Toutes. */
export const ORDER_TABS: (OrderStatus | null)[] = [null, 'new', 'confirmed', 'preparing', 'shipped', 'delivered', 'returned', 'cancelled'];

/** Period presets of the "Période ⌄" chip and of the panel (Africa/Algiers, computed by the server). */
export const PERIOD_PRESETS = ['today', '7d', '30d', 'month'] as const satisfies readonly (typeof ORDER_PERIODS)[number][];
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** Query of `GET /orders`: the tab becomes the `status` filter; `isStopdesk` travels as `true` / `false`. */
export function ordersQuery(base: ApiQuery, tab: string | null): ApiQuery {
  const q: ApiQuery = { ...base };
  if (tab && (ORDER_STATUSES as readonly string[]).includes(tab)) q.status = [tab];
  if (q.isStopdesk !== undefined && q.isStopdesk !== 'true' && q.isStopdesk !== 'false') delete q.isStopdesk;
  // a custom range (from / to) replaces any preset
  if ((q.from || q.to) && q.period) delete q.period;
  return q;
}

/** Same filters without the status: counts of the tabs (each tab shows the count of its status under the other filters). */
export function tabCountsQuery(filters: ApiQuery): ApiQuery {
  const { status: _status, ...rest } = filters;
  return rest;
}

/** Period chosen on screen: a preset, a custom range, or nothing. */
export function periodOf(s: ListState): PeriodPreset | 'custom' | null {
  if (filterText(s, 'from') || filterText(s, 'to')) return 'custom';
  const p = filterText(s, 'period');
  return (PERIOD_PRESETS as readonly string[]).includes(p) ? (p as PeriodPreset) : null;
}

/* ---------- active chips ---------- */
export type ChipLabels = {
  search: (q: string) => string;
  confirmation: Record<string, string>;
  minCalls: (n: number) => string;
  neverCalled: string;
  payment: Record<string, string>;
  method: Record<string, string>;
  hasRemaining: string;
  delivery: Record<string, string>;
  provider: Record<string, string>;
  source: Record<string, string>;
  channel: (names: string) => string;
  channelName: (id: string) => string;
  agent: (names: string) => string;
  agentName: (id: string) => string;
  assignee: (name: string) => string;
  assigneeName: (id: string) => string;
  wilaya: (names: string) => string;
  wilayaName: (id: string) => string;
  stopdesk: Record<'true' | 'false', string>;
  total: (range: string) => string;
  period: Record<string, string>;
  range: (from: string, to: string) => string;
  product: string;
  client: string;
  risk: Record<string, string>;
  callbackDue: string;
  ids: (n: number) => string;
};
export type Chip = { key: string; label: string; clear: Record<string, null> | 'q' };

const range = (min: string, max: string, fmt: (n: number) => string): string | null => {
  if (!min && !max) return null;
  if (min && max) return `${fmt(Number(min))} – ${fmt(Number(max))}`;
  return min ? `≥ ${fmt(Number(min))}` : `≤ ${fmt(Number(max))}`;
};

/** One chip per active filter value, in the order of the panel ("SANS RÉPONSE ×", "≥ 2 APPELS ×", "COD · RESTE > 0 ×"…). */
export function activeChips(s: ListState, l: ChipLabels): Chip[] {
  const chips: Chip[] = [];
  if (s.q.trim()) chips.push({ key: 'q', label: l.search(s.q.trim()), clear: 'q' });
  for (const v of filterList(s, 'confirmationStatus')) chips.push({ key: `confirmationStatus:${v}`, label: l.confirmation[v] ?? v, clear: { confirmationStatus: null } });
  const minCalls = filterText(s, 'minCalls');
  if (minCalls) chips.push({ key: 'minCalls', label: l.minCalls(Number(minCalls)), clear: { minCalls: null } });
  if (filterBool(s, 'neverCalled')) chips.push({ key: 'neverCalled', label: l.neverCalled, clear: { neverCalled: null } });
  for (const v of filterList(s, 'paymentStatus')) chips.push({ key: `paymentStatus:${v}`, label: l.payment[v] ?? v, clear: { paymentStatus: null } });
  for (const v of filterList(s, 'paymentMethod')) chips.push({ key: `paymentMethod:${v}`, label: l.method[v] ?? v, clear: { paymentMethod: null } });
  if (filterBool(s, 'hasRemaining')) chips.push({ key: 'hasRemaining', label: l.hasRemaining, clear: { hasRemaining: null } });
  for (const v of filterList(s, 'deliveryStatus')) chips.push({ key: `deliveryStatus:${v}`, label: l.delivery[v] ?? v, clear: { deliveryStatus: null } });
  for (const v of filterList(s, 'shipmentProvider')) chips.push({ key: `shipmentProvider:${v}`, label: l.provider[v] ?? v, clear: { shipmentProvider: null } });
  for (const v of filterList(s, 'source')) chips.push({ key: `source:${v}`, label: l.source[v] ?? v, clear: { source: null } });
  const channels = filterList(s, 'channelId');
  if (channels.length) chips.push({ key: 'channelId', label: l.channel(channels.map(l.channelName).join(', ')), clear: { channelId: null } });
  const agents = filterList(s, 'agentId');
  if (agents.length) chips.push({ key: 'agentId', label: l.agent(agents.map(l.agentName).join(', ')), clear: { agentId: null } });
  const assignee = filterText(s, 'assigneeId');
  if (assignee) chips.push({ key: 'assigneeId', label: l.assignee(l.assigneeName(assignee)), clear: { assigneeId: null } });
  const wilayas = filterList(s, 'wilayaId');
  if (wilayas.length) chips.push({ key: 'wilayaId', label: l.wilaya(wilayas.map(l.wilayaName).join(', ')), clear: { wilayaId: null } });
  const stop = filterText(s, 'isStopdesk');
  if (stop === 'true' || stop === 'false') chips.push({ key: 'isStopdesk', label: l.stopdesk[stop], clear: { isStopdesk: null } });
  const total = range(filterText(s, 'minTotal'), filterText(s, 'maxTotal'), formatMoney);
  if (total) chips.push({ key: 'minTotal', label: l.total(total), clear: { minTotal: null, maxTotal: null } });
  const from = filterText(s, 'from');
  const to = filterText(s, 'to');
  if (from || to) chips.push({ key: 'from', label: l.range(from, to), clear: { from: null, to: null, period: null } });
  else {
    const p = filterText(s, 'period');
    if (p) chips.push({ key: 'period', label: l.period[p] ?? p, clear: { period: null } });
  }
  if (filterText(s, 'productId')) chips.push({ key: 'productId', label: l.product, clear: { productId: null } });
  if (filterText(s, 'clientId')) chips.push({ key: 'clientId', label: l.client, clear: { clientId: null } });
  const risk = filterText(s, 'riskLevel');
  if (risk) chips.push({ key: 'riskLevel', label: l.risk[risk] ?? risk, clear: { riskLevel: null } });
  if (filterBool(s, 'callbackDue')) chips.push({ key: 'callbackDue', label: l.callbackDue, clear: { callbackDue: null } });
  const ids = filterList(s, 'ids');
  if (ids.length) chips.push({ key: 'ids', label: l.ids(ids.length), clear: { ids: null } });
  return chips;
}

/** Removing one value of a multi filter keeps the others. */
export const withoutValue = (s: ListState, name: string, value: string): string[] => filterList(s, name).filter((v) => v !== value);

/** Panel group "Assigné à": `me`, `none` or a member id — one value. */
export const ASSIGNEE_SPECIAL = ['me', 'none'] as const;
