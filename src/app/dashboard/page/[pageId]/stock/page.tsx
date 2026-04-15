'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import { Button, Badge } from '@/components/ui';
import {
  BoxIcon,
  SearchIcon,
  RefreshIcon,
  CheckCircleIcon,
  ImageIcon,
  BotIcon,
  ChevronRightIcon,
} from '@/components/ui/icons';
import {
  getProducts,
  getAgents,
  updateAgentApi,
  type Product,
  type Agent,
} from '@/lib/user-stock-api';
import { useToast } from '@/components/ui/Toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001';

export default function PageStockPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { pages, loading: pagesLoading } = usePages();
  const toast = useToast();
  const pageId = params?.pageId as string;
  const currentPage = pages.find((p) => p.id === pageId);

  const [products, setProducts] = useState<Product[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sellAll, setSellAll] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!pagesLoading && !currentPage) router.push('/dashboard');
  }, [pagesLoading, currentPage, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsRes, agentsRes] = await Promise.all([
        getProducts({ limit: 500 }),
        getAgents(),
      ]);
      setProducts(productsRes.products);

      // Find agent linked to this page
      const linked = agentsRes.agents?.find((a: Agent) =>
        a.pages?.some((ap) => ap.pageId === pageId || (ap as any).page?.id === pageId)
      );
      if (linked) {
        setAgent(linked);
        setSellAll(linked.sellAllProducts);
        setSelectedIds(new Set(linked.products?.map((ap) => ap.productId) || []));
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [pageId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleSave = async () => {
    if (!agent) {
      toast.error('No agent linked to this page. Create one first.');
      return;
    }
    try {
      setSaving(true);
      await updateAgentApi(agent.id, {
        sellAllProducts: sellAll,
        productIds: sellAll ? [] : Array.from(selectedIds),
      });
      toast.success('Product selection saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getImageUrl = (product: Product): string | null => {
    if (product.images && product.images.length > 0) {
      const url = product.images[0].url;
      return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    }
    if (product.imageUrl) {
      return product.imageUrl.startsWith('http') ? product.imageUrl : `${API_BASE_URL}${product.imageUrl}`;
    }
    return null;
  };

  if (authLoading || pagesLoading || !currentPage) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
        <button onClick={() => router.push('/dashboard?section=pages')} className="hover:text-white transition-colors">Pages</button>
        <span>/</span>
        <button onClick={() => router.push(`/dashboard/page/${pageId}`)} className="hover:text-white transition-colors truncate max-w-[200px]">{currentPage.pageName}</button>
        <span>/</span>
        <span className="text-white">Products</span>
      </nav>

      {/* Header */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Products for {currentPage.pageName}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Choose which products from your catalog the AI agent sells on this page
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/stock/products')} icon={<BoxIcon className="w-4 h-4" />}>
              Manage catalog
            </Button>
            <button onClick={loadData} disabled={loading} className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50">
              <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Agent status */}
      {!loading && !agent && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <BotIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-400">No AI agent linked to this page</p>
            <p className="text-xs text-yellow-400/60">Create an agent and assign it to this page first.</p>
          </div>
          <Button size="sm" onClick={() => router.push('/dashboard/agents')}>Go to Agents</Button>
        </div>
      )}

      {agent && (
        <>
          {/* Sell all toggle */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sellAll ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-400'}`}>
                  <BoxIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Sell all products</h3>
                  <p className="text-xs text-zinc-500">
                    {sellAll
                      ? `Agent has access to all ${products.length} products in your catalog`
                      : `${selectedIds.size} of ${products.length} products selected`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSellAll(!sellAll)}
                className={`relative w-12 h-7 rounded-full transition-colors ${sellAll ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${sellAll ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          {/* Product selector — only show when not selling all */}
          {!sellAll && (
            <>
              {/* Search + select all */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={toggleAll}
                  className="px-3 py-2.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 hover:border-white/20 rounded-lg transition-colors whitespace-nowrap"
                >
                  {selectedIds.size === products.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Product grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 bg-zinc-900/50 rounded-xl animate-pulse" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center text-sm text-zinc-500">
                  {search ? 'No products match your search' : 'No products in your catalog'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map((product) => {
                    const selected = selectedIds.has(product.id);
                    const imgUrl = getImageUrl(product);
                    return (
                      <button
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`group text-left rounded-xl border p-3 transition-all ${
                          selected
                            ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
                            : 'bg-zinc-900/50 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Image */}
                          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/5">
                            {imgUrl ? (
                              <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-zinc-600" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{product.name}</p>
                            <p className="text-xs text-emerald-400 mt-0.5">{Number(product.sellingPrice).toLocaleString()} DA</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={product.quantity > 0 ? 'success' : 'warning'} size="sm">
                                {product.quantity} in stock
                              </Badge>
                            </div>
                          </div>

                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all ${
                            selected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
                          }`}>
                            {selected && <CheckCircleIcon className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Save bar */}
          <div className="sticky bottom-4 z-10">
            <div className="bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex items-center justify-between shadow-2xl">
              <p className="text-sm text-zinc-400">
                {sellAll
                  ? `All ${products.length} products will be available on this page`
                  : `${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''} selected`}
              </p>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save selection'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => router.push('/dashboard/stock/products')}
          className="group text-left bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <BoxIcon className="w-5 h-5 text-zinc-400" />
            <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-sm font-medium text-white">Manage full catalog</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Add, edit, or remove products from your main stock</p>
        </button>

        <button
          onClick={() => router.push('/dashboard/agents')}
          className="group text-left bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <BotIcon className="w-5 h-5 text-zinc-400" />
            <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-sm font-medium text-white">Configure AI agent</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Change personality, model, and display settings</p>
        </button>
      </div>
    </div>
  );
}
