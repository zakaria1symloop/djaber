'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Pagination, StatsCard, DatePicker, RangeSlider } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  PlusIcon, ShoppingCartIcon, DollarIcon, AlertIcon, EyeIcon, TrashIcon, EditIcon,
  SearchIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import {
  getSales,
  getSalesStats,
  updateSalePayment,
  getSale,
  deleteSale,
  type Sale,
} from '@/lib/user-stock-api';

const LIMIT = 20;
const DEFAULT_TOTAL_MAX = 1000000;

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<{
    totalSales: number; totalRevenue: number; averageOrderValue: number; pendingSales: number;
  } | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Search
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Filter panel
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftPayment, setDraftPayment] = useState('');
  const [draftMethod, setDraftMethod] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [draftTotalRange, setDraftTotalRange] = useState<[number, number]>([0, DEFAULT_TOTAL_MAX]);
  const [draftHasRemaining, setDraftHasRemaining] = useState(false);

  // Applied filters
  const [appliedPayment, setAppliedPayment] = useState('');
  const [appliedMethod, setAppliedMethod] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedTotalRange, setAppliedTotalRange] = useState<[number, number]>([0, DEFAULT_TOTAL_MAX]);
  const [appliedHasRemaining, setAppliedHasRemaining] = useState(false);
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modals
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setSearchDebounced(search); setOffset(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeFilterCount = [
    appliedPayment, appliedMethod, appliedStartDate, appliedEndDate,
    appliedTotalRange[0] > 0 || appliedTotalRange[1] < DEFAULT_TOTAL_MAX ? 'x' : '',
    appliedHasRemaining ? 'x' : '',
  ].filter(Boolean).length;

  const draftDirty =
    draftPayment !== appliedPayment || draftMethod !== appliedMethod ||
    draftStartDate !== appliedStartDate || draftEndDate !== appliedEndDate ||
    draftTotalRange[0] !== appliedTotalRange[0] || draftTotalRange[1] !== appliedTotalRange[1] ||
    draftHasRemaining !== appliedHasRemaining;

  const applyFilters = () => {
    setAppliedPayment(draftPayment);
    setAppliedMethod(draftMethod);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setAppliedTotalRange([...draftTotalRange]);
    setAppliedHasRemaining(draftHasRemaining);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const clearAllFilters = () => {
    setDraftPayment(''); setDraftMethod('');
    setDraftStartDate(''); setDraftEndDate('');
    setDraftTotalRange([0, DEFAULT_TOTAL_MAX]);
    setDraftHasRemaining(false);
    setAppliedPayment(''); setAppliedMethod('');
    setAppliedStartDate(''); setAppliedEndDate('');
    setAppliedTotalRange([0, DEFAULT_TOTAL_MAX]);
    setAppliedHasRemaining(false);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSales({
        paymentStatus: appliedPayment || undefined,
        paymentMethod: appliedMethod || undefined,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
        search: searchDebounced || undefined,
        minTotal: appliedTotalRange[0] > 0 ? appliedTotalRange[0] : undefined,
        maxTotal: appliedTotalRange[1] < DEFAULT_TOTAL_MAX ? appliedTotalRange[1] : undefined,
        hasRemaining: appliedHasRemaining || undefined,
        limit: LIMIT,
        offset,
      });
      setSales(res.sales);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [appliedPayment, appliedMethod, appliedStartDate, appliedEndDate, appliedTotalRange, appliedHasRemaining, searchDebounced, offset, filterTrigger]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getSalesStats(periodFilter);
      setStats(res.stats);
    } catch {}
  }, [periodFilter]);

  useEffect(() => { loadSales(); }, [loadSales]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    return () => { setFiltersOpen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFilters = () => {
    if (!filtersOpen) {
      setViewingSale(null);
      setDeleteConfirm(null);
    }
    setFiltersOpen(!filtersOpen);
  };

  const viewSaleDetail = async (saleId: string) => {
    try {
      const res = await getSale(saleId);
      setViewingSale(res.sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sale');
    }
  };

  const handleUpdatePayment = async (saleId: string, paymentStatus: string) => {
    try {
      setError(null);
      await updateSalePayment(saleId, { paymentStatus });
      if (viewingSale) {
        const res = await getSale(saleId);
        setViewingSale(res.sale);
      }
      loadSales();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteSale(deleteConfirm.id);
      setDeleteConfirm(null);
      setViewingSale(null);
      loadSales();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (sale: Sale) => sale.paymentStatus !== 'paid';

  return (
    <div className="relative">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} sales</p>
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
          <Button onClick={() => router.push('/dashboard/stock/sales/new')} icon={<PlusIcon className="w-4 h-4" />}>
            New Sale
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
          <StatsCard title="Total Sales" value={stats.totalSales} icon={<ShoppingCartIcon className="w-5 h-5" />} />
          <StatsCard title="Revenue" value={`${stats.totalRevenue.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
          <StatsCard title="Avg Order Value" value={`${stats.averageOrderValue.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} />
          <StatsCard title="Pending" value={stats.pendingSales} icon={<AlertIcon className="w-5 h-5" />} iconColor="text-amber-400" />
        </div>
      )}

      {/* Search bar + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sales..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); setAppliedStartDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); setAppliedEndDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="To date" />
        {/* Payment quick filter */}
        <div className="flex gap-1">
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
        {/* Period selector for stats */}
        <div className="flex gap-1">
          {(['today', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                periodFilter === p
                  ? 'bg-white text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>
      ) : sales.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Sale #</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Customer</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Items</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Paid</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Remaining</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Payment</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Method</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{sale.saleNumber}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{sale.customerName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center text-zinc-400">{sale.items.length}</td>
                    <td className="px-4 py-3 text-sm text-right text-white font-medium">{Number(sale.total).toLocaleString()} DA</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-emerald-400">
                      {sale.paymentStatus === 'paid'
                        ? `${Number(sale.total).toLocaleString()} DA`
                        : sale.paymentStatus === 'partial'
                          ? <span className="text-emerald-400/70">Partial</span>
                          : '0 DA'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-400">
                      {sale.paymentStatus === 'paid'
                        ? '0 DA'
                        : sale.paymentStatus === 'partial'
                          ? <span className="text-red-400/70">Partial</span>
                          : `${Number(sale.total).toLocaleString()} DA`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={sale.paymentStatus === 'paid' ? 'success' : sale.paymentStatus === 'pending' ? 'warning' : 'info'}>
                        {sale.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-zinc-400 capitalize">{sale.paymentMethod}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{new Date(sale.saleDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => viewSaleDetail(sale.id)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {canDelete(sale) && (
                          <button
                            onClick={() => setDeleteConfirm(sale)}
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
          <div className="text-zinc-600 mb-4 flex justify-center"><ShoppingCartIcon className="w-16 h-16" /></div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Sales</h3>
          <p className="text-sm text-zinc-500 mb-4">Record your first sale</p>
          <Button onClick={() => router.push('/dashboard/stock/sales/new')} icon={<PlusIcon className="w-4 h-4" />}>New Sale</Button>
        </div>
      )}

      <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />

      {/* Sale Detail Modal */}
      <Modal isOpen={!!viewingSale} onClose={() => setViewingSale(null)} title={`Sale ${viewingSale?.saleNumber || ''}`} size="lg">
        {viewingSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Customer</p>
                <p className="text-sm text-white">{viewingSale.customerName || 'Walk-in'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Phone</p>
                <p className="text-sm text-white">{viewingSale.customerPhone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p className="text-sm text-white">{new Date(viewingSale.saleDate).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Payment Method</p>
                <p className="text-sm text-white capitalize">{viewingSale.paymentMethod}</p>
              </div>
            </div>

            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Qty</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Price</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Discount</th>
                    <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingSale.items.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-4 py-2 text-sm text-white">{item.productName}</td>
                      <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right text-zinc-400">{Number(item.unitPrice).toLocaleString()} DA</td>
                      <td className="px-4 py-2 text-sm text-right text-zinc-400">{Number(item.discount).toLocaleString()} DA</td>
                      <td className="px-4 py-2 text-sm text-right text-white">{Number(item.total).toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-zinc-800/50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-white">Total:</td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-emerald-400">{Number(viewingSale.total).toLocaleString()} DA</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Payment Status</p>
                <Badge variant={viewingSale.paymentStatus === 'paid' ? 'success' : viewingSale.paymentStatus === 'pending' ? 'warning' : 'info'}>
                  {viewingSale.paymentStatus}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {viewingSale.paymentStatus !== 'paid' && (
                  <Button size="sm" onClick={() => handleUpdatePayment(viewingSale.id, 'paid')}>
                    Mark as Paid
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setViewingSale(null); router.push(`/dashboard/stock/sales/${viewingSale.id}/edit`); }}>
                  <EditIcon className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </div>
            </div>

            {viewingSale.notes && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-400">{viewingSale.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Sale" size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete sale <span className="text-white font-medium">{deleteConfirm?.saleNumber}</span>?
        </p>
        <p className="text-amber-400 text-sm mb-4">
          This action cannot be undone. Stock quantities will be restored.
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

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Payment Method</label>
              <select
                value={draftMethod}
                onChange={(e) => setDraftMethod(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="check">Check</option>
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
