'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import {
  Button,
  Card,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  EmptyState,
  BoxIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  ShoppingCartIcon,
  TruckIcon,
  UsersIcon,
  AlertIcon,
  EditIcon,
  TrashIcon,
  DollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RefreshIcon,
  HomeIcon,
  ChartIcon,
} from '@/components/ui';
import {
  getStockDashboard,
  getProducts,
  getCategories,
  getSuppliers,
  getSales,
  getPurchases,
  createProduct,
  createCategory,
  createSupplier,
  createSale,
  createPurchase,
  adjustStock,
  type Product,
  type Category,
  type Supplier,
  type Sale,
  type Purchase,
  type StockDashboard,
} from '@/lib/stock-api';

export default function StockManagementPage() {
  const router = useRouter();
  const params = useParams();
  const pageId = params.pageId as string;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { pages } = usePages();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboard, setDashboard] = useState<StockDashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  // Modal states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState<Product | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    minQuantity: '',
    unit: 'piece',
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#6B7280' });
  const [supplierForm, setSupplierForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [adjustForm, setAdjustForm] = useState({ type: 'in' as 'in' | 'out' | 'adjustment', quantity: '', reason: '' });
  const [saleForm, setSaleForm] = useState({
    customerName: '',
    customerPhone: '',
    items: [] as { productId: string; quantity: number; unitPrice: number }[],
    paymentMethod: 'cash',
    paymentStatus: 'paid' as 'paid' | 'pending',
  });
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    items: [] as { productId: string; quantity: number; unitCost: number }[],
    paymentStatus: 'pending' as 'paid' | 'pending',
    notes: '',
  });
  const [saleItemForm, setSaleItemForm] = useState({ productId: '', quantity: '1' });
  const [purchaseItemForm, setPurchaseItemForm] = useState({ productId: '', quantity: '1', unitCost: '' });

  const currentPage = pages.find((p) => p.id === pageId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (pageId && isAuthenticated) {
      loadData();
    }
  }, [pageId, isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, productsRes, categoriesRes, suppliersRes, salesRes, purchasesRes] = await Promise.all([
        getStockDashboard(pageId),
        getProducts(pageId),
        getCategories(pageId),
        getSuppliers(pageId),
        getSales(pageId, { limit: 10 }),
        getPurchases(pageId, { limit: 10 }),
      ]);

      setDashboard(dashboardRes);
      setProducts(productsRes.products);
      setCategories(categoriesRes.categories);
      setSuppliers(suppliersRes.suppliers);
      setSales(salesRes.sales);
      setPurchases(purchasesRes.purchases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct(pageId, {
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description || undefined,
        categoryId: productForm.categoryId || undefined,
        costPrice: parseFloat(productForm.costPrice) || 0,
        sellingPrice: parseFloat(productForm.sellingPrice) || 0,
        quantity: parseInt(productForm.quantity) || 0,
        minQuantity: parseInt(productForm.minQuantity) || 0,
        unit: productForm.unit,
      });
      setShowAddProduct(false);
      setProductForm({ sku: '', name: '', description: '', categoryId: '', costPrice: '', sellingPrice: '', quantity: '', minQuantity: '', unit: 'piece' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategory(pageId, categoryForm);
      setShowAddCategory(false);
      setCategoryForm({ name: '', description: '', color: '#6B7280' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSupplier(pageId, supplierForm);
      setShowAddSupplier(false);
      setSupplierForm({ name: '', email: '', phone: '', address: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustStock) return;
    try {
      await adjustStock(pageId, showAdjustStock.id, {
        type: adjustForm.type,
        quantity: parseInt(adjustForm.quantity),
        reason: adjustForm.reason || undefined,
      });
      setShowAdjustStock(null);
      setAdjustForm({ type: 'in', quantity: '', reason: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock');
    }
  };

  const handleAddSaleItem = () => {
    if (!saleItemForm.productId) return;
    const product = products.find(p => p.id === saleItemForm.productId);
    if (!product) return;

    const existingIndex = saleForm.items.findIndex(i => i.productId === saleItemForm.productId);
    if (existingIndex >= 0) {
      const newItems = [...saleForm.items];
      newItems[existingIndex].quantity += parseInt(saleItemForm.quantity) || 1;
      setSaleForm({ ...saleForm, items: newItems });
    } else {
      setSaleForm({
        ...saleForm,
        items: [...saleForm.items, {
          productId: saleItemForm.productId,
          quantity: parseInt(saleItemForm.quantity) || 1,
          unitPrice: Number(product.sellingPrice),
        }],
      });
    }
    setSaleItemForm({ productId: '', quantity: '1' });
  };

  const handleRemoveSaleItem = (productId: string) => {
    setSaleForm({
      ...saleForm,
      items: saleForm.items.filter(i => i.productId !== productId),
    });
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleForm.items.length === 0) {
      setError('Please add at least one item to the sale');
      return;
    }
    try {
      await createSale(pageId, {
        customerName: saleForm.customerName || undefined,
        customerPhone: saleForm.customerPhone || undefined,
        items: saleForm.items,
        paymentMethod: saleForm.paymentMethod,
        paymentStatus: saleForm.paymentStatus,
      });
      setShowAddSale(false);
      setSaleForm({ customerName: '', customerPhone: '', items: [], paymentMethod: 'cash', paymentStatus: 'paid' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sale');
    }
  };

  const handleAddPurchaseItem = () => {
    if (!purchaseItemForm.productId) return;
    const product = products.find(p => p.id === purchaseItemForm.productId);
    if (!product) return;

    const existingIndex = purchaseForm.items.findIndex(i => i.productId === purchaseItemForm.productId);
    if (existingIndex >= 0) {
      const newItems = [...purchaseForm.items];
      newItems[existingIndex].quantity += parseInt(purchaseItemForm.quantity) || 1;
      setPurchaseForm({ ...purchaseForm, items: newItems });
    } else {
      setPurchaseForm({
        ...purchaseForm,
        items: [...purchaseForm.items, {
          productId: purchaseItemForm.productId,
          quantity: parseInt(purchaseItemForm.quantity) || 1,
          unitCost: parseFloat(purchaseItemForm.unitCost) || Number(product.costPrice),
        }],
      });
    }
    setPurchaseItemForm({ productId: '', quantity: '1', unitCost: '' });
  };

  const handleRemovePurchaseItem = (productId: string) => {
    setPurchaseForm({
      ...purchaseForm,
      items: purchaseForm.items.filter(i => i.productId !== productId),
    });
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.items.length === 0) {
      setError('Please add at least one item to the purchase');
      return;
    }
    try {
      await createPurchase(pageId, {
        supplierId: purchaseForm.supplierId || undefined,
        items: purchaseForm.items,
        paymentStatus: purchaseForm.paymentStatus,
        notes: purchaseForm.notes || undefined,
      });
      setShowAddPurchase(false);
      setPurchaseForm({ supplierId: '', items: [], paymentStatus: 'pending', notes: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase');
    }
  };

  const getSaleTotal = () => {
    return saleForm.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const getPurchaseTotal = () => {
    return purchaseForm.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/dashboard/page/${pageId}`)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Stock Management
                </h1>
                <p className="text-sm text-zinc-400">{currentPage?.pageName}</p>
              </div>
            </div>
            <Button onClick={() => setShowAddProduct(true)} icon={<PlusIcon className="w-4 h-4" />}>
              Add Product
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
              <button onClick={() => setError(null)} className="ml-4 underline">
                Dismiss
              </button>
            </div>
          )}

          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="overview" icon={<ChartIcon className="w-4 h-4" />}>
                Overview
              </TabsTrigger>
              <TabsTrigger value="products" icon={<BoxIcon className="w-4 h-4" />}>
                Products
              </TabsTrigger>
              <TabsTrigger value="categories" icon={<TagIcon className="w-4 h-4" />}>
                Categories
              </TabsTrigger>
              <TabsTrigger value="sales" icon={<ShoppingCartIcon className="w-4 h-4" />}>
                Sales
              </TabsTrigger>
              <TabsTrigger value="purchases" icon={<TruckIcon className="w-4 h-4" />}>
                Purchases
              </TabsTrigger>
              <TabsTrigger value="suppliers" icon={<UsersIcon className="w-4 h-4" />}>
                Suppliers
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card variant="interactive">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Total Products</h3>
                    <BoxIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {dashboard?.stats.totalProducts || 0}
                  </div>
                  <p className="text-xs text-zinc-500">{dashboard?.stats.totalItems || 0} total items in stock</p>
                </Card>

                <Card variant="interactive">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Low Stock Alert</h3>
                    <AlertIcon className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {dashboard?.stats.lowStockProducts || 0}
                  </div>
                  <p className="text-xs text-zinc-500">Products need restocking</p>
                </Card>

                <Card variant="interactive">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Stock Value</h3>
                    <DollarIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {(dashboard?.stats.totalStockValue || 0).toLocaleString()} DA
                  </div>
                  <p className="text-xs text-zinc-500">At cost price</p>
                </Card>

                <Card variant="interactive">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Retail Value</h3>
                    <DollarIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {(dashboard?.stats.totalRetailValue || 0).toLocaleString()} DA
                  </div>
                  <p className="text-xs text-zinc-500">At selling price</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Stock Movements</h3>
                  {dashboard?.recentMovements && dashboard.recentMovements.length > 0 ? (
                    <div className="space-y-3">
                      {dashboard.recentMovements.map((movement) => (
                        <div key={movement.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-3">
                            {movement.type === 'in' ? (
                              <ArrowDownIcon className="w-4 h-4 text-emerald-400" />
                            ) : movement.type === 'out' ? (
                              <ArrowUpIcon className="w-4 h-4 text-red-400" />
                            ) : (
                              <RefreshIcon className="w-4 h-4 text-blue-400" />
                            )}
                            <div>
                              <p className="text-sm text-white">{movement.product?.name}</p>
                              <p className="text-xs text-zinc-500">{movement.reason}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${movement.quantity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {new Date(movement.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No recent movements</p>
                  )}
                </Card>

                <Card>
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Categories</span>
                      <span className="text-white font-medium">{dashboard?.stats.totalCategories || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Suppliers</span>
                      <span className="text-white font-medium">{dashboard?.stats.totalSuppliers || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Potential Profit</span>
                      <span className="text-emerald-400 font-medium">
                        {((dashboard?.stats.totalRetailValue || 0) - (dashboard?.stats.totalStockValue || 0)).toLocaleString()} DA
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products">
              <div className="flex items-center justify-between mb-6">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <Button onClick={() => setShowAddProduct(true)} icon={<PlusIcon className="w-4 h-4" />}>
                  Add Product
                </Button>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <Card key={product.id} variant="interactive">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold">{product.name}</h3>
                          <p className="text-xs text-zinc-500">SKU: {product.sku}</p>
                        </div>
                        {product.category && (
                          <Badge variant="default" style={{ backgroundColor: `${product.category.color}20`, color: product.category.color, borderColor: `${product.category.color}40` }}>
                            {product.category.name}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Quantity</span>
                          <span className={`font-medium ${product.quantity <= product.minQuantity ? 'text-amber-400' : 'text-white'}`}>
                            {product.quantity} {product.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Cost Price</span>
                          <span className="text-white">{Number(product.costPrice).toLocaleString()} DA</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Selling Price</span>
                          <span className="text-emerald-400">{Number(product.sellingPrice).toLocaleString()} DA</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAdjustStock(product)}>
                          Adjust Stock
                        </Button>
                        <Button variant="ghost" size="sm">
                          <EditIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<BoxIcon className="w-16 h-16" />}
                    title="No Products"
                    description="Add your first product to start managing your inventory"
                    action={
                      <Button onClick={() => setShowAddProduct(true)} icon={<PlusIcon className="w-4 h-4" />}>
                        Add Product
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Categories</h2>
                <Button onClick={() => setShowAddCategory(true)} icon={<PlusIcon className="w-4 h-4" />}>
                  Add Category
                </Button>
              </div>

              {categories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <Card key={category.id} variant="interactive">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                        <h3 className="text-white font-semibold">{category.name}</h3>
                      </div>
                      {category.description && (
                        <p className="text-sm text-zinc-400 mb-3">{category.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">{category._count?.products || 0} products</span>
                        <Button variant="ghost" size="sm">
                          <EditIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<TagIcon className="w-16 h-16" />}
                    title="No Categories"
                    description="Create categories to organize your products"
                    action={
                      <Button onClick={() => setShowAddCategory(true)} icon={<PlusIcon className="w-4 h-4" />}>
                        Add Category
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Sales</h2>
                <Button onClick={() => setShowAddSale(true)} icon={<PlusIcon className="w-4 h-4" />}>
                  New Sale
                </Button>
              </div>

              {sales.length > 0 ? (
                <Card padding="none">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Sale #</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Customer</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Items</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">{sale.saleNumber}</td>
                          <td className="px-4 py-3 text-sm text-white">{sale.customerName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-zinc-400">{sale.items.length} items</td>
                          <td className="px-4 py-3 text-sm text-emerald-400">{Number(sale.total).toLocaleString()} DA</td>
                          <td className="px-4 py-3">
                            <Badge variant={sale.paymentStatus === 'paid' ? 'success' : sale.paymentStatus === 'pending' ? 'warning' : 'default'}>
                              {sale.paymentStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-500">{new Date(sale.saleDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<ShoppingCartIcon className="w-16 h-16" />}
                    title="No Sales"
                    description="Record your first sale to track revenue"
                    action={
                      <Button onClick={() => setShowAddSale(true)} icon={<PlusIcon className="w-4 h-4" />}>
                        New Sale
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>

            {/* Purchases Tab */}
            <TabsContent value="purchases">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Purchases</h2>
                <Button onClick={() => setShowAddPurchase(true)} icon={<PlusIcon className="w-4 h-4" />}>
                  New Purchase
                </Button>
              </div>

              {purchases.length > 0 ? (
                <Card padding="none">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">PO #</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Supplier</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Items</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Total</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((purchase) => (
                        <tr key={purchase.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">{purchase.purchaseNumber}</td>
                          <td className="px-4 py-3 text-sm text-white">{purchase.supplier?.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-zinc-400">{purchase.items.length} items</td>
                          <td className="px-4 py-3 text-sm text-white">{Number(purchase.total).toLocaleString()} DA</td>
                          <td className="px-4 py-3">
                            <Badge variant={purchase.status === 'received' ? 'success' : purchase.status === 'pending' ? 'warning' : 'default'}>
                              {purchase.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-500">{new Date(purchase.purchaseDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<TruckIcon className="w-16 h-16" />}
                    title="No Purchases"
                    description="Create purchase orders to track your inventory"
                    action={
                      <Button onClick={() => setShowAddPurchase(true)} icon={<PlusIcon className="w-4 h-4" />}>
                        New Purchase
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>

            {/* Suppliers Tab */}
            <TabsContent value="suppliers">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Suppliers</h2>
                <Button onClick={() => setShowAddSupplier(true)} icon={<PlusIcon className="w-4 h-4" />}>
                  Add Supplier
                </Button>
              </div>

              {suppliers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliers.map((supplier) => (
                    <Card key={supplier.id} variant="interactive">
                      <h3 className="text-white font-semibold mb-2">{supplier.name}</h3>
                      <div className="space-y-1 text-sm text-zinc-400 mb-3">
                        {supplier.email && <p>{supplier.email}</p>}
                        {supplier.phone && <p>{supplier.phone}</p>}
                        {supplier.address && <p className="truncate">{supplier.address}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">{supplier._count?.purchases || 0} purchases</span>
                        <Button variant="ghost" size="sm">
                          <EditIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<UsersIcon className="w-16 h-16" />}
                    title="No Suppliers"
                    description="Add suppliers to manage your purchases"
                    action={
                      <Button onClick={() => setShowAddSupplier(true)} icon={<PlusIcon className="w-4 h-4" />}>
                        Add Supplier
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">Add New Product</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="SKU *" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} required />
                <Input label="Name *" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              </div>
              <Input label="Description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cost Price" type="number" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })} />
                <Input label="Selling Price" type="number" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Initial Quantity" type="number" value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} />
                <Input label="Min Quantity (Alert)" type="number" value={productForm.minQuantity} onChange={(e) => setProductForm({ ...productForm, minQuantity: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Category</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Unit</label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogram</option>
                    <option value="g">Gram</option>
                    <option value="l">Liter</option>
                    <option value="ml">Milliliter</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddProduct(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Add Product
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Add New Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <Input label="Name *" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
              <Input label="Description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Color</label>
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddCategory(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Add Category
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Add New Supplier</h2>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <Input label="Name *" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required />
              <Input label="Email" type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
              <Input label="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
              <Input label="Address" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddSupplier(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Add Supplier
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustStock && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">Adjust Stock</h2>
            <p className="text-zinc-400 mb-6">{showAdjustStock.name} (Current: {showAdjustStock.quantity})</p>
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Type</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                >
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (-)</option>
                  <option value="adjustment">Set Exact Quantity</option>
                </select>
              </div>
              <Input
                label="Quantity *"
                type="number"
                min="0"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                required
              />
              <Input
                label="Reason"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="e.g., Inventory count, Damaged goods"
              />
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdjustStock(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Adjust Stock
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* New Sale Modal */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">New Sale</h2>
            <form onSubmit={handleCreateSale} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Customer Name"
                  value={saleForm.customerName}
                  onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                  placeholder="Optional"
                />
                <Input
                  label="Customer Phone"
                  value={saleForm.customerPhone}
                  onChange={(e) => setSaleForm({ ...saleForm, customerPhone: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              {/* Add Item */}
              <div className="p-4 bg-zinc-900 rounded-lg space-y-3">
                <h3 className="text-sm font-medium text-zinc-400">Add Items</h3>
                <div className="flex gap-2">
                  <select
                    value={saleItemForm.productId}
                    onChange={(e) => setSaleItemForm({ ...saleItemForm, productId: e.target.value })}
                    className="flex-1 px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Select Product</option>
                    {products.filter(p => p.quantity > 0).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {Number(p.sellingPrice).toLocaleString()} DA ({p.quantity} in stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={saleItemForm.quantity}
                    onChange={(e) => setSaleItemForm({ ...saleItemForm, quantity: e.target.value })}
                    className="w-20 px-3 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                    placeholder="Qty"
                  />
                  <Button type="button" onClick={handleAddSaleItem}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Items List */}
              {saleForm.items.length > 0 && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-900">
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                        <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Qty</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Price</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleForm.items.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                          <tr key={item.productId} className="border-t border-white/5">
                            <td className="px-4 py-2 text-sm text-white">{product?.name}</td>
                            <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-right text-zinc-400">{item.unitPrice.toLocaleString()} DA</td>
                            <td className="px-4 py-2 text-sm text-right text-white">{(item.quantity * item.unitPrice).toLocaleString()} DA</td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveSaleItem(item.productId)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-zinc-900">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-white">Total:</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-emerald-400">{getSaleTotal().toLocaleString()} DA</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Payment Method</label>
                  <select
                    value={saleForm.paymentMethod}
                    onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="ccp">CCP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Payment Status</label>
                  <select
                    value={saleForm.paymentStatus}
                    onChange={(e) => setSaleForm({ ...saleForm, paymentStatus: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  setShowAddSale(false);
                  setSaleForm({ customerName: '', customerPhone: '', items: [], paymentMethod: 'cash', paymentStatus: 'paid' });
                }}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saleForm.items.length === 0}>
                  Complete Sale
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* New Purchase Modal */}
      {showAddPurchase && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">New Purchase Order</h2>
            <form onSubmit={handleCreatePurchase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Supplier</label>
                <select
                  value={purchaseForm.supplierId}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                >
                  <option value="">Select Supplier (Optional)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Add Item */}
              <div className="p-4 bg-zinc-900 rounded-lg space-y-3">
                <h3 className="text-sm font-medium text-zinc-400">Add Items</h3>
                <div className="flex gap-2">
                  <select
                    value={purchaseItemForm.productId}
                    onChange={(e) => {
                      const product = products.find(p => p.id === e.target.value);
                      setPurchaseItemForm({
                        ...purchaseItemForm,
                        productId: e.target.value,
                        unitCost: product ? String(product.costPrice) : '',
                      });
                    }}
                    className="flex-1 px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - Cost: {Number(p.costPrice).toLocaleString()} DA
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={purchaseItemForm.quantity}
                    onChange={(e) => setPurchaseItemForm({ ...purchaseItemForm, quantity: e.target.value })}
                    className="w-20 px-3 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseItemForm.unitCost}
                    onChange={(e) => setPurchaseItemForm({ ...purchaseItemForm, unitCost: e.target.value })}
                    className="w-28 px-3 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                    placeholder="Unit Cost"
                  />
                  <Button type="button" onClick={handleAddPurchaseItem}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Items List */}
              {purchaseForm.items.length > 0 && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-900">
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Product</th>
                        <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2">Qty</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Unit Cost</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseForm.items.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                          <tr key={item.productId} className="border-t border-white/5">
                            <td className="px-4 py-2 text-sm text-white">{product?.name}</td>
                            <td className="px-4 py-2 text-sm text-center text-white">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-right text-zinc-400">{item.unitCost.toLocaleString()} DA</td>
                            <td className="px-4 py-2 text-sm text-right text-white">{(item.quantity * item.unitCost).toLocaleString()} DA</td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemovePurchaseItem(item.productId)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-zinc-900">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-white">Total:</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-white">{getPurchaseTotal().toLocaleString()} DA</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Payment Status</label>
                <select
                  value={purchaseForm.paymentStatus}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, paymentStatus: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <Input
                label="Notes"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                placeholder="Optional notes about this purchase"
              />

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  setShowAddPurchase(false);
                  setPurchaseForm({ supplierId: '', items: [], paymentStatus: 'pending', notes: '' });
                }}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={purchaseForm.items.length === 0}>
                  Create Purchase Order
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
