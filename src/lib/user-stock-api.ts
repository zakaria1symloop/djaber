/**
 * User-level Stock Management API (no pageId required)
 */

import { apiRequest, apiUpload } from './api-config';

// ============================================================================
// Types
// ============================================================================

export interface Category {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  _count?: { products: number };
}

export interface Supplier {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number };
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  source: 'ai' | 'manual';
  isActive: boolean;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  createdAt: string;
}

export interface Unit {
  id: string;
  userId: string | null;
  name: string;
  abbreviation: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  filename: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minQuantity: number;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  userId: string;
  categoryId: string | null;
  unitId: string | null;
  sku: string;
  name: string;
  description: string | null;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minQuantity: number;
  unit: string;
  hasVariants: boolean;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  category?: Category | null;
  unitRef?: Unit | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
  _count?: { variants: number };
}

export interface StockMovement {
  id: string;
  userId: string;
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
  userId: string;
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
  userId: string;
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

export async function getStockDashboard(): Promise<StockDashboard> {
  return apiRequest<StockDashboard>('/api/user-stock/dashboard');
}

// ============================================================================
// Categories
// ============================================================================

export async function getCategories(search?: string): Promise<{ categories: Category[] }> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/categories${queryStr ? `?${queryStr}` : ''}`);
}

export async function createCategory(
  data: { name: string; description?: string; color?: string }
): Promise<{ category: Category }> {
  return apiRequest('/api/user-stock/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  categoryId: string,
  data: Partial<{ name: string; description: string; color: string }>
): Promise<{ category: Category }> {
  return apiRequest(`/api/user-stock/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(categoryId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/categories/${categoryId}`, { method: 'DELETE' });
}

// ============================================================================
// Products
// ============================================================================

export async function getProducts(
  params?: { categoryId?: string; search?: string; lowStock?: boolean; limit?: number; offset?: number }
): Promise<{ products: Product[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.search) query.set('search', params.search);
  if (params?.lowStock) query.set('lowStock', 'true');
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/products${queryStr ? `?${queryStr}` : ''}`);
}

export async function getProduct(productId: string): Promise<{ product: Product }> {
  return apiRequest(`/api/user-stock/products/${productId}`);
}

export async function createProduct(
  data: {
    sku: string;
    name: string;
    description?: string;
    categoryId?: string;
    unitId?: string;
    costPrice?: number;
    sellingPrice?: number;
    quantity?: number;
    minQuantity?: number;
    unit?: string;
    imageUrl?: string;
  }
): Promise<{ product: Product }> {
  return apiRequest('/api/user-stock/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  productId: string,
  data: Partial<{
    sku: string;
    name: string;
    description: string;
    categoryId: string;
    unitId: string;
    costPrice: number;
    sellingPrice: number;
    minQuantity: number;
    unit: string;
    imageUrl: string;
    isActive: boolean;
  }>
): Promise<{ product: Product }> {
  return apiRequest(`/api/user-stock/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(productId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/products/${productId}`, { method: 'DELETE' });
}

// ============================================================================
// Stock Adjustments
// ============================================================================

export async function adjustStock(
  productId: string,
  data: { type: 'in' | 'out' | 'adjustment'; quantity: number; reason?: string; notes?: string }
): Promise<{ product: Product; movement: StockMovement }> {
  return apiRequest(`/api/user-stock/products/${productId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStockMovements(
  params?: { productId?: string; type?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }
): Promise<{ movements: StockMovement[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.productId) query.set('productId', params.productId);
  if (params?.type) query.set('type', params.type);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/movements${queryStr ? `?${queryStr}` : ''}`);
}

// ============================================================================
// Suppliers
// ============================================================================

export async function getSuppliers(search?: string): Promise<{ suppliers: Supplier[] }> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/suppliers${queryStr ? `?${queryStr}` : ''}`);
}

export async function createSupplier(
  data: { name: string; email?: string; phone?: string; address?: string; notes?: string }
): Promise<{ supplier: Supplier }> {
  return apiRequest('/api/user-stock/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSupplier(
  supplierId: string,
  data: Partial<{ name: string; email: string; phone: string; address: string; notes: string; isActive: boolean }>
): Promise<{ supplier: Supplier }> {
  return apiRequest(`/api/user-stock/suppliers/${supplierId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSupplier(supplierId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/suppliers/${supplierId}`, { method: 'DELETE' });
}

// ============================================================================
// Clients
// ============================================================================

export async function getClients(search?: string): Promise<{ clients: Client[] }> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/clients${queryStr ? `?${queryStr}` : ''}`);
}

export async function getClient(clientId: string): Promise<{ client: Client }> {
  return apiRequest(`/api/user-stock/clients/${clientId}`);
}

export async function createClient(
  data: { name: string; phone?: string; email?: string; address?: string; notes?: string; source?: string }
): Promise<{ client: Client }> {
  return apiRequest('/api/user-stock/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClient(
  clientId: string,
  data: Partial<{ name: string; phone: string; email: string; address: string; notes: string; isActive: boolean }>
): Promise<{ client: Client }> {
  return apiRequest(`/api/user-stock/clients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClientApi(clientId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/clients/${clientId}`, { method: 'DELETE' });
}

// ============================================================================
// Sales
// ============================================================================

export async function getSales(
  params?: { startDate?: string; endDate?: string; paymentStatus?: string; limit?: number; offset?: number }
): Promise<{ sales: Sale[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/sales${queryStr ? `?${queryStr}` : ''}`);
}

export async function getSale(saleId: string): Promise<{ sale: Sale }> {
  return apiRequest(`/api/user-stock/sales/${saleId}`);
}

export async function createSale(
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
  return apiRequest('/api/user-stock/sales', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSalePayment(
  saleId: string,
  data: { paymentStatus?: string; paymentMethod?: string; notes?: string }
): Promise<{ sale: Sale }> {
  return apiRequest(`/api/user-stock/sales/${saleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSale(saleId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/sales/${saleId}`, { method: 'DELETE' });
}

export async function getSalesStats(
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
  return apiRequest(`/api/user-stock/sales/stats${period ? `?period=${period}` : ''}`);
}

// ============================================================================
// Purchases
// ============================================================================

export async function getPurchases(
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
  return apiRequest(`/api/user-stock/purchases${queryStr ? `?${queryStr}` : ''}`);
}

export async function getPurchase(purchaseId: string): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/user-stock/purchases/${purchaseId}`);
}

export async function createPurchase(
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
  return apiRequest('/api/user-stock/purchases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePurchase(
  purchaseId: string,
  data: { paymentStatus?: string; status?: string; expectedDate?: string; notes?: string }
): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/user-stock/purchases/${purchaseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePurchase(purchaseId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/purchases/${purchaseId}`, { method: 'DELETE' });
}

export async function receivePurchaseItems(
  purchaseId: string,
  items: { itemId: string; receivedQty: number }[]
): Promise<{ purchase: Purchase }> {
  return apiRequest(`/api/user-stock/purchases/${purchaseId}/receive`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function getPurchaseStats(
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
  return apiRequest(`/api/user-stock/purchases/stats${period ? `?period=${period}` : ''}`);
}

// ============================================================================
// Units
// ============================================================================

export async function getUnits(): Promise<{ units: Unit[] }> {
  return apiRequest('/api/user-stock/units');
}

export async function createUnit(
  data: { name: string; abbreviation: string }
): Promise<{ unit: Unit }> {
  return apiRequest('/api/user-stock/units', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUnit(
  unitId: string,
  data: Partial<{ name: string; abbreviation: string }>
): Promise<{ unit: Unit }> {
  return apiRequest(`/api/user-stock/units/${unitId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUnit(unitId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/units/${unitId}`, { method: 'DELETE' });
}

// ============================================================================
// Product Images
// ============================================================================

export async function uploadProductImages(
  productId: string,
  files: File[]
): Promise<{ images: ProductImage[] }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  return apiUpload(`/api/user-stock/products/${productId}/images`, formData);
}

export async function getProductImages(
  productId: string
): Promise<{ images: ProductImage[] }> {
  return apiRequest(`/api/user-stock/products/${productId}/images`);
}

export async function deleteProductImage(
  productId: string,
  imageId: string
): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

export async function reorderProductImages(
  productId: string,
  imageIds: string[]
): Promise<{ images: ProductImage[] }> {
  return apiRequest(`/api/user-stock/products/${productId}/images/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ imageIds }),
  });
}

export async function setPrimaryImage(
  productId: string,
  imageId: string
): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/products/${productId}/images/${imageId}/primary`, {
    method: 'PUT',
  });
}

// ============================================================================
// Product Variants
// ============================================================================

export async function getProductVariants(
  productId: string
): Promise<{ variants: ProductVariant[] }> {
  return apiRequest(`/api/user-stock/products/${productId}/variants`);
}

export async function createProductVariant(
  productId: string,
  data: {
    name: string;
    sku?: string;
    costPrice?: number;
    sellingPrice?: number;
    quantity?: number;
    minQuantity?: number;
  }
): Promise<{ variant: ProductVariant }> {
  return apiRequest(`/api/user-stock/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  data: Partial<{
    name: string;
    sku: string;
    costPrice: number;
    sellingPrice: number;
    minQuantity: number;
    isActive: boolean;
  }>
): Promise<{ variant: ProductVariant }> {
  return apiRequest(`/api/user-stock/products/${productId}/variants/${variantId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProductVariant(
  productId: string,
  variantId: string
): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/products/${productId}/variants/${variantId}`, {
    method: 'DELETE',
  });
}

export async function adjustVariantStock(
  productId: string,
  variantId: string,
  data: { type: 'in' | 'out' | 'adjustment'; quantity: number; reason?: string; notes?: string }
): Promise<{ variant: ProductVariant; movement: StockMovement }> {
  return apiRequest(`/api/user-stock/products/${productId}/variants/${variantId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Orders
// ============================================================================

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: Product;
}

export interface OrderCall {
  id: string;
  orderId: string;
  result: 'picked_up' | 'no_answer' | 'busy' | 'rejected' | 'voicemail';
  notes: string | null;
  calledAt: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  clientAddress: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  status: 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
  deliveryStatus: 'not_sent' | 'sent' | 'in_transit' | 'delivered';
  confirmationStatus: 'not_called' | 'no_answer' | 'confirmed' | 'rejected';
  callAttempts: number;
  trackingNumber: string | null;
  deliveryProvider: string | null;
  deliveryFee: number;
  deliverySentAt: string | null;
  source: 'manual' | 'ai';
  notes: string | null;
  orderDate: string;
  createdAt: string;
  items: OrderItem[];
  calls?: OrderCall[];
  client?: Client | null;
}

export async function getOrders(
  params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentStatus?: string;
    confirmationStatus?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ orders: Order[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.status) query.set('status', params.status);
  if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
  if (params?.confirmationStatus) query.set('confirmationStatus', params.confirmationStatus);
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryStr = query.toString();
  return apiRequest(`/api/user-stock/orders${queryStr ? `?${queryStr}` : ''}`);
}

export async function getOrderApi(orderId: string): Promise<{ order: Order }> {
  return apiRequest(`/api/user-stock/orders/${orderId}`);
}

export async function createOrder(
  data: {
    clientId?: string;
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    items: { productId: string; quantity: number; unitPrice?: number; variantId?: string; variantName?: string }[];
    discount?: number;
    tax?: number;
    amountPaid?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    status?: string;
    source?: string;
    notes?: string;
  }
): Promise<{ order: Order }> {
  return apiRequest('/api/user-stock/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOrder(
  orderId: string,
  data: {
    status?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    deliveryStatus?: string;
    amountPaid?: number;
    notes?: string;
  }
): Promise<{ order: Order }> {
  return apiRequest(`/api/user-stock/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteOrder(orderId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/orders/${orderId}`, { method: 'DELETE' });
}

export async function addOrderCall(
  orderId: string,
  data: { result: string; notes?: string }
): Promise<{ call: OrderCall; order: Order }> {
  return apiRequest(`/api/user-stock/orders/${orderId}/calls`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getOrderCalls(orderId: string): Promise<{ calls: OrderCall[] }> {
  return apiRequest(`/api/user-stock/orders/${orderId}/calls`);
}

// ============================================================================
// Agents
// ============================================================================

export interface AgentPage {
  id: string;
  agentId: string;
  pageId: string;
  page: { id: string; pageName: string; platform: string; pageId: string; isActive: boolean };
}

export interface AgentProduct {
  id: string;
  agentId: string;
  productId: string;
  product: { id: string; name: string; sku: string; sellingPrice: number; imageUrl: string | null; isActive: boolean; quantity?: number };
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  personality: string;
  customInstructions: string | null;
  aiModel: string;
  temperature: number;
  maxTokens: number;
  sellAllProducts: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pages: AgentPage[];
  products: AgentProduct[];
  _count?: { pages: number; products: number };
}

export async function getAgents(): Promise<{ agents: Agent[] }> {
  return apiRequest('/api/user-stock/agents');
}

export async function getAgentApi(agentId: string): Promise<{ agent: Agent }> {
  return apiRequest(`/api/user-stock/agents/${agentId}`);
}

export async function createAgent(data: {
  name: string;
  description?: string;
  personality?: string;
  customInstructions?: string;
  aiModel?: string;
  temperature?: number;
  maxTokens?: number;
  sellAllProducts?: boolean;
  pageIds?: string[];
  productIds?: string[];
}): Promise<{ agent: Agent }> {
  return apiRequest('/api/user-stock/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAgentApi(
  agentId: string,
  data: {
    name?: string;
    description?: string;
    personality?: string;
    customInstructions?: string;
    aiModel?: string;
    temperature?: number;
    maxTokens?: number;
    sellAllProducts?: boolean;
    isActive?: boolean;
    pageIds?: string[];
    productIds?: string[];
  }
): Promise<{ agent: Agent }> {
  return apiRequest(`/api/user-stock/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAgentApi(agentId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/user-stock/agents/${agentId}`, { method: 'DELETE' });
}

export async function testAgentChat(
  agentId: string,
  data: { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }
): Promise<{ response: string }> {
  return apiRequest(`/api/user-stock/agents/${agentId}/test`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// AI Providers
// ============================================================================

export interface ActiveProvider {
  provider: string;
  displayName: string;
  models: string[];
}

export async function getActiveAIProviders(): Promise<{ providers: ActiveProvider[] }> {
  return apiRequest('/api/user-stock/ai-providers/active');
}
