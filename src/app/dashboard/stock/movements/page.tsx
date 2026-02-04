'use client';

import { useEffect, useState, useCallback } from 'react';
import { Select, Pagination } from '@/components/stock';
import { Badge } from '@/components/ui';
import {
  HistoryIcon, ArrowUpIcon, ArrowDownIcon, RefreshIcon, BoxIcon,
} from '@/components/ui/icons';
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

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadMovements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getStockMovements({
        type: typeFilter || undefined,
        productId: productFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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
  }, [typeFilter, productFilter, startDate, endDate, offset]);

  const loadProducts = async () => {
    try {
      const res = await getProducts({ limit: 500 });
      setProducts(res.products);
    } catch (err) {}
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadMovements(); }, [loadMovements]);

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

  const getReasonBadge = (reason: string | null) => {
    if (!reason) return <span className="text-zinc-500">-</span>;
    return <span className="text-zinc-400">{reason}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Stock Movements</h1>
        <p className="text-sm text-zinc-400 mt-1">Audit trail of all stock changes</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }} className="w-auto min-w-[160px]">
          <option value="">All Types</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
          <option value="adjustment">Adjustment</option>
          <option value="return">Return</option>
        </Select>
        <Select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setOffset(0); }} className="w-auto min-w-[200px]">
          <option value="">All Products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
            className="px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
            className="px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setOffset(0); }}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
          >
            Clear dates
          </button>
        )}
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
                    <td className="px-4 py-3 text-sm">{getReasonBadge(mv.reason)}</td>
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
  );
}
