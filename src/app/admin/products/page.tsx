'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listAdminProducts,
  listAdminLookupCategories,
  listAdminUsers,
  type AdminProduct,
  type AdminLookupCategory,
  type AdminUser,
} from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui';
import {
  SearchIcon,
  RefreshIcon,
  BoxIcon,
  AlertIcon,
  ImageIcon,
} from '@/components/ui/icons';
import { FilterPanel, FilterPanelTrigger, FilterSection, FilterChip } from '@/components/admin/FilterPanel';
import { SkeletonTable } from '@/components/ui/Loader';

export default function AdminProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'in-stock'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryId, setCategoryId] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [hasImageFilter, setHasImageFilter] = useState<'all' | 'with' | 'without'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [minMargin, setMinMargin] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'sellingPrice' | 'quantity'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [categories, setCategories] = useState<AdminLookupCategory[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [userFilterId, setUserFilterId] = useState('');
  const [userFilterSearch, setUserFilterSearch] = useState('');

  // Load categories + users for filter dropdowns
  useEffect(() => {
    listAdminLookupCategories().then((res) => setCategories(res.categories)).catch(() => {});
    listAdminUsers({ limit: 500 }).then((res) => setAllUsers(res.users)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listAdminProducts({
        search: debouncedSearch || undefined,
        lowStock: stockFilter === 'low' || undefined,
        categoryId: categoryId || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        minStock: minStock ? Number(minStock) : undefined,
        maxStock: maxStock ? Number(maxStock) : undefined,
        hasImage: hasImageFilter === 'all' ? undefined : hasImageFilter === 'with',
        userId: userFilterId || undefined,
        limit: 100,
      });
      setProducts(res.products);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, stockFilter, statusFilter, categoryId, minPrice, maxPrice, minStock, maxStock, hasImageFilter, userFilterId]);

  const filtered = useMemo(() => {
    const owner = ownerSearch.trim().toLowerCase();
    let result = products.filter((p) => {
      if (stockFilter === 'in-stock' && p.isLowStock) return false;
      if (owner) {
        const o = p.owner;
        if (!o) return false;
        const match =
          o.email.toLowerCase().includes(owner) ||
          o.firstName.toLowerCase().includes(owner) ||
          o.lastName.toLowerCase().includes(owner);
        if (!match) return false;
      }
      if (minMargin) {
        const cost = Number(p.costPrice) || 0;
        const sell = Number(p.sellingPrice) || 0;
        const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
        if (margin < Number(minMargin)) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortBy) {
        case 'name': av = a.name; bv = b.name; break;
        case 'sellingPrice': av = Number(a.sellingPrice); bv = Number(b.sellingPrice); break;
        case 'quantity': av = a.quantity; bv = b.quantity; break;
        default: av = a.createdAt; bv = b.createdAt;
      }
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [products, stockFilter, ownerSearch, minMargin, sortBy, sortOrder]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (stockFilter !== 'all' ? 1 : 0) +
    (categoryId ? 1 : 0) +
    (ownerSearch.trim() ? 1 : 0) +
    (hasImageFilter !== 'all' ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (minStock ? 1 : 0) +
    (maxStock ? 1 : 0) +
    (minMargin ? 1 : 0) +
    (userFilterId ? 1 : 0) +
    (sortBy !== 'createdAt' || sortOrder !== 'desc' ? 1 : 0);

  const stats = useMemo(() => {
    const lowStock = products.filter((p) => p.isLowStock).length;
    const owners = new Set(products.map((p) => p.owner?.id).filter(Boolean)).size;
    const active = products.filter((p) => p.isActive).length;
    return { total, lowStock, owners, active };
  }, [products, total]);

  const clearFilters = () => {
    setStockFilter('all');
    setStatusFilter('all');
    setCategoryId('');
    setOwnerSearch('');
    setHasImageFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setMinStock('');
    setMaxStock('');
    setMinMargin('');
    setUserFilterId('');
    setUserFilterSearch('');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Products
          </h1>
          <p className="text-sm text-zinc-400">All products across every store on the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterPanelTrigger open={filterOpen} setOpen={setFilterOpen} activeCount={activeFilterCount} />
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Products" value={stats.total.toString()} />
        <StatCard label="Active" value={stats.active.toString()} />
        <StatCard label="Low Stock" value={stats.lowStock.toString()} />
        <StatCard label="Users" value={stats.owners.toString()} />
      </div>

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name or SKU…"
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={8} />
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-sm text-zinc-500">
          {activeFilterCount > 0 || debouncedSearch ? 'No products match your filters' : 'No products yet'}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Owner</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Category</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-right">Price</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{p.name}</p>
                          <p className="text-[11px] text-zinc-500 truncate font-mono">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p.owner ? (
                        <div className="text-xs">
                          <p className="text-zinc-300 truncate max-w-[150px]">{p.owner.firstName} {p.owner.lastName}</p>
                          <p className="text-zinc-600 truncate max-w-[150px]">{p.owner.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.category ? (
                        <Badge variant="default" size="sm">{p.category.name}</Badge>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-white">
                      {Number(p.sellingPrice).toLocaleString()} DA
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Badge variant={p.isActive ? 'success' : 'default'} size="sm">
                          {p.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {p.isLowStock && (
                          <Badge variant="warning" size="sm">Low</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} onClear={clearFilters}>
        <FilterSection label="Sort by">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
              <option value="sellingPrice">Price</option>
              <option value="quantity">Stock</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </FilterSection>

        <FilterSection label="Stock">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={stockFilter === 'all'} onClick={() => setStockFilter('all')} />
            <FilterChip label="In stock" active={stockFilter === 'in-stock'} onClick={() => setStockFilter('in-stock')} />
            <FilterChip label="Low stock" active={stockFilter === 'low'} onClick={() => setStockFilter('low')} />
          </div>
        </FilterSection>

        <FilterSection label="Status">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Active" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
            <FilterChip label="Inactive" active={statusFilter === 'inactive'} onClick={() => setStatusFilter('inactive')} />
          </div>
        </FilterSection>

        <FilterSection label="Category">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FilterSection>

        <FilterSection label="Owner">
          <input
            type="text"
            value={userFilterSearch}
            onChange={(e) => { setUserFilterSearch(e.target.value); if (!e.target.value) setUserFilterId(''); }}
            placeholder="Search user by email or name…"
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none mb-2"
          />
          {userFilterSearch.trim() && (
            <div className="max-h-40 overflow-y-auto bg-black/40 border border-white/5 rounded-lg divide-y divide-white/5">
              {allUsers
                .filter((u) => {
                  const q = userFilterSearch.toLowerCase();
                  return u.email.toLowerCase().includes(q) || u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q);
                })
                .slice(0, 10)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setUserFilterId(u.id); setUserFilterSearch(`${u.firstName} ${u.lastName}`); }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/5 transition-colors ${userFilterId === u.id ? 'bg-white/10' : ''}`}
                  >
                    <p className="text-xs text-white">{u.firstName} {u.lastName}</p>
                    <p className="text-[10px] text-zinc-500">{u.email}</p>
                  </button>
                ))}
              {allUsers.filter((u) => {
                const q = userFilterSearch.toLowerCase();
                return u.email.toLowerCase().includes(q) || u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q);
              }).length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-600">No users found</p>
              )}
            </div>
          )}
          {userFilterId && (
            <button onClick={() => { setUserFilterId(''); setUserFilterSearch(''); }} className="text-[11px] text-zinc-500 hover:text-white mt-1 underline">
              Clear user filter
            </button>
          )}
        </FilterSection>

        <FilterSection label="Image">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={hasImageFilter === 'all'} onClick={() => setHasImageFilter('all')} />
            <FilterChip label="With image" active={hasImageFilter === 'with'} onClick={() => setHasImageFilter('with')} />
            <FilterChip label="No image" active={hasImageFilter === 'without'} onClick={() => setHasImageFilter('without')} />
          </div>
        </FilterSection>

        <FilterSection label="Price range (DA)">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </FilterSection>

        <FilterSection label="Stock range">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="Min"
              className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
            <input
              type="number"
              value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
              placeholder="Max"
              className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </FilterSection>

        <FilterSection label="Min profit margin (%)">
          <input
            type="number"
            value={minMargin}
            onChange={(e) => setMinMargin(e.target.value)}
            placeholder="e.g. 30"
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
        </FilterSection>
      </FilterPanel>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider mb-1 text-zinc-500">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
