'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Select, Pagination, StatsCard } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  PlusIcon, ShoppingCartIcon, DollarIcon, AlertIcon, EyeIcon, TrashIcon, EditIcon,
} from '@/components/ui/icons';
import {
  getSales,
  getSalesStats,
  updateSalePayment,
  getSale,
  deleteSale,
  type Sale,
} from '@/lib/user-stock-api';

const LIMIT = 20;

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

  // Filters
  const [paymentFilter, setPaymentFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Modals
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSales({
        paymentStatus: paymentFilter || undefined,
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
  }, [paymentFilter, offset]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getSalesStats(periodFilter);
      setStats(res.stats);
    } catch {
      // stats are non-critical
    }
  }, [periodFilter]);

  useEffect(() => { loadSales(); }, [loadSales]);
  useEffect(() => { loadStats(); }, [loadStats]);

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

  // Calculate paid amount (total - remaining based on payment status)
  const getPaidAmount = (sale: Sale) => {
    if (sale.paymentStatus === 'paid') return Number(sale.total);
    if (sale.paymentStatus === 'pending') return 0;
    // partial: we don't have exact paid amount from API, show as partial indicator
    return 0; // Will show as "Partial" for partial status
  };

  const getRemainingAmount = (sale: Sale) => {
    if (sale.paymentStatus === 'paid') return 0;
    if (sale.paymentStatus === 'pending') return Number(sale.total);
    // partial
    return Number(sale.total); // Full amount as remaining indicator for partial
  };

  const canDelete = (sale: Sale) => {
    return sale.paymentStatus !== 'paid';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} sales</p>
        </div>
        <Button onClick={() => router.push('/dashboard/stock/sales/new')} icon={<PlusIcon className="w-4 h-4" />}>
          New Sale
        </Button>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setOffset(0); }} className="w-auto min-w-[160px]">
          <option value="">All Payments</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
        </Select>
        <Select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as any)} className="w-auto min-w-[140px]">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </Select>
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
                {sales.map((sale) => {
                  const paid = getPaidAmount(sale);
                  const remaining = getRemainingAmount(sale);
                  return (
                    <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{sale.saleNumber}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{sale.customerName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center text-zinc-400">{sale.items.length}</td>
                      <td className="px-4 py-3 text-sm text-right text-white font-medium">{Number(sale.total).toLocaleString()} DA</td>
                      {/* Paid column - green */}
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-400">
                        {sale.paymentStatus === 'paid'
                          ? `${Number(sale.total).toLocaleString()} DA`
                          : sale.paymentStatus === 'partial'
                            ? <span className="text-emerald-400/70">Partial</span>
                            : '0 DA'}
                      </td>
                      {/* Remaining column - red */}
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
                  );
                })}
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

            {/* Items */}
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

            {/* Payment Status Update */}
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
  );
}
