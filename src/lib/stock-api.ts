/**
 * Stock Management API
 */

import { apiRequest } from './api-config';

// ============================================================================
// Types
// ============================================================================

export interface Category {
  id: string;
  pageId: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  _count?: { products: number };
}

export interface Supplier {
  id: string;
  pageId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number };
}

export interface Product {
  id: string;
  pageId: string;
  categoryId: string | null;
  sku: string;
  name: string;
  description: string | null;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minQuantity: number;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  category?: Category | null;
}

export interface StockMovement {
  id: string;
  pageId: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'return';
  quantity: number;
  reference: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  product?: { id: string; name: string; sku: string };
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: Product;
}

export interface Sale {
  id: string;
  pageId: string;
  saleNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  notes: string | null;
  saleDate: string;
  createdAt: string;
  items: SaleItem[];
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  total: number;
  product?: Product;
}

export interface Purchase {
  id: string;
  pageId: string;
  purchaseNumber: string;
  supplierId: string | null;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  status: 'pending' | 'received' | 'partial' | 'cancelled';
  notes: string | null;
  purchaseDate: string;
  expectedDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  supplier?: Supplier | null;
  items: PurchaseItem[];
}

export interface StockDashboard {
  stats: {
    totalProducts: number;
    lowStockProducts: number;
    totalCategories: number;
    totalSuppliers: number;
    totalStockValue: number;
    totalRetailValue: number;
    totalItems: number;
  };
  recentMovements: StockMovement[];
}

// ============================================================================
// Dashboard
// ============================================================================

export async function getStockDashboard(pageId: string): Promise<StockDashboard> {
  return apiRequest<StockDashboard>(`/api/stock/${pageId}/dashboard`);
}

// ============================================================================
// Categories
// ============================================================================

export async function getCategories(pageId: string): Promise<{ categories: Category[] }> {
  return apiRequest(`/api/stock/${pageId}/categories`);
}

export async function createCategory(
  pageId: string,
  data: { name: string; description?: string; color?: string }
): Promise<{ category: Category }> {
  return apiRequest(`/api/stock/${pageId}/categories`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  pageId: string,
  categoryId: string,
  data: Partial<{ name: string; description: string; color: string }>
): Promise<{ category: Category }> {
  return apiRequest(`/api/stock/${pageId}/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(pageId: string, categoryId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/stock/${pageId}/categories/${categoryId}`, { method: 'DELETE' });
}

// ============================================================================
// Products
// ============================================================================

export async function getProducts(
  pageId: string,
  params?: { categoryId?: string; search?: string; lowStock?: boolean; limit?: number; offset?: number }
): Promise<{ products: Product[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.search) query.set('search', params.search);
  if (params?.lowStock) query.set('lowStock', 'true');
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/stock/${pageId}/products${queryStr ? `?${queryStr}` : ''}`);
}

export async function getProduct(pageId: string, productId: string): Promise<{ product: Product }> {
  return apiRequest(`/api/stock/${pageId}/products/${productId}`);
}

export async function createProduct(
  pageId: string,
  data: {
    sku: string;
    name: string;
    description?: string;
    categoryId?: string;
    costPrice?: number;
    sellingPrice?: number;
    quantity?: number;
    minQuantity?: number;
    unit?: string;
    imageUrl?: string;
  }
): Promise<{ product: Product }> {
  return apiRequest(`/api/stock/${pageId}/products`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  pageId: string,
  productId: string,
  data: Partial<{
    sku: string;
    name: string;
    description: string;
    categoryId: string;
    costPrice: number;
    sellingPrice: number;
    minQuantity: number;
    unit: string;
    imageUrl: string;
    isActive: boolean;
  }>
): Promise<{ product: Product }> {
  return apiRequest(`/api/stock/${pageId}/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(pageId: string, productId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/stock/${pageId}/products/${productId}`, { method: 'DELETE' });
}

// ============================================================================
// Stock Adjustments
// ============================================================================

export async function adjustStock(
  pageId: string,
  productId: string,
  data: { type: 'in' | 'out' | 'adjustment'; quantity: number; reason?: string; notes?: string }
): Promise<{ product: Product; movement: StockMovement }> {
  return apiRequest(`/api/stock/${pageId}/products/${productId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStockMovements(
  pageId: string,
  params?: { productId?: string; type?: string; limit?: number; offset?: number }
): Promise<{ movements: StockMovement[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.productId) query.set('productId', params.productId);
  if (params?.type) query.set('type', params.type);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/stock/${pageId}/movements${queryStr ? `?${queryStr}` : ''}`);
}

// ============================================================================
// Suppliers
// ============================================================================

export async function getSuppliers(pageId: string): Promise<{ suppliers: Supplier[] }> {
  return apiRequest(`/api/stock/${pageId}/suppliers`);
}

export async function createSupplier(
  pageId: string,
  data: { name: string; email?: string; phone?: string; address?: string; notes?: string }
): Promise<{ supplier: Supplier }> {
  return apiRequest(`/api/stock/${pageId}/suppliers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSupplier(
  pageId: string,
  supplierId: string,
  data: Partial<{ name: string; email: string; phone: string; address: string; notes: string; isActive: boolean }>
): Promise<{ supplier: Supplier }> {
  return apiRequest(`/api/stock/${pageId}/suppliers/${supplierId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSupplier(pageId: string, supplierId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/stock/${pageId}/suppliers/${supplierId}`, { method: 'DELETE' });
}

// ============================================================================
// Sales
// ============================================================================

export async function getSales(
  pageId: string,
  params?: { startDate?: string; endDate?: string; paymentStatus?: string; limit?: number; offset?: number }
): Promise<{ sales: Sale[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/stock/${pageId}/sales${queryStr ? `?${queryStr}` : ''}`);
}

export async function getSale(pageId: string, saleId: string): Promise<{ sale: Sale }> {
  return apiRequest(`/api/stock/${pageId}/sales/${saleId}`);
}

export async function createSale(
  pageId: string,
  data: {
    customerName?: string;
    customerPhone?: string;
    items: { productId: string; quantity: number; unitPrice?: number; discount?: number }[];
    discount?: number;
    tax?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    notes?: string;
  }
): Promise<{ sale: Sale }> {
  return apiRequest(`/api/stock/${pageId}/sales`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSalePayment(
  pageId: string,
  saleId: string,
  data: { paymentStatus?: string; paymentMethod?: string; notes?: string }
): Promise<{ sale: Sale }> {
  return apiRequest(`/api/stock/${pageId}/sales/${saleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getSalesStats(
  pageId: string,
  period?: 'today' | 'week' | 'month' | 'year'
): Promise<{
  stats: {
    totalSales: number;
    totalRevenue: number;
    paidSales: number;
    pendingSales: number;
    averageOrderValue: number;
  };
  topProducts: any[];
}> {
  return apiRequest(`/api/stock/${pageId}/sales/stats${period ? `?period=${period}` : ''}`);
}

// ============================================================================
// Purchases
// ============================================================================

export async function getPurchases(
  pageId: string,
  params?: { startDate?: string; endDate?: string; status?: string; supplierId?: string; limit?: number; offset?: number }
): Promise<{ purchases: Purchase[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.status) query.set('status', params.status);
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/stock/${pageId}/purchases${queryStr ? `?${queryStr}` : ''}`);
}

export async function getPurchase(pageId: string, purchaseId: string): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/stock/${pageId}/purchases/${purchaseId}`);
}

export async function createPurchase(
  pageId: string,
  data: {
    supplierId?: string;
    items: { productId: string; quantity: number; unitCost?: number }[];
    tax?: number;
    shippingCost?: number;
    paymentStatus?: string;
    status?: string;
    expectedDate?: string;
    notes?: string;
  }
): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/stock/${pageId}/purchases`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePurchase(
  pageId: string,
  purchaseId: string,
  data: { paymentStatus?: string; status?: string; expectedDate?: string; notes?: string }
): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/stock/${pageId}/purchases/${purchaseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function receivePurchaseItems(
  pageId: string,
  purchaseId: string,
  items: { itemId: string; receivedQty: number }[]
): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/stock/${pageId}/purchases/${purchaseId}/receive`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function getPurchaseStats(
  pageId: string,
  period?: 'week' | 'month' | 'year'
): Promise<{
  stats: {
    totalPurchases: number;
    totalSpent: number;
    pendingPurchases: number;
    receivedPurchases: number;
  };
  topSuppliers: any[];
}> {
  return apiRequest(`/api/stock/${pageId}/purchases/stats${period ? `?period=${period}` : ''}`);
}
