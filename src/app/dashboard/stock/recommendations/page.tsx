'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Badge } from '@/components/ui';
import {
  SearchIcon, TrashIcon, BoltIcon, RefreshIcon, ChartIcon, EyeIcon, ShoppingCartIcon, CloseIcon,
} from '@/components/ui/icons';
import {
  getRecommendations,
  getRecommendationStats,
  generateRecommendations,
  updateRecommendation,
  deleteRecommendation,
  type ProductRecommendation,
  type RecommendationStats,
} from '@/lib/user-stock-api';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [stats, setStats] = useState<RecommendationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'cross_sell' | 'up_sell'>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.isActive = statusFilter;
      const [recs, st] = await Promise.all([
        getRecommendations(params),
        getRecommendationStats(),
      ]);
      setRecommendations(recs);
      setStats(st);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result = await generateRecommendations();
      setError(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate recommendations');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (rec: ProductRecommendation) => {
    try {
      await updateRecommendation(rec.id, { isActive: !rec.isActive });
      setRecommendations(prev =>
        prev.map(r => r.id === rec.id ? { ...r, isActive: !r.isActive } : r)
      );
      // Update stats
      setStats(prev => prev ? {
        ...prev,
        active: prev.active + (rec.isActive ? -1 : 1),
      } : prev);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecommendation(id);
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setStats(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const formatPrice = (price: number) => {
    return Number(price).toLocaleString('fr-DZ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BoltIcon className="w-7 h-7 text-amber-400" />
            Cross-Sell / Up-Sell
          </h1>
          <p className="text-zinc-400 mt-1">
            AI-powered product recommendations to boost sales
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-60"
        >
          <RefreshIcon className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Analyzing...' : 'Generate Recommendations'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <BoltIcon className="w-4 h-4" />
              Total Rules
            </div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-zinc-500 mt-1">{stats.active} active</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <EyeIcon className="w-4 h-4" />
              Impressions
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalImpressions.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">times shown</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <ShoppingCartIcon className="w-4 h-4" />
              Conversions
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalConversions.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">{stats.conversionRate}% rate</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <ChartIcon className="w-4 h-4" />
              Revenue
            </div>
            <div className="text-2xl font-bold text-emerald-400">{formatPrice(stats.totalRevenue)} DA</div>
            <div className="text-xs text-zinc-500 mt-1">from cross-sell</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          {[
            { value: '', label: 'All Types' },
            { value: 'cross_sell', label: 'Cross-Sell' },
            { value: 'up_sell', label: 'Up-Sell' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value as any)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                typeFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          {[
            { value: '', label: 'All' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value as any)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <BoltIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No recommendations yet</h3>
          <p className="text-zinc-400 mb-6 max-w-md mx-auto">
            Click "Generate Recommendations" to analyze your products and order history.
            The AI will find cross-sell and up-sell opportunities automatically.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium px-6 py-2.5 rounded-lg inline-flex items-center gap-2"
          >
            <RefreshIcon className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Analyzing...' : 'Generate Now'}
          </Button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="text-left px-4 py-3 font-medium">Source Product</th>
                  <th className="text-left px-4 py-3 font-medium">Recommended</th>
                  <th className="text-center px-4 py-3 font-medium">Type</th>
                  <th className="text-center px-4 py-3 font-medium">Score</th>
                  <th className="text-center px-4 py-3 font-medium">Impressions</th>
                  <th className="text-center px-4 py-3 font-medium">Conversions</th>
                  <th className="text-center px-4 py-3 font-medium">Revenue</th>
                  <th className="text-center px-4 py-3 font-medium">Active</th>
                  <th className="text-center px-4 py-3 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => {
                  const convRate = rec.impressions > 0
                    ? Math.round((rec.conversions / rec.impressions) * 10000) / 100
                    : 0;
                  return (
                    <tr
                      key={rec.id}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                        !rec.isActive ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Source Product */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{rec.product.name}</div>
                        <div className="text-xs text-zinc-500">{formatPrice(Number(rec.product.sellingPrice))} DA</div>
                      </td>
                      {/* Recommended Product */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{rec.recommended.name}</div>
                        <div className="text-xs text-zinc-500">{formatPrice(Number(rec.recommended.sellingPrice))} DA</div>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          rec.type === 'up_sell'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {rec.type === 'up_sell' ? 'Up-Sell' : 'Cross-Sell'}
                        </span>
                      </td>
                      {/* Score */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                              style={{ width: `${Math.round(rec.score * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 w-8">{Math.round(rec.score * 100)}%</span>
                        </div>
                      </td>
                      {/* Impressions */}
                      <td className="px-4 py-3 text-center text-zinc-300">{rec.impressions.toLocaleString()}</td>
                      {/* Conversions */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-zinc-300">{rec.conversions}</span>
                        {convRate > 0 && (
                          <span className="text-xs text-emerald-400 ml-1">({convRate}%)</span>
                        )}
                      </td>
                      {/* Revenue */}
                      <td className="px-4 py-3 text-center text-emerald-400 font-medium">
                        {Number(rec.revenue) > 0 ? `${formatPrice(Number(rec.revenue))} DA` : '-'}
                      </td>
                      {/* Active Toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(rec)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            rec.isActive ? 'bg-emerald-500' : 'bg-zinc-600'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              rec.isActive ? 'left-5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </td>
                      {/* Delete */}
                      <td className="px-4 py-3 text-center">
                        {deleteConfirm === rec.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(rec.id)}
                              className="text-red-400 hover:text-red-300 text-xs font-medium"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-zinc-400 hover:text-zinc-300 text-xs"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(rec.id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-4 py-3 border-t border-zinc-800 text-sm text-zinc-400">
            Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
            {recommendations.some(r => r.reason) && (
              <span className="ml-2 text-zinc-500">
                — hover over scores to see reasoning
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
