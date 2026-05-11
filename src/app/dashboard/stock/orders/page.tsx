'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, DatePicker, Pagination, RangeSlider } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  ClipboardIcon, SearchIcon, TrashIcon, PlusIcon,
  PhoneIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  getOrders, deleteOrder, updateOrder,
  type Order,
} from '@/lib/user-stock-api';
import ConfirmOrderModal from '@/components/stock/ConfirmOrderModal';

const LIMIT = 30;
const DEFAULT_TOTAL_MAX = 1000000;

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
    }
    setFiltersOpen(!filtersOpen);
  };

  const ORDER_STATUSES = [
    { value: '', label: t('stock.common.all'), color: 'text-zinc-400' },
    { value: 'pending', label: t('stock.common.new'), color: 'text-amber-400' },
    { value: 'confirmed', label: t('stock.common.confirmed'), color: 'text-blue-400' },
    { value: 'preparing', label: t('stock.common.preparing'), color: 'text-violet-400' },
    { value: 'shipped', label: t('stock.common.shipped'), color: 'text-cyan-400' },
    { value: 'delivered', label: t('stock.common.delivered'), color: 'text-emerald-400' },
    { value: 'cancelled', label: t('stock.common.cancelled'), color: 'text-red-400' },
    { value: 'returned', label: t('stock.common.returned'), color: 'text-orange-400' },
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
    } catch {}
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
    try {
      setBulkProcessing(true);
      await Promise.all(
        Array.from(selectedIds).map((id) => updateOrder(id, { status: newStatus }))
      );
      setSelectedIds(new Set());
      loadOrders();
    } catch {} finally {
      setBulkProcessing(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmModalChange = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setConfirmingOrder(updated);
  };

  // Decide a row's left-border accent — gives a quick at-a-glance "what to do next"
  // Cast to string because the Order type is narrower than the runtime statuses
  // ('preparing', 'shipped', 'returned' exist in the DB but not in the TS type)
  const rowAccent = (order: Order): string => {
    const s = order.status as string;
    if (s === 'cancelled' || s === 'returned') return 'border-l-rose-500/40';
    if (s === 'delivered') return 'border-l-emerald-500/40';
    if (s === 'shipped' || s === 'dispatched') return 'border-l-cyan-500/40';
    if (s === 'preparing') return 'border-l-violet-500/40';
    if (order.confirmationStatus === 'confirmed') return 'border-l-emerald-500/40';
    if (order.confirmationStatus === 'no_answer') return 'border-l-amber-500/40';
    if (order.confirmationStatus === 'rejected') return 'border-l-rose-500/40';
    return 'border-l-blue-500/40'; // not_called yet
  };

  const primaryAction = (order: Order): { label: string; tone: 'emerald' | 'blue' | 'amber' | 'zinc' } => {
    const s = order.status as string;
    if (s === 'pending' && order.confirmationStatus === 'not_called') return { label: 'Call & confirm', tone: 'blue' };
    if (s === 'pending' && order.confirmationStatus === 'no_answer') return { label: 'Try again', tone: 'amber' };
    if (s === 'confirmed') return { label: 'Prepare', tone: 'emerald' };
    if (s === 'preparing') return { label: 'Mark shipped', tone: 'emerald' };
    if (s === 'shipped') return { label: 'Mark delivered', tone: 'emerald' };
    return { label: 'Open', tone: 'zinc' };
  };

  // Compute stats from loaded orders
  const stats = {
    total: total,
    pending: orders.filter((o) => o.status === 'pending').length,
    notCalled: orders.filter((o) => o.confirmationStatus === 'not_called').length,
    totalValue: orders.reduce((sum, o) => sum + Number(o.total), 0),
  };

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
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                : activeFilterCount > 0
                  ? 'border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10'
                  : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
            }`}
          >
            <FilterIcon className="w-4 h-4" />
            {t('stock.common.filters')}
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
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
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <span className="text-sm text-blue-400">Filtered by client</span>
          <button
            onClick={clearClientFilter}
            className="ml-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <CloseIcon className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.totalOrders')}</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.pending')}</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.needCalling')}</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.notCalled}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{t('stock.orders.stat.totalValue')}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalValue.toLocaleString()} <span className="text-sm text-zinc-400">DA</span></p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-1 inline-flex flex-wrap gap-1">
        {ORDER_STATUSES.map((s) => {
          const count = s.value ? orders.filter((o) => o.status === s.value).length : total;
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
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">{orders.length}</span>
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
            <div className="flex items-center gap-2">
              {statusTab === 'pending' && (
                <button
                  onClick={() => handleBulkStatus('confirmed')}
                  disabled={bulkProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkProcessing ? 'Processing…' : 'Confirm all'}
                </button>
              )}
              {statusTab === 'confirmed' && (
                <button
                  onClick={() => handleBulkStatus('preparing')}
                  disabled={bulkProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkProcessing ? 'Processing…' : 'Start preparing all'}
                </button>
              )}
              {statusTab === 'preparing' && (
                <button
                  onClick={() => handleBulkStatus('shipped')}
                  disabled={bulkProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkProcessing ? 'Processing…' : 'Ship all'}
                </button>
              )}
              {statusTab === 'shipped' && (
                <button
                  onClick={() => handleBulkStatus('delivered')}
                  disabled={bulkProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkProcessing ? 'Processing…' : 'Mark all delivered'}
                </button>
              )}
              <button
                onClick={() => handleBulkStatus('cancelled')}
                disabled={bulkProcessing}
                className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel all
              </button>
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
                    action.tone === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : action.tone === 'blue' ? 'bg-blue-500 hover:bg-blue-400 text-white'
                      : action.tone === 'amber' ? 'bg-amber-500 hover:bg-amber-400 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-zinc-200';
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors border-l-[3px] ${accent} ${
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
                          <span className="ms-1.5 text-[9px] text-violet-300 bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">AI</span>
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
                      <td className="px-4 py-3 text-sm text-right text-emerald-400 whitespace-nowrap">
                        {Number(order.amountPaid).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-400 whitespace-nowrap">
                        {remaining > 0 ? `${remaining.toLocaleString()} DA` : '–'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={getConfirmVariant(order.confirmationStatus)}>
                          {getConfirmLabel(order.confirmationStatus)}
                          {order.callAttempts > 0 && ` (${order.callAttempts})`}
                        </Badge>
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
                          {order.status !== 'delivered' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setDeleteConfirm(order)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
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
          <Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
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
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  draftHasRemaining ? 'border-red-500 bg-red-500' : 'border-zinc-600'
                }`}>
                  {draftHasRemaining && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                  <span className="ml-1.5 text-blue-400 font-normal">
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
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
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
