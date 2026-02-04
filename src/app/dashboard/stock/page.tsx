'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/stock';
import {
  BoxIcon,
  AlertIcon,
  DollarIcon,
  TagIcon,
  UsersIcon,
  ShoppingCartIcon,
  TruckIcon,
  RefreshIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@/components/ui/icons';
import { Button } from '@/components/ui';
import {
  getStockDashboard,
  getSalesStats,
  getPurchaseStats,
  type StockDashboard,
} from '@/lib/user-stock-api';

export default function StockOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<StockDashboard | null>(null);
  const [salesStats, setSalesStats] = useState<{
    totalSales: number; totalRevenue: number; paidSales: number; pendingSales: number; averageOrderValue: number;
  } | null>(null);
  const [purchaseStats, setPurchaseStats] = useState<{
    totalPurchases: number; totalSpent: number; pendingPurchases: number; receivedPurchases: number;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashRes, salesRes, purchRes] = await Promise.all([
        getStockDashboard(),
        getSalesStats('month'),
        getPurchaseStats('month'),
      ]);
      setDashboard(dashRes);
      setSalesStats(salesRes.stats);
      setPurchaseStats(purchRes.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-zinc-800 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          {error}
          <Button variant="outline" size="sm" className="ml-4" onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Overview</h1>
          <p className="text-sm text-zinc-400 mt-1">Inventory, sales, and purchase summary</p>
        </div>
        <Button variant="outline" onClick={loadData} icon={<RefreshIcon className="w-4 h-4" />}>
          Refresh
        </Button>
      </div>

      {/* Primary Stats */}
      {dashboard && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Products"
              value={dashboard.stats.totalProducts}
              icon={<BoxIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Low Stock"
              value={dashboard.stats.lowStockProducts}
              icon={<AlertIcon className="w-5 h-5" />}
              iconColor="text-amber-400"
            />
            <StatsCard
              title="Stock Value"
              value={`${dashboard.stats.totalStockValue.toLocaleString()} DA`}
              icon={<DollarIcon className="w-5 h-5" />}
              iconColor="text-emerald-400"
            />
            <StatsCard
              title="Retail Value"
              value={`${dashboard.stats.totalRetailValue.toLocaleString()} DA`}
              icon={<DollarIcon className="w-5 h-5" />}
            />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Categories"
              value={dashboard.stats.totalCategories}
              icon={<TagIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Suppliers"
              value={dashboard.stats.totalSuppliers}
              icon={<UsersIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Items in Stock"
              value={dashboard.stats.totalItems}
              icon={<BoxIcon className="w-5 h-5" />}
            />
          </div>
        </>
      )}

      {/* Sales Summary */}
      {salesStats && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Sales This Month</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Sales"
              value={salesStats.totalSales}
              icon={<ShoppingCartIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Revenue"
              value={`${salesStats.totalRevenue.toLocaleString()} DA`}
              icon={<DollarIcon className="w-5 h-5" />}
              iconColor="text-emerald-400"
            />
            <StatsCard
              title="Paid"
              value={salesStats.paidSales}
              icon={<DollarIcon className="w-5 h-5" />}
              iconColor="text-emerald-400"
            />
            <StatsCard
              title="Pending"
              value={salesStats.pendingSales}
              icon={<AlertIcon className="w-5 h-5" />}
              iconColor="text-amber-400"
            />
          </div>
        </div>
      )}

      {/* Purchase Summary */}
      {purchaseStats && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Purchases This Month</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Purchases"
              value={purchaseStats.totalPurchases}
              icon={<TruckIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Spent"
              value={`${purchaseStats.totalSpent.toLocaleString()} DA`}
              icon={<DollarIcon className="w-5 h-5" />}
              iconColor="text-red-400"
            />
            <StatsCard
              title="Pending"
              value={purchaseStats.pendingPurchases}
              icon={<AlertIcon className="w-5 h-5" />}
              iconColor="text-amber-400"
            />
            <StatsCard
              title="Received"
              value={purchaseStats.receivedPurchases}
              icon={<BoxIcon className="w-5 h-5" />}
              iconColor="text-emerald-400"
            />
          </div>
        </div>
      )}

      {/* Recent Movements */}
      {dashboard && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Recent Movements</h2>
          {dashboard.recentMovements.length > 0 ? (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Product</th>
                      <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Type</th>
                      <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Quantity</th>
                      <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentMovements.slice(0, 10).map((mv) => (
                      <tr key={mv.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {new Date(mv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">
                          {mv.product?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            mv.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' :
                            mv.type === 'out' ? 'bg-red-500/10 text-red-400' :
                            'bg-blue-500/10 text-blue-400'
                          }`}>
                            {mv.type === 'in' && <ArrowUpIcon className="w-3 h-3" />}
                            {mv.type === 'out' && <ArrowDownIcon className="w-3 h-3" />}
                            {mv.type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${
                          mv.type === 'in' ? 'text-emerald-400' :
                          mv.type === 'out' ? 'text-red-400' :
                          'text-white'
                        }`}>
                          {mv.type === 'in' ? '+' : mv.type === 'out' ? '-' : ''}{mv.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {mv.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-sm text-zinc-500">No movements recorded yet. Stock movements will appear here when products are added, sold, or adjusted.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
