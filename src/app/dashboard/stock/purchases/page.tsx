'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal, Select, Pagination, StatsCard, DatePicker, RangeSlider } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  PlusIcon, TruckIcon, DollarIcon, AlertIcon, BoxIcon, EyeIcon, TrashIcon, SearchIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import {
  getPurchases,
  getPurchaseStats,
  getSuppliers,
  updatePurchase,
  receivePurchaseItems,
  getPurchase,
  deletePurchase,
  type Purchase,
  type Supplier,
} from '@/lib/user-stock-api';

const LIMIT = 20;
const DEFAULT_TOTAL_MAX = 1000000;

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>}>
      <PurchasesPageInner />
    </Suspense>
  );
}

function PurchasesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams.get('supplierId') || '';
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<{
    totalPurchases: number; totalSpent: number; pendingPurchases: number; receivedPurchases: number;
  } | null>(null);

  // Toolbar filters
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Filter panel
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftStatus, setDraftStatus] = useState('');
  const [draftPayment, setDraftPayment] = useState('');
  const [draftSupplier, setDraftSupplier] = useState(initialSupplierId);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [draftTotalRange, setDraftTotalRange] = useState<[number, number]>([0, DEFAULT_TOTAL_MAX]);
  const [draftHasRemaining, setDraftHasRemaining] = useState(false);

  // Applied filters
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedPayment, setAppliedPayment] = useState('');
  const [appliedSupplier, setAppliedSupplier] = useState(initialSupplierId);
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedTotalRange, setAppliedTotalRange] = useState<[number, number]>([0, DEFAULT_TOTAL_MAX]);
  const [appliedHasRemaining, setAppliedHasRemaining] = useState(false);
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modals
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [showReceive, setShowReceive] = useState<Purchase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Receive form
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; receivedQty: number }[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setSearchDebounced(search); setOffset(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Active filter count
  const activeFilterCount = [
    appliedStatus, appliedPayment, appliedSupplier, appliedStartDate, appliedEndDate,
    appliedTotalRange[0] > 0 || appliedTotalRange[1] < DEFAULT_TOTAL_MAX ? 'x' : '',
    appliedHasRemaining ? 'x' : '',
  ].filter(Boolean).length;

  // Draft dirty check
  const draftDirty =
    draftStatus !== appliedStatus || draftPayment !== appliedPayment ||
    draftSupplier !== appliedSupplier || draftStartDate !== appliedStartDate ||
    draftEndDate !== appliedEndDate ||
    draftTotalRange[0] !== appliedTotalRange[0] || draftTotalRange[1] !== appliedTotalRange[1] ||
    draftHasRemaining !== appliedHasRemaining;

  const applyFilters = () => {
    setAppliedStatus(draftStatus);
    setAppliedPayment(draftPayment);
    setAppliedSupplier(draftSupplier);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setAppliedTotalRange([...draftTotalRange]);
    setAppliedHasRemaining(draftHasRemaining);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const clearAllFilters = () => {
    setDraftStatus(''); setDraftPayment(''); setDraftSupplier('');
    setDraftStartDate(''); setDraftEndDate('');
    setDraftTotalRange([0, DEFAULT_TOTAL_MAX]);
    setDraftHasRemaining(false);
    setAppliedStatus(''); setAppliedPayment(''); setAppliedSupplier('');
    setAppliedStartDate(''); setAppliedEndDate('');
    setAppliedTotalRange([0, DEFAULT_TOTAL_MAX]);
    setAppliedHasRemaining(false);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPurchases({
        status: appliedStatus || undefined,
        paymentStatus: appliedPayment || undefined,
        supplierId: appliedSupplier || undefined,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
        search: searchDebounced || undefined,
        minTotal: appliedTotalRange[0] > 0 ? appliedTotalRange[0] : undefined,
        maxTotal: appliedTotalRange[1] < DEFAULT_TOTAL_MAX ? appliedTotalRange[1] : undefined,
        hasRemaining: appliedHasRemaining || undefined,
        limit: LIMIT,
        offset,
      });
      setPurchases(res.purchases);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [appliedStatus, appliedPayment, appliedSupplier, appliedStartDate, appliedEndDate, appliedTotalRange, appliedHasRemaining, searchDebounced, offset, filterTrigger]);

  const loadStats = async () => {
    try {
      const res = await getPurchaseStats('month');
      setStats(res.stats);
    } catch {}
  };

  const loadSuppliers = async () => {
    try {
      const res = await getSuppliers();
      setSuppliers(res.suppliers);
    } catch {}
  };

  useEffect(() => { loadSuppliers(); loadStats(); }, []);
  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  // Open filter panel if supplierId is in URL
  useEffect(() => {
    if (initialSupplierId) {
      setFiltersOpen(true);
    }
    return () => { setFiltersOpen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFilters = () => {
    if (!filtersOpen) {
      setViewingPurchase(null);
      setShowReceive(null);
      setDeleteConfirm(null);
    }
    setFiltersOpen(!filtersOpen);
  };

  const viewPurchaseDetail = async (purchaseId: string) => {
    try {
      const res = await getPurchase(purchaseId);
      setViewingPurchase(res.purchase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase');
    }
  };

  const openReceive = (purchase: Purchase) => {
    setReceiveItems(
      purchase.items.map((item) => ({
        itemId: item.id,
        receivedQty: 0,
      }))
    );
    setShowReceive(purchase);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceive) return;
    const itemsToReceive = receiveItems.filter(i => i.receivedQty > 0);
    if (itemsToReceive.length === 0) { setError('Enter quantities to receive'); return; }
    try {
      setError(null);
      await receivePurchaseItems(showReceive.id, itemsToReceive);
      setShowReceive(null);
      loadPurchases();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive items');
    }
  };

  const handleUpdateStatus = async (purchaseId: string, data: { paymentStatus?: string; status?: string }) => {
    try {
      setError(null);
      await updatePurchase(purchaseId, data);
      if (viewingPurchase) {
        const res = await getPurchase(purchaseId);
        setViewingPurchase(res.purchase);
      }
      loadPurchases();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update purchase');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deletePurchase(deleteConfirm.id);
      setDeleteConfirm(null);
      setViewingPurchase(null);
      loadPurchases();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (purchase: Purchase) => {
    return purchase.status === 'pending' && purchase.paymentStatus !== 'paid';
  };

  return (
    <div className="relative">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Purchases</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} purchase orders</p>
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
          <Button onClick={() => router.push('/dashboard/stock/purchases/new')} icon={<PlusIcon className="w-4 h-4" />}>
            New Purchase
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Purchases" value={stats.totalPurchases} icon={<TruckIcon className="w-5 h-5" />} />
          <StatsCard title="Total Spent" value={`${stats.totalSpent.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-red-400" />
          <StatsCard title="Pending" value={stats.pendingPurchases} icon={<AlertIcon className="w-5 h-5" />} iconColor="text-amber-400" />
          <StatsCard title="Received" value={stats.receivedPurchases} icon={<BoxIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
        </div>
      )}

      {/* Search bar + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search purchases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); setAppliedStartDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); setAppliedEndDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="To date" />
        {/* Payment quick filter */}
        <div className="flex gap-1 ml-auto">
          {([
            { value: 'all', label: 'All' },
            { value: 'paid', label: 'Paid' },
            { value: 'remaining', label: 'Remaining' },
          ] as const).map(opt => {
            const isActive = opt.value === 'paid' ? (appliedPayment === 'paid' && !appliedHasRemaining)
              : opt.value === 'remaining' ? appliedHasRemaining
              : (!appliedPayment && !appliedHasRemaining);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === 'paid') {
                    setDraftPayment('paid'); setAppliedPayment('paid');
                    setDraftHasRemaining(false); setAppliedHasRemaining(false);
                  } else if (opt.value === 'remaining') {
                    setDraftPayment(''); setAppliedPayment('');
                    setDraftHasRemaining(true); setAppliedHasRemaining(true);
                  } else {
                    setDraftPayment(''); setAppliedPayment('');
                    setDraftHasRemaining(false); setAppliedHasRemaining(false);
                  }
                  setOffset(0); setFilterTrigger(t => t + 1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? opt.value === 'paid' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : opt.value === 'remaining' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'bg-white/10 text-white border border-white/20'
                    : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>
      ) : purchases.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">PO #</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Supplier</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Items</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Paid</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Remaining</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Payment</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{purchase.purchaseNumber}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{purchase.supplier?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center text-zinc-400">{purchase.items.length}</td>
                    <td className="px-4 py-3 text-sm text-right text-white font-medium">{Number(purchase.total).toLocaleString()} DA</td>
                    {/* Paid column - green */}
                    <td className="px-4 py-3 text-sm text-right font-medium text-emerald-400">
                      {purchase.paymentStatus === 'paid'
                        ? `${Number(purchase.total).toLocaleString()} DA`
                        : purchase.paymentStatus === 'partial'
                          ? <span className="text-emerald-400/70">Partial</span>
                          : '0 DA'}
                    </td>
                    {/* Remaining column - red */}
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-400">
                      {purchase.paymentStatus === 'paid'
                        ? '0 DA'
                        : purchase.paymentStatus === 'partial'
                          ? <span className="text-red-400/70">Partial</span>
                          : `${Number(purchase.total).toLocaleString()} DA`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={purchase.paymentStatus === 'paid' ? 'success' : 'warning'}>{purchase.paymentStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={purchase.status === 'received' ? 'success' : purchase.status === 'cancelled' ? 'error' : 'warning'}>
                        {purchase.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{new Date(purchase.purchaseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => viewPurchaseDetail(purchase.id)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {purchase.status !== 'received' && purchase.status !== 'cancelled' && (
                          <button
                            onClick={() => openReceive(purchase)}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                          >
                            Receive
                          </button>
                        )}
                        {canDelete(purchase) && (
                          <button
                            onClick={() => setDeleteConfirm(purchase)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center"><TruckIcon className="w-16 h-16" /></div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Purchases</h3>
          <p className="text-sm text-zinc-500 mb-4">Create your first purchase order</p>
          <Button onClick={() => router.push('/dashboard/stock/purchases/new')} icon={<PlusIcon className="w-4 h-4" />}>New Purchase</Button>
        </div>
      )}

      <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />

      {/* Purchase Detail Modal */}
      <Modal isOpen={!!viewingPurchase} onClose={() => setViewingPurchase(null)} title={`Purchase ${viewingPurchase?.purchaseNumber || ''}`} size="lg">
        {viewingPurchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Supplier</p>
                <p className="text-sm text-white">{viewingPurchase.supplier?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p className="text-sm text-white">{new Date(viewingPurchase.purchaseDate).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Status</p>
                <Badge variant={viewingPurchase.status === 'received' ? 'success' : 'warning'}>{viewingPurchase.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Payment</p>
                <Badge variant={viewingPurchase.paymentStatus === 'paid' ? 'success' : 'warning'}>{viewingPurchase.paymentStatus}</Badge>
              </div>
            </div>

            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Ordered</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Received</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Unit Cost</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPurchase.items.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-4 py-2 text-sm text-white">{item.productName}</td>
                      <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-center">
                        <span className={item.receivedQty >= item.quantity ? 'text-emerald-400' : 'text-amber-400'}>
                          {item.receivedQty}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-zinc-400">{Number(item.unitCost).toLocaleString()} DA</td>
                      <td className="px-4 py-2 text-sm text-right text-white">{Number(item.total).toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-zinc-800/50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-white">Total:</td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-white">{Number(viewingPurchase.total).toLocaleString()} DA</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center gap-2">
              {viewingPurchase.paymentStatus !== 'paid' && (
                <Button size="sm" onClick={() => handleUpdateStatus(viewingPurchase.id, { paymentStatus: 'paid' })}>
                  Mark as Paid
                </Button>
              )}
              {viewingPurchase.status !== 'received' && viewingPurchase.status !== 'cancelled' && (
                <Button size="sm" variant="outline" onClick={() => { setViewingPurchase(null); openReceive(viewingPurchase); }}>
                  Receive Items
                </Button>
              )}
            </div>

            {viewingPurchase.notes && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-400">{viewingPurchase.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Receive Items Modal */}
      <Modal isOpen={!!showReceive} onClose={() => setShowReceive(null)} title="Receive Items" size="lg">
        {showReceive && (
          <form onSubmit={handleReceive} className="space-y-4">
            <p className="text-sm text-zinc-400 mb-4">
              Enter the quantity received for each item. Stock will be updated automatically.
            </p>
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Ordered</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Already Received</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Receive Now</th>
                  </tr>
                </thead>
                <tbody>
                  {showReceive.items.map((item, index) => {
                    const remaining = item.quantity - item.receivedQty;
                    return (
                      <tr key={item.id} className="border-t border-white/5">
                        <td className="px-4 py-2 text-sm text-white">{item.productName}</td>
                        <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-center text-zinc-400">{item.receivedQty}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={receiveItems[index]?.receivedQty || 0}
                            onChange={(e) => {
                              const newItems = [...receiveItems];
                              newItems[index] = { ...newItems[index], receivedQty: parseInt(e.target.value) || 0 };
                              setReceiveItems(newItems);
                            }}
                            className="w-20 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-center"
                            disabled={remaining <= 0}
                          />
                          {remaining > 0 && (
                            <p className="text-xs text-zinc-500 mt-0.5">{remaining} remaining</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowReceive(null)}>Cancel</Button>
              <Button type="submit" className="flex-1">Receive Items</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Purchase" size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete purchase <span className="text-white font-medium">{deleteConfirm?.purchaseNumber}</span>?
        </p>
        <p className="text-amber-400 text-sm mb-4">
          This action cannot be undone.
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
          {/* Panel Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            <button onClick={() => setFiltersOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Fulfillment Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Fulfillment Status</label>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
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

            {/* Supplier */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Supplier</label>
              <select
                value={draftSupplier}
                onChange={(e) => setDraftSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Has Remaining Balance */}
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

          {/* Panel Footer */}
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
