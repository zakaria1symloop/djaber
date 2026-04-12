'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pagination, DatePicker } from '@/components/stock';
import { Badge } from '@/components/ui';
import {
  HistoryIcon, ArrowUpIcon, ArrowDownIcon, RefreshIcon, BoxIcon,
  SearchIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import {
  getStockMovements,
  getProducts,
  type StockMovement,
  type Product,
} from '@/lib/user-stock-api';

const LIMIT = 30;

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter panel
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftType, setDraftType] = useState('');
  const [draftProduct, setDraftProduct] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  // Applied
  const [appliedType, setAppliedType] = useState('');
  const [appliedProduct, setAppliedProduct] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [filterTrigger, setFilterTrigger] = useState(0);

  const activeFilterCount = [
    appliedType, appliedProduct, appliedStartDate, appliedEndDate,
  ].filter(Boolean).length;

  const draftDirty =
    draftType !== appliedType || draftProduct !== appliedProduct ||
    draftStartDate !== appliedStartDate || draftEndDate !== appliedEndDate;

  const applyFilters = () => {
    setAppliedType(draftType);
    setAppliedProduct(draftProduct);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const clearAllFilters = () => {
    setDraftType(''); setDraftProduct('');
    setDraftStartDate(''); setDraftEndDate('');
    setAppliedType(''); setAppliedProduct('');
    setAppliedStartDate(''); setAppliedEndDate('');
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const loadMovements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getStockMovements({
        type: appliedType || undefined,
        productId: appliedProduct || undefined,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
        limit: LIMIT,
        offset,
      });
      setMovements(res.movements);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }, [appliedType, appliedProduct, appliedStartDate, appliedEndDate, offset, filterTrigger]);

  const loadProducts = async () => {
    try {
      const res = await getProducts({ limit: 500 });
      setProducts(res.products);
    } catch {}
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  useEffect(() => {
    return () => { setFiltersOpen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'in':
        return (
          <Badge variant="success">
            <ArrowUpIcon className="w-3 h-3 mr-1 inline" /> In
          </Badge>
        );
      case 'out':
        return (
          <Badge variant="error">
            <ArrowDownIcon className="w-3 h-3 mr-1 inline" /> Out
          </Badge>
        );
      case 'adjustment':
        return (
          <Badge variant="info">
            <RefreshIcon className="w-3 h-3 mr-1 inline" /> Adjustment
          </Badge>
        );
      case 'return':
        return (
          <Badge variant="warning">
            <ArrowUpIcon className="w-3 h-3 mr-1 inline" /> Return
          </Badge>
        );
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  return (
    <div className="relative">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Stock Movements</h1>
          <p className="text-sm text-zinc-400 mt-1">Audit trail of all stock changes</p>
        </div>
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
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); setAppliedStartDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); setAppliedEndDate(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="To date" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse"><div className="h-64 bg-zinc-800 rounded-xl" /></div>
      ) : movements.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date / Time</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Product</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Type</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Quantity</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Reference</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mv) => (
                  <tr key={mv.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      <div>{new Date(mv.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-zinc-500">{new Date(mv.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{mv.product?.name || '-'}</span>
                      {mv.product?.sku && (
                        <span className="text-xs text-zinc-500 ml-2">{mv.product.sku}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getTypeBadge(mv.type)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      mv.type === 'in' || mv.type === 'return' ? 'text-emerald-400' :
                      mv.type === 'out' ? 'text-red-400' :
                      'text-white'
                    }`}>
                      {mv.type === 'in' || mv.type === 'return' ? '+' : mv.type === 'out' ? '-' : ''}{mv.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{mv.reference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{mv.reason || <span className="text-zinc-500">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center"><HistoryIcon className="w-16 h-16" /></div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Movements</h3>
          <p className="text-sm text-zinc-500">Stock movements will appear here when products are added, sold, or adjusted</p>
        </div>
      )}

      <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />
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
            {/* Movement Type */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Movement Type</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Types</option>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
                <option value="adjustment">Adjustment</option>
                <option value="return">Return</option>
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Product</label>
              <select
                value={draftProduct}
                onChange={(e) => setDraftProduct(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
