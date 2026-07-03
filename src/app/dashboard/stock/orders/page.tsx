'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, DatePicker, Pagination, RangeSlider } from '@/components/stock';
import { Button } from '@/components/ui';
import {
  ClipboardIcon, SearchIcon, TrashIcon, PlusIcon,
  PhoneIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  getOrders, getOrderStats, deleteOrder, updateOrder,
  type Order,
} from '@/lib/user-stock-api';
import ConfirmOrderModal from '@/components/stock/ConfirmOrderModal';

const LIMIT = 30;
const DEFAULT_TOTAL_MAX = 1000000;

type OrderStatsData = Awaited<ReturnType<typeof getOrderStats>>['stats'];

// Order-status transition matrix (mirrors the backend-enforced rules):
// cancelled and returned are terminal, delivered can only be returned.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'],
  confirmed: ['preparing', 'shipped', 'delivered', 'cancelled'],
  preparing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const BULK_ACTIONS: { status: string; label: string; subtle?: boolean }[] = [
  { status: 'confirmed', label: 'Confirm all' },
  { status: 'preparing', label: 'Start preparing all' },
  { status: 'shipped', label: 'Ship all' },
  { status: 'delivered', label: 'Mark all delivered' },
  { status: 'returned', label: 'Mark all returned', subtle: true },
  { status: 'cancelled', label: 'Cancel all', subtle: true },
];

// Neutral status pill — the word carries the meaning, the dot marks state:
// filled = terminal-good, hollow = in-progress, none = dead state.
function StatusPill({ label, kind }: { label: string; kind: 'good' | 'progress' | 'dead' }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-zinc-300">
      {kind === 'good' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      {kind === 'progress' && <span className="w-1.5 h-1.5 rounded-full border border-zinc-600" />}
      <span className={kind === 'dead' ? 'text-zinc-600' : ''}>{label}</span>
    </span>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>}>
      <OrdersPageInner />
    </Suspense>
  );
}

function OrdersPageInner() {
  const router = useRouter();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('clientId') || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Server-aggregated totals for the stat tiles + tab badges — independent
  // of the current page/tab so they never reflect just the visible 30 rows.
  const [orderStats, setOrderStats] = useState<OrderStatsData | null>(null);

  // Search
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Filter panel
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftStatus, setDraftStatus] = useState('');
  const [draftConfirm, setDraftConfirm] = useState('');
  const [draftPayment, setDraftPayment] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [draftTotalRange, setDraftTotalRange] = useState<[number, number]>([0, DEFAULT_TOTAL_MAX]);
  const [draftHasRemaining, setDraftHasRemaining] = useState(false);

  // Applied
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedConfirm, setAppliedConfirm] = useState('');
  const [appliedPayment, setAppliedPayment] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedTotalRange, setAppliedTotalRange] = useState<[number, number]>([0, DEFAULT_TOTAL_MAX]);
  const [appliedHasRemaining, setAppliedHasRemaining] = useState(false);
  const [appliedClientId, setAppliedClientId] = useState(initialClientId);
  const [filterTrigger, setFilterTrigger] = useState(0);
  const [statusTab, setStatusTab] = useState('pending');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modal state
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [returnConfirm, setReturnConfirm] = useState<Order | null>(null);
  const [returning, setReturning] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setSearchDebounced(search); setOffset(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeFilterCount = [
    appliedStatus, appliedConfirm, appliedPayment, appliedStartDate, appliedEndDate,
    appliedTotalRange[0] > 0 || appliedTotalRange[1] < DEFAULT_TOTAL_MAX ? 'x' : '',
    appliedHasRemaining ? 'x' : '',
    appliedClientId ? 'x' : '',
  ].filter(Boolean).length;

  const draftDirty =
    draftStatus !== appliedStatus || draftConfirm !== appliedConfirm ||
    draftPayment !== appliedPayment || draftStartDate !== appliedStartDate ||
    draftEndDate !== appliedEndDate ||
    draftTotalRange[0] !== appliedTotalRange[0] || draftTotalRange[1] !== appliedTotalRange[1] ||
    draftHasRemaining !== appliedHasRemaining;

  const applyFilters = () => {
    setAppliedStatus(draftStatus);
    setAppliedConfirm(draftConfirm);
    setAppliedPayment(draftPayment);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setAppliedTotalRange([...draftTotalRange]);
    setAppliedHasRemaining(draftHasRemaining);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const clearAllFilters = () => {
    setDraftStatus(''); setDraftConfirm(''); setDraftPayment('');
    setDraftStartDate(''); setDraftEndDate('');
    setDraftTotalRange([0, DEFAULT_TOTAL_MAX]);
    setDraftHasRemaining(false);
    setAppliedStatus(''); setAppliedConfirm(''); setAppliedPayment('');
    setAppliedStartDate(''); setAppliedEndDate('');
    setAppliedTotalRange([0, DEFAULT_TOTAL_MAX]);
    setAppliedHasRemaining(false);
    setAppliedClientId('');
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getOrders({
        status: statusTab || appliedStatus || undefined,
        confirmationStatus: appliedConfirm || undefined,
        paymentStatus: appliedPayment || undefined,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
        search: searchDebounced || undefined,
        minTotal: appliedTotalRange[0] > 0 ? appliedTotalRange[0] : undefined,
        maxTotal: appliedTotalRange[1] < DEFAULT_TOTAL_MAX ? appliedTotalRange[1] : undefined,
        hasRemaining: appliedHasRemaining || undefined,
        clientId: appliedClientId || undefined,
        limit: LIMIT,
        offset,
      });
      setOrders(res.orders);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusTab, appliedStatus, appliedConfirm, appliedPayment, appliedStartDate, appliedEndDate, appliedTotalRange, appliedHasRemaining, appliedClientId, searchDebounced, offset, filterTrigger]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getOrderStats();
      setOrderStats(res.stats);
    } catch {
      // Non-blocking — tiles keep their last known values
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    return () => { setFiltersOpen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearClientFilter = () => {
    setAppliedClientId('');
    setFilterTrigger(t => t + 1);
  };

  const toggleFilters = () => {
    if (!filtersOpen) {
      setConfirmingOrder(null);
      setDeleteConfirm(null);
      setReturnConfirm(null);
    }
    setFiltersOpen(!filtersOpen);
  };

  const ORDER_STATUSES = [
    { value: '', label: t('stock.common.all'), color: 'text-zinc-400' },
    { value: 'pending', label: t('stock.common.new'), color: 'text-zinc-400' },
    { value: 'confirmed', label: t('stock.common.confirmed'), color: 'text-zinc-400' },
    { value: 'preparing', label: t('stock.common.preparing'), color: 'text-zinc-400' },
    { value: 'shipped', label: t('stock.common.shipped'), color: 'text-zinc-400' },
    { value: 'delivered', label: t('stock.common.delivered'), color: 'text-zinc-400' },
    { value: 'cancelled', label: t('stock.common.cancelled'), color: 'text-zinc-400' },
    { value: 'returned', label: t('stock.common.returned'), color: 'text-zinc-400' },
  ];

  // statusTab moved to top of component (before loadOrders callback)

  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed': return 'info';
      case 'preparing': return 'info';
      case 'shipped': case 'dispatched': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      case 'returned': return 'error';
      default: return 'warning';
    }
  };

  const getNextStatus = (current: string): { label: string; next: string } | null => {
    switch (current) {
      case 'pending': return { label: 'Confirm', next: 'confirmed' };
      case 'confirmed': return { label: 'Start Preparing', next: 'preparing' };
      case 'preparing': return { label: 'Ship', next: 'shipped' };
      case 'shipped': return { label: 'Mark Delivered', next: 'delivered' };
      default: return null;
    }
  };

  const handleQuickStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateOrder(orderId, { status: newStatus });
      loadOrders();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const handleBulkStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    setError(null);
    try {
      // allSettled so one rejected update doesn't hide the others' outcome
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => updateOrder(id, { status: newStatus }))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        setError(`${failed} of ${results.length} orders could not be updated`);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkProcessing(false);
      // Reload even on partial failure so successful updates are reflected
      loadOrders();
      loadStats();
    }
  };

  const getConfirmVariant = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'no_answer': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getConfirmLabel = (status: string): string => {
    switch (status) {
      case 'confirmed': return t('stock.orders.confirm.confirmed');
      case 'no_answer': return t('stock.orders.confirm.noAnswer');
      case 'rejected': return t('stock.orders.confirm.rejected');
      default: return t('stock.orders.confirm.notCalled');
    }
  };

  const getPaymentVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'error';
      default: return 'default';
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteOrder(deleteConfirm.id);
      setOrders(orders.filter((o) => o.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  const handleReturn = async () => {
    if (!returnConfirm) return;
    try {
      setError(null);
      setReturning(true);
      // Backend restores stock + rolls back the caisse entry on this transition
      await updateOrder(returnConfirm.id, { status: 'returned' });
      setReturnConfirm(null);
      loadOrders();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark order as returned');
    } finally {
      setReturning(false);
    }
  };

  const handleConfirmModalChange = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setConfirmingOrder(updated);
    loadStats();
  };

  // Decide a row's start-border accent — a single neutral marker for rows that
  // still need a call, nothing otherwise.
  const rowAccent = (order: Order): string => {
    if (
      order.status === 'pending' &&
      (order.confirmationStatus === 'not_called' || order.confirmationStatus === 'no_answer')
    ) {
      return 'border-s-2 border-s-white/20';
    }
    return '';
  };

  const primaryAction = (order: Order): { label: string; tone: 'emerald' | 'blue' | 'amber' | 'zinc' } => {
    const s = order.status;
    if (s === 'pending' && order.confirmationStatus === 'not_called') return { label: 'Call & confirm', tone: 'blue' };
    if (s === 'pending' && order.confirmationStatus === 'no_answer') return { label: 'Try again', tone: 'amber' };
    if (s === 'confirmed') return { label: 'Prepare', tone: 'emerald' };
    if (s === 'preparing') return { label: 'Mark shipped', tone: 'emerald' };
    if (s === 'shipped') return { label: 'Mark delivered', tone: 'emerald' };
    return { label: 'Open', tone: 'zinc' };
  };

  // Server-side count for a status tab (from getOrderStats), so badges and
  // tiles never reflect just the 30 rows currently loaded.
  const statusCountFor = (status: string): number | null => {
    if (!orderStats) return null;
    switch (status) {
      case '': return orderStats.totalOrders;
      case 'pending': return orderStats.pending;
      case 'confirmed': return orderStats.confirmed;
      case 'preparing': return orderStats.preparing;
      case 'shipped': return orderStats.shipped;
      case 'delivered': return orderStats.delivered;
      case 'cancelled': return orderStats.cancelled;
      case 'returned': return orderStats.returned;
      default: return null;
    }
  };

  // Bulk actions = intersection of the transitions allowed for every selected
  // order's status (terminal statuses contribute an empty set, so e.g. a
  // cancelled row in the selection removes every bulk action).
  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const bulkAllowed = selectedOrders.reduce<string[]>((acc, o, i) => {
    const allowed = ALLOWED_TRANSITIONS[o.status] || [];
    return i === 0 ? allowed : acc.filter((s) => allowed.includes(s));
  }, []);

  return (
    <div className="relative">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{t('stock.orders.title')}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t('stock.orders.count').replace('{n}', String(total))}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFilters}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
              filtersOpen
                ? 'border-white/20 bg-white/10 text-white'
                : activeFilterCount > 0
                  ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                  : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
            }`}
          >
            <FilterIcon className="w-4 h-4" />
            {t('stock.common.filters')}
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-black text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <Button onClick={() => router.push('/dashboard/stock/orders/new')} icon={<PlusIcon className="w-4 h-4" />}>
            {t('stock.orders.new')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Client filter banner */}
      {appliedClientId && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl">
          <span className="text-sm text-zinc-400">Filtered by client</span>
          <button
            onClick={clearClientFilter}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <CloseIcon className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Stats — server aggregates from getOrderStats, never the current page */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.totalOrders')}</p>
          <p className="text-2xl font-bold text-white mt-1">{orderStats ? orderStats.totalOrders : '—'}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.pending')}</p>
          <p className="text-2xl font-bold text-white mt-1">{orderStats ? orderStats.pending : '—'}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.common.delivered')}</p>
          <p className="text-2xl font-bold text-white mt-1">{orderStats ? orderStats.delivered : '—'}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.totalValue')}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {orderStats ? Number(orderStats.totalRevenue).toLocaleString() : '—'}{' '}
            <span className="text-sm text-zinc-400">DA</span>
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-1 inline-flex flex-wrap gap-1">
        {ORDER_STATUSES.map((s) => {
          return (
            <button
              key={s.value}
              onClick={() => { setStatusTab(s.value); setOffset(0); setSelectedIds(new Set()); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusTab === s.value
                  ? 'bg-white text-black'
                  : `${s.color} hover:bg-white/5`
              }`}
            >
              {s.label}
              {s.value === statusTab && statusTab && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">
                  {/* Server count for the status — fall back to the list total
                      (which is server-side too) until stats load */}
                  {statusCountFor(statusTab) ?? total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search bar + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder={t('stock.orders.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); setAppliedStartDate(v); setOffset(0); setFilterTrigger(n => n + 1); }} placeholder={t('stock.common.fromDate')} />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); setAppliedEndDate(v); setOffset(0); setFilterTrigger(n => n + 1); }} placeholder={t('stock.common.toDate')} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>
      ) : orders.length > 0 ? (
        <>
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-20 z-10 bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-xl p-3 mb-3 flex items-center justify-between shadow-2xl">
            <span className="text-sm text-white font-medium">
              {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {/* Only transitions valid for EVERY selected order are offered
                  (P1 matrix intersection) — e.g. no 'Cancel all' when the
                  selection contains shipped/delivered/returned/cancelled rows. */}
              {(() => {
                let primaryUsed = false;
                return BULK_ACTIONS.filter((a) => bulkAllowed.includes(a.status)).map((a) => {
                  const primary = !a.subtle && !primaryUsed;
                  if (primary) primaryUsed = true;
                  return (
                    <button
                      key={a.status}
                      onClick={() => handleBulkStatus(a.status)}
                      disabled={bulkProcessing}
                      className={
                        primary
                          ? 'px-3 py-1.5 text-xs font-medium bg-white text-black hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50'
                          : 'px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors disabled:opacity-50'
                      }
                    >
                      {bulkProcessing ? 'Processing…' : a.label}
                    </button>
                  );
                });
              })()}
              {bulkAllowed.length === 0 && (
                <span className="text-xs text-zinc-500">No bulk action available for this selection</span>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-black/60 text-white focus:ring-1 focus:ring-white/30"
                    />
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.orders.col.number')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.client')}</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.items')}</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.total')}</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.paid')}</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.remaining')}</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.status')}</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.orders.col.confirmation')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.date')}</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">{t('stock.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const remaining = Math.max(0, Number(order.total) - Number(order.amountPaid));
                  const action = primaryAction(order);
                  const next = getNextStatus(order.status);
                  const accent = rowAccent(order);
                  const toneClasses =
                    action.tone === 'zinc'
                      ? 'bg-white/10 hover:bg-white/20 text-zinc-200'
                      : 'bg-white hover:bg-zinc-200 text-black';
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors ${accent} ${
                        selectedIds.has(order.id) ? 'bg-white/[0.03]' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="w-4 h-4 rounded border-white/20 bg-black/60 text-white focus:ring-1 focus:ring-white/30"
                        />
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-white font-medium cursor-pointer"
                        onClick={() => setConfirmingOrder(order)}
                      >
                        {order.orderNumber}
                        {order.source === 'ai' && (
                          <span className="ms-1.5 text-[9px] text-zinc-400 bg-white/[0.03] border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">AI</span>
                        )}
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => setConfirmingOrder(order)}>
                        <p className="text-sm text-white truncate max-w-[180px]">{order.clientName}</p>
                        {order.clientPhone && <p className="text-xs text-zinc-500">{order.clientPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-zinc-400">{order.items.length}</td>
                      <td className="px-4 py-3 text-sm text-right text-white font-medium whitespace-nowrap">
                        {Number(order.total).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-zinc-400 whitespace-nowrap">
                        {Number(order.amountPaid).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-zinc-400 whitespace-nowrap">
                        {remaining > 0 ? `${remaining.toLocaleString()} DA` : '–'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusPill
                          label={order.status}
                          kind={
                            order.status === 'delivered' || order.status === 'confirmed'
                              ? 'good'
                              : order.status === 'cancelled' || order.status === 'returned'
                                ? 'dead'
                                : 'progress'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusPill
                          label={`${getConfirmLabel(order.confirmationStatus)}${order.callAttempts > 0 ? ` (${order.callAttempts})` : ''}`}
                          kind={
                            order.confirmationStatus === 'confirmed'
                              ? 'good'
                              : order.confirmationStatus === 'rejected'
                                ? 'dead'
                                : 'progress'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              if (next && order.confirmationStatus === 'confirmed' && order.status !== 'pending') {
                                // Confirmed orders can advance straight via the row CTA
                                handleQuickStatus(order.id, next.next);
                              } else {
                                setConfirmingOrder(order);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${toneClasses}`}
                            title={action.label}
                          >
                            {action.label}
                          </button>
                          {order.status === 'delivered' && (
                            <button
                              onClick={() => setReturnConfirm(order)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                              title={t('stock.orders.action.markReturned')}
                            >
                              {t('stock.orders.action.markReturned')}
                            </button>
                          )}
                          {order.status !== 'delivered' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setDeleteConfirm(order)}
                              className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="Delete order"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center">
            <ClipboardIcon className="w-16 h-16" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Orders Yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
            Orders appear from AI chatbot confirmations, or create them manually.
          </p>
          <Button onClick={() => router.push('/dashboard/stock/orders/new')} icon={<PlusIcon className="w-4 h-4" />}>New Order</Button>
        </div>
      )}

      <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />

      {/* Confirmation wizard — replaces View + Call modals with one unified flow */}
      <ConfirmOrderModal
        order={confirmingOrder}
        isOpen={!!confirmingOrder}
        onClose={() => setConfirmingOrder(null)}
        onChanged={handleConfirmModalChange}
      />

      {/* Return Confirm Modal */}
      <Modal isOpen={!!returnConfirm} onClose={() => setReturnConfirm(null)} title={t('stock.orders.action.markReturned')} size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to mark order <span className="text-white font-medium">{returnConfirm?.orderNumber}</span> as returned?
          Stock will be restored and the payment rolled back.
        </p>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setReturnConfirm(null)} disabled={returning}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={handleReturn} disabled={returning}>
            {returning ? 'Saving...' : t('stock.orders.action.markReturned')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Order" size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete order <span className="text-white font-medium">{deleteConfirm?.orderNumber}</span>?
          Stock will be restored.
        </p>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>

      {/* Filter Panel */}
      {filtersOpen && (
        <div className="fixed top-0 right-0 h-full w-[336px] bg-zinc-950 border-l border-white/10 z-[45] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            <button onClick={() => setFiltersOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Order Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Order Status</label>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="pending">New / Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            {/* Confirmation Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Confirmation</label>
              <select
                value={draftConfirm}
                onChange={(e) => setDraftConfirm(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All</option>
                <option value="not_called">Not Called</option>
                <option value="no_answer">No Answer</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Payment Status</label>
              <select
                value={draftHasRemaining ? '' : draftPayment}
                onChange={(e) => setDraftPayment(e.target.value)}
                disabled={draftHasRemaining}
                className={`w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors ${draftHasRemaining ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <option value="">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
              {draftHasRemaining && (
                <p className="text-[10px] text-zinc-500 mt-1">Disabled — "Has Remaining" is active</p>
              )}
            </div>

            {/* Has Remaining */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Quick Filter</label>
              <button
                onClick={() => setDraftHasRemaining(!draftHasRemaining)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  draftHasRemaining
                    ? 'border-white/20 bg-white/5 text-white'
                    : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  draftHasRemaining ? 'border-white bg-white' : 'border-zinc-600'
                }`}>
                  {draftHasRemaining && (
                    <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                Has Remaining Balance
              </button>
            </div>

            {/* Total Amount Range */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Total Amount (DA)
                {(draftTotalRange[0] > 0 || draftTotalRange[1] < DEFAULT_TOTAL_MAX) && (
                  <span className="ml-1.5 text-zinc-300 font-normal">
                    {draftTotalRange[0].toLocaleString()} - {draftTotalRange[1].toLocaleString()}
                  </span>
                )}
              </label>
              <RangeSlider
                min={0}
                max={DEFAULT_TOTAL_MAX}
                step={1000}
                value={draftTotalRange}
                onChange={setDraftTotalRange}
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-white/10 space-y-2">
            <button
              onClick={applyFilters}
              disabled={!draftDirty}
              className="w-full px-4 py-2.5 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-black text-sm font-medium rounded-lg transition-colors"
            >
              Apply Filters
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="w-full px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
