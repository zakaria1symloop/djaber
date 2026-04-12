'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, DatePicker, Pagination, RangeSlider } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  ClipboardIcon, SearchIcon, EyeIcon, TrashIcon, PlusIcon,
  PhoneIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import {
  getOrders, deleteOrder, addOrderCall,
  type Order, type OrderCall,
} from '@/lib/user-stock-api';

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

  // Modal state
  const [viewing, setViewing] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Call modal
  const [callingOrder, setCallingOrder] = useState<Order | null>(null);
  const [callResult, setCallResult] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [savingCall, setSavingCall] = useState(false);

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
        status: appliedStatus || undefined,
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
  }, [appliedStatus, appliedConfirm, appliedPayment, appliedStartDate, appliedEndDate, appliedTotalRange, appliedHasRemaining, appliedClientId, searchDebounced, offset, filterTrigger]);

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
      setViewing(null);
      setDeleteConfirm(null);
      setCallingOrder(null);
    }
    setFiltersOpen(!filtersOpen);
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed': return 'info';
      case 'dispatched': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'warning';
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
      case 'confirmed': return 'Confirmed';
      case 'no_answer': return 'No Answer';
      case 'rejected': return 'Rejected';
      default: return 'Not Called';
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

  const handleAddCall = async () => {
    if (!callingOrder || !callResult) return;
    try {
      setSavingCall(true);
      const res = await addOrderCall(callingOrder.id, {
        result: callResult,
        notes: callNotes || undefined,
      });
      setOrders(orders.map((o) => (o.id === callingOrder.id ? res.order : o)));
      if (viewing?.id === callingOrder.id) setViewing(res.order);
      setCallingOrder(null);
      setCallResult('');
      setCallNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save call');
    } finally {
      setSavingCall(false);
    }
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
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Orders</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} orders</p>
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
            Filters
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <Button onClick={() => router.push('/dashboard/stock/orders/new')} icon={<PlusIcon className="w-4 h-4" />}>
            New Order
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
          <p className="text-xs text-zinc-500">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Pending</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Need Calling</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.notCalled}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Total Value</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalValue.toLocaleString()} <span className="text-sm text-zinc-400">DA</span></p>
        </div>
      </div>

      {/* Search bar + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by order #, client, phone, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); setAppliedStartDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); setAppliedEndDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="To date" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>
      ) : orders.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Order #</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Client</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Items</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Paid</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Remaining</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Confirmation</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const remaining = Math.max(0, Number(order.total) - Number(order.amountPaid));
                  return (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white">{order.clientName}</p>
                          {order.clientPhone && <p className="text-xs text-zinc-500">{order.clientPhone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-zinc-400">{order.items.length}</td>
                      <td className="px-4 py-3 text-sm text-right text-white font-medium">
                        {Number(order.total).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-400">
                        {Number(order.amountPaid).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {remaining > 0 ? `${remaining.toLocaleString()} DA` : '-'}
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
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setCallingOrder(order)}
                            className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Log call"
                          >
                            <PhoneIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewing(order)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {order.status !== 'delivered' && (
                            <button
                              onClick={() => setDeleteConfirm(order)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete order"
                            >
                              <TrashIcon className="w-4 h-4" />
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

      {/* View Order Detail Modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={`Order ${viewing?.orderNumber || ''}`} size="lg">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Client</p>
                <p className="text-sm text-white">{viewing.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Phone</p>
                <p className="text-sm text-white">{viewing.clientPhone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Address</p>
                <p className="text-sm text-white">{viewing.clientAddress || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p className="text-sm text-white">{new Date(viewing.orderDate).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Status</p>
                <Badge variant={getStatusVariant(viewing.status)}>{viewing.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Payment</p>
                <Badge variant={getPaymentVariant(viewing.paymentStatus)}>{viewing.paymentStatus}</Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Confirmation</p>
                <Badge variant={getConfirmVariant(viewing.confirmationStatus)}>
                  {getConfirmLabel(viewing.confirmationStatus)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Source</p>
                <Badge variant={viewing.source === 'ai' ? 'info' : 'default'}>
                  {viewing.source === 'ai' ? 'AI Chat' : 'Manual'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Total</p>
                <p className="text-lg font-bold text-white">{Number(viewing.total).toLocaleString()} DA</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Paid</p>
                <p className="text-lg font-bold text-emerald-400">{Number(viewing.amountPaid).toLocaleString()} DA</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Remaining</p>
                <p className={`text-lg font-bold ${Number(viewing.total) - Number(viewing.amountPaid) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Math.max(0, Number(viewing.total) - Number(viewing.amountPaid)).toLocaleString()} DA
                </p>
              </div>
            </div>

            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Qty</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Price</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewing.items.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-4 py-2 text-sm text-white">
                        {item.productName}
                        {item.variantName && <span className="text-xs text-zinc-500 ml-1.5">({item.variantName})</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right text-zinc-400">{Number(item.unitPrice).toLocaleString()} DA</td>
                      <td className="px-4 py-2 text-sm text-right text-white">{Number(item.total).toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {viewing.calls && viewing.calls.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Call History ({viewing.callAttempts} attempt{viewing.callAttempts !== 1 ? 's' : ''})</p>
                <div className="space-y-2">
                  {viewing.calls.map((call) => (
                    <div key={call.id} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        call.result === 'picked_up' ? 'bg-emerald-500/20 text-emerald-400'
                          : call.result === 'rejected' ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <PhoneIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium capitalize">{call.result.replace('_', ' ')}</span>
                          <span className="text-xs text-zinc-500">{new Date(call.calledAt).toLocaleString()}</span>
                        </div>
                        {call.notes && <p className="text-xs text-zinc-400 mt-0.5">{call.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewing.notes && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-400">{viewing.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setCallingOrder(viewing); setViewing(null); }}
                icon={<PhoneIcon className="w-4 h-4" />}
              >
                Log Call
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Call Logging Modal */}
      <Modal isOpen={!!callingOrder} onClose={() => { setCallingOrder(null); setCallResult(''); setCallNotes(''); }} title={`Log Call — ${callingOrder?.orderNumber || ''}`} size="sm">
        {callingOrder && (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-sm text-white font-medium">{callingOrder.clientName}</p>
              {callingOrder.clientPhone && (
                <p className="text-sm text-blue-400 mt-0.5">{callingOrder.clientPhone}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-2">Call Result *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'picked_up', label: 'Picked Up', color: 'emerald' },
                  { value: 'no_answer', label: 'No Answer', color: 'amber' },
                  { value: 'busy', label: 'Busy', color: 'amber' },
                  { value: 'rejected', label: 'Rejected', color: 'red' },
                  { value: 'voicemail', label: 'Voicemail', color: 'zinc' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCallResult(opt.value)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      callResult === opt.value
                        ? opt.color === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : opt.color === 'red' ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : opt.color === 'amber' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300'
                        : 'bg-black border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Notes / Client Response</label>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="What did the client say?"
                rows={3}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setCallingOrder(null); setCallResult(''); setCallNotes(''); }}
                disabled={savingCall}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleAddCall}
                disabled={savingCall || !callResult}
              >
                {savingCall ? 'Saving...' : 'Save Call'}
              </Button>
            </div>
          </div>
        )}
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
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
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
