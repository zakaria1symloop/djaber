'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Select, Pagination, StatsCard } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  PlusIcon, TruckIcon, DollarIcon, AlertIcon, BoxIcon, EyeIcon, TrashIcon,
} from '@/components/ui/icons';
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

export default function PurchasesPage() {
  const router = useRouter();
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

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  // Modals
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [showReceive, setShowReceive] = useState<Purchase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Receive form
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; receivedQty: number }[]>([]);

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPurchases({
        status: statusFilter || undefined,
        supplierId: supplierFilter || undefined,
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
  }, [statusFilter, supplierFilter, offset]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Purchases</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} purchase orders</p>
        </div>
        <Button onClick={() => router.push('/dashboard/stock/purchases/new')} icon={<PlusIcon className="w-4 h-4" />}>
          New Purchase
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
          <StatsCard title="Total Purchases" value={stats.totalPurchases} icon={<TruckIcon className="w-5 h-5" />} />
          <StatsCard title="Total Spent" value={`${stats.totalSpent.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-red-400" />
          <StatsCard title="Pending" value={stats.pendingPurchases} icon={<AlertIcon className="w-5 h-5" />} iconColor="text-amber-400" />
          <StatsCard title="Received" value={stats.receivedPurchases} icon={<BoxIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }} className="w-auto min-w-[160px]">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setOffset(0); }} className="w-auto min-w-[160px]">
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
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
  );
}
