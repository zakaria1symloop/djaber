// Products list — URL state definition (06 §10 "Produits [CAT-08 filter panel]"), moderation tabs, date presets,
// active filter chips. Pure functions (unit tested); the page wires them to `useListState`.
import { formatMoney, formatNumber, PRODUCT_SORTS, TIMEZONE } from '@djaber/shared';
import type { ApiQuery, ListSpec, ListState } from '@/lib/list-state';
import { filterBool, filterList, filterText } from '@/lib/list-state';

export const PRODUCT_TABS = ['active', 'pending', 'rejected', 'hidden'] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number];

export const PRODUCTS_LIST: ListSpec = {
  filters: {
    categoryIds: 'list',
    status: 'list',
    type: 'list',
    stockState: 'list',
    lowStock: 'bool',
    minQty: 'int',
    maxQty: 'int',
    minPrice: 'int',
    maxPrice: 'int',
    minCost: 'int',
    maxCost: 'int',
    minMargin: 'int',
    maxMargin: 'int',
    noAgent: 'bool',
    moderationStatus: 'list',
    createdFrom: 'date',
    createdTo: 'date',
    updatedFrom: 'date',
    updatedTo: 'date',
  },
  sorts: PRODUCT_SORTS,
  defaultSort: 'name',
  tabs: PRODUCT_TABS,
  layouts: ['grid'],
};

/** A status tab is a filter preset (12 §21 "list tabs Tous / Actifs / En attente de validation / Refusés / Masqués"). */
export const tabQuery = (tab: string | null): ApiQuery => {
  switch (tab) {
    case 'active':
      return { status: ['active'] };
    case 'hidden':
      return { status: ['inactive'] };
    case 'pending':
      return { moderationStatus: ['pending'] };
    case 'rejected':
      return { moderationStatus: ['rejected', 'appealed'] };
    default:
      return {};
  }
};

/** Query of `GET /products`: the explicit filters win over the tab preset for the same parameter. */
export const productsQuery = (base: ApiQuery, tab: string | null): ApiQuery => ({ ...tabQuery(tab), ...base });

/* ---------- date presets (Africa/Algiers days, `to` inclusive) ---------- */
export const DATE_PRESETS = ['7d', '30d', 'month'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/** `YYYY-MM-DD` of an instant in Africa/Algiers. */
export const algiersDay = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const shiftDay = (day: string, delta: number): string => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
/** `7d` = today and the 6 days before; `month` = from the 1st of the current month. */
export function presetRange(preset: DatePreset, now = new Date()): { from: string; to: string } {
  const to = algiersDay(now);
  if (preset === 'month') return { from: `${to.slice(0, 8)}01`, to };
  return { from: shiftDay(to, preset === '7d' ? -6 : -29), to };
}
/** Which preset (if any) a range matches today; `custom` for any other range, null when empty. */
export function matchPreset(from: string, to: string, now = new Date()): DatePreset | 'custom' | null {
  if (!from && !to) return null;
  for (const p of DATE_PRESETS) {
    const r = presetRange(p, now);
    if (r.from === from && r.to === to) return p;
  }
  return 'custom';
}

/* ---------- active chips ---------- */
export type ChipLabels = {
  category: (names: string) => string;
  status: Record<string, string>;
  type: Record<string, string>;
  stockState: Record<string, string>;
  lowStock: string;
  noAgent: string;
  moderation: Record<string, string>;
  qty: (range: string) => string;
  price: (range: string) => string;
  cost: (range: string) => string;
  margin: (range: string) => string;
  created: (range: string) => string;
  updated: (range: string) => string;
  search: (q: string) => string;
  categoryName: (id: string) => string;
  date: (day: string) => string;
};
export type Chip = { key: string; label: string; clear: Record<string, null> | 'q' };

const range = (min: string, max: string, fmt: (n: number) => string): string | null => {
  if (!min && !max) return null;
  if (min && max) return `${fmt(Number(min))} – ${fmt(Number(max))}`;
  return min ? `≥ ${fmt(Number(min))}` : `≤ ${fmt(Number(max))}`;
};

/** One chip per active filter group, in the order of the panel. */
export function activeChips(s: ListState, l: ChipLabels): Chip[] {
  const chips: Chip[] = [];
  if (s.q.trim()) chips.push({ key: 'q', label: l.search(s.q.trim()), clear: 'q' });
  const cats = filterList(s, 'categoryIds');
  if (cats.length) chips.push({ key: 'categoryIds', label: l.category(cats.map(l.categoryName).join(', ')), clear: { categoryIds: null } });
  for (const v of filterList(s, 'status')) chips.push({ key: `status:${v}`, label: l.status[v] ?? v, clear: { status: null } });
  for (const v of filterList(s, 'type')) chips.push({ key: `type:${v}`, label: l.type[v] ?? v, clear: { type: null } });
  if (filterBool(s, 'lowStock')) chips.push({ key: 'lowStock', label: l.lowStock, clear: { lowStock: null } });
  for (const v of filterList(s, 'stockState')) chips.push({ key: `stockState:${v}`, label: l.stockState[v] ?? v, clear: { stockState: null } });
  const pairs: [string, string, (r: string) => string, (n: number) => string][] = [
    ['minQty', 'maxQty', l.qty, formatNumber],
    ['minPrice', 'maxPrice', l.price, formatMoney],
    ['minCost', 'maxCost', l.cost, formatMoney],
    ['minMargin', 'maxMargin', l.margin, (n) => `${n} %`],
  ];
  for (const [min, max, label, fmt] of pairs) {
    const r = range(filterText(s, min), filterText(s, max), fmt);
    if (r) chips.push({ key: min, label: label(r), clear: { [min]: null, [max]: null } });
  }
  if (filterBool(s, 'noAgent')) chips.push({ key: 'noAgent', label: l.noAgent, clear: { noAgent: null } });
  for (const v of filterList(s, 'moderationStatus')) chips.push({ key: `moderationStatus:${v}`, label: l.moderation[v] ?? v, clear: { moderationStatus: null } });
  const dates: [string, string, (r: string) => string][] = [
    ['createdFrom', 'createdTo', l.created],
    ['updatedFrom', 'updatedTo', l.updated],
  ];
  for (const [from, to, label] of dates) {
    const a = filterText(s, from);
    const b = filterText(s, to);
    if (a || b) chips.push({ key: from, label: label([a ? l.date(a) : '…', b ? l.date(b) : '…'].join(' → ')), clear: { [from]: null, [to]: null } });
  }
  return chips;
}

/** Removing one value of a multi filter keeps the others. */
export const withoutValue = (s: ListState, name: string, value: string): string[] => filterList(s, name).filter((v) => v !== value);
