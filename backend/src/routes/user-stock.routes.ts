import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  // Categories
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Products
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  // Stock
  adjustStock,
  getStockMovements,
  // Suppliers
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  // Dashboard
  getStockDashboard,
  // AI Image Analysis
  analyzeProductImageEndpoint,
  // Product Expenses
  getProductExpenses,
  getProductMargins,
  createProductExpense,
  updateProductExpense,
  deleteProductExpense,
} from '../controllers/user-stock.controller';
import {
  getSales,
  getSale,
  createSale,
  updateSalePayment,
  deleteSale,
  getSalesStats,
} from '../controllers/user-sales.controller';
import {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  receivePurchaseItems,
  getPurchaseStats,
} from '../controllers/user-purchases.controller';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientMetrics,
} from '../controllers/user-clients.controller';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  addOrderCall,
  getOrderCalls,
  getOrderStats,
} from '../controllers/user-orders.controller';
import {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  testAgent,
  getAgentMetrics,
  getAgentInsights,
  resolveInsight,
} from '../controllers/user-agents.controller';
import {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
} from '../controllers/user-units.controller';
import {
  uploadImages,
  getImages,
  deleteImage,
  reorderImages,
  setPrimaryImage,
} from '../controllers/user-product-images.controller';
import {
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
  adjustVariantStock,
} from '../controllers/user-product-variants.controller';
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '../controllers/user-notifications.controller';
import {
  getWilayas,
  getAvailableProviders,
  getProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  testProviderCredentials,
  sendOrderToDelivery,
  getTrackingInfo,
  getShippingLabel,
  getDeliveryRates,
} from '../controllers/user-delivery.controller';
import {
  getCaisseTransactions,
  getCaisseStats,
  createCaisseTransaction,
  updateCaisseTransaction,
  deleteCaisseTransaction,
} from '../controllers/user-caisse.controller';
import {
  getDeliveryFeeRules,
  upsertDeliveryFeeRule,
  seedDeliveryFees,
  deleteDeliveryFeeRule,
  quoteDeliveryFee,
} from '../controllers/user-delivery-fees.controller';
import {
  getRecommendations,
  getRecommendationStats,
  getProductRecommendations,
  generateRecommendationsEndpoint,
  updateRecommendation,
  deleteRecommendation,
} from '../controllers/user-cross-sell.controller';
import { uploadProductImages } from '../config/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Dashboard
// ============================================================================
router.get('/dashboard', getStockDashboard);

// ============================================================================
// Units
// ============================================================================
router.get('/units', getUnits);
router.post('/units', createUnit);
router.put('/units/:unitId', updateUnit);
router.delete('/units/:unitId', deleteUnit);

// ============================================================================
// Categories
// ============================================================================
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:categoryId', updateCategory);
router.delete('/categories/:categoryId', deleteCategory);

// ============================================================================
// Products
// ============================================================================
router.get('/products', getProducts);
router.post('/products/analyze-image', uploadProductImages.single('image'), analyzeProductImageEndpoint);
router.get('/products/:productId', getProduct);
router.post('/products', createProduct);
router.put('/products/:productId', updateProduct);
router.delete('/products/:productId', deleteProduct);

// Stock adjustments
router.post('/products/:productId/adjust', adjustStock);
router.get('/movements', getStockMovements);

// ============================================================================
// Product Images
// ============================================================================
router.get('/products/:productId/images', getImages);
router.post('/products/:productId/images', uploadProductImages.array('images', 10), uploadImages);
router.delete('/products/:productId/images/:imageId', deleteImage);
router.put('/products/:productId/images/reorder', reorderImages);
router.put('/products/:productId/images/:imageId/primary', setPrimaryImage);

// ============================================================================
// Product Expenses
// ============================================================================
router.get('/products/:productId/expenses', getProductExpenses);
router.get('/products/:productId/margins', getProductMargins);
router.post('/products/:productId/expenses', createProductExpense);
router.put('/products/:productId/expenses/:expenseId', updateProductExpense);
router.delete('/products/:productId/expenses/:expenseId', deleteProductExpense);

// ============================================================================
// Product Variants
// ============================================================================
router.get('/products/:productId/variants', getVariants);
router.post('/products/:productId/variants', createVariant);
router.put('/products/:productId/variants/:variantId', updateVariant);
router.delete('/products/:productId/variants/:variantId', deleteVariant);
router.post('/products/:productId/variants/:variantId/adjust', adjustVariantStock);

// ============================================================================
// Suppliers
// ============================================================================
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.put('/suppliers/:supplierId', updateSupplier);
router.delete('/suppliers/:supplierId', deleteSupplier);

// ============================================================================
// Clients
// ============================================================================
router.get('/clients', getClients);
router.get('/clients/:clientId', getClient);
router.get('/clients/:clientId/metrics', getClientMetrics);
router.post('/clients', createClient);
router.put('/clients/:clientId', updateClient);
router.delete('/clients/:clientId', deleteClient);

// ============================================================================
// Sales
// ============================================================================
router.get('/sales', getSales);
router.get('/sales/stats', getSalesStats);
router.get('/sales/:saleId', getSale);
router.post('/sales', createSale);
router.put('/sales/:saleId', updateSalePayment);
router.delete('/sales/:saleId', deleteSale);

// ============================================================================
// Purchases
// ============================================================================
router.get('/purchases', getPurchases);
router.get('/purchases/stats', getPurchaseStats);
router.get('/purchases/:purchaseId', getPurchase);
router.post('/purchases', createPurchase);
router.put('/purchases/:purchaseId', updatePurchase);
router.delete('/purchases/:purchaseId', deletePurchase);
router.post('/purchases/:purchaseId/receive', receivePurchaseItems);

// ============================================================================
// Orders
// ============================================================================
router.get('/orders/stats', getOrderStats);
router.get('/orders', getOrders);
router.get('/orders/:orderId', getOrder);
router.post('/orders', createOrder);
router.put('/orders/:orderId', updateOrder);
router.delete('/orders/:orderId', deleteOrder);
router.get('/orders/:orderId/calls', getOrderCalls);
router.post('/orders/:orderId/calls', addOrderCall);

// ============================================================================
// Agents
// ============================================================================
router.get('/agents', getAgents);
router.get('/agents/:agentId', getAgent);
router.get('/agents/:agentId/metrics', getAgentMetrics);
router.get('/agents/:agentId/insights', getAgentInsights);
router.post('/agents', createAgent);
router.put('/agents/:agentId', updateAgent);
router.delete('/agents/:agentId', deleteAgent);
router.post('/agents/:agentId/test', testAgent);
router.put('/agents/insights/:insightId', resolveInsight);

// ============================================================================
// Notifications
// ============================================================================
router.get('/notifications', getNotifications);
router.get('/notifications/unread-count', getUnreadCount);
router.put('/notifications/read-all', markAllAsRead);
router.put('/notifications/:id/read', markAsRead);

// ============================================================================
// AI Providers (active models for agent form)
// ============================================================================
import { getActiveProviders } from '../controllers/ai-providers.controller';

router.get('/ai-providers/active', getActiveProviders);

// ============================================================================
// Cross-Sell / Up-Sell Recommendations
// ============================================================================
router.get('/cross-sell', getRecommendations);
router.get('/cross-sell/stats', getRecommendationStats);
router.get('/cross-sell/product/:productId', getProductRecommendations);
router.post('/cross-sell/generate', generateRecommendationsEndpoint);
router.put('/cross-sell/:id', updateRecommendation);
router.delete('/cross-sell/:id', deleteRecommendation);

// ============================================================================
// Caisse (Cash Register)
// ============================================================================
router.get('/caisse', getCaisseTransactions);
router.get('/caisse/stats', getCaisseStats);
router.post('/caisse', createCaisseTransaction);
router.put('/caisse/:id', updateCaisseTransaction);
router.delete('/caisse/:id', deleteCaisseTransaction);

// ============================================================================
// Delivery (CourierDZ integration)
// ============================================================================
router.get('/delivery/wilayas', getWilayas);
router.get('/delivery/providers', getProviders);
router.get('/delivery/providers/available', getAvailableProviders);
router.post('/delivery/providers', addProvider);
router.put('/delivery/providers/:id', updateProvider);
router.delete('/delivery/providers/:id', deleteProvider);
router.post('/delivery/providers/test', testProviderCredentials);
router.post('/delivery/send/:orderId', sendOrderToDelivery);
router.get('/delivery/track/:orderId', getTrackingInfo);
router.get('/delivery/label/:orderId', getShippingLabel);
router.get('/delivery/rates', getDeliveryRates);

// Delivery fee rules (user-managed per-wilaya pricing + quote)
router.get('/delivery/fees', getDeliveryFeeRules);
router.post('/delivery/fees', upsertDeliveryFeeRule);
router.post('/delivery/fees/seed', seedDeliveryFees);
router.delete('/delivery/fees/:wilayaId', deleteDeliveryFeeRule);
router.get('/delivery/fees/quote', quoteDeliveryFee);

export default router;
