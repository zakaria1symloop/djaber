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
} from '../controllers/stock.controller';
import {
  getSales,
  getSale,
  createSale,
  updateSalePayment,
  getSalesStats,
} from '../controllers/sales.controller';
import {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  receivePurchaseItems,
  getPurchaseStats,
} from '../controllers/purchases.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Dashboard
// ============================================================================
router.get('/:pageId/dashboard', getStockDashboard);

// ============================================================================
// Categories
// ============================================================================
router.get('/:pageId/categories', getCategories);
router.post('/:pageId/categories', createCategory);
router.put('/:pageId/categories/:categoryId', updateCategory);
router.delete('/:pageId/categories/:categoryId', deleteCategory);

// ============================================================================
// Products
// ============================================================================
router.get('/:pageId/products', getProducts);
router.get('/:pageId/products/:productId', getProduct);
router.post('/:pageId/products', createProduct);
router.put('/:pageId/products/:productId', updateProduct);
router.delete('/:pageId/products/:productId', deleteProduct);

// Stock adjustments
router.post('/:pageId/products/:productId/adjust', adjustStock);
router.get('/:pageId/movements', getStockMovements);

// ============================================================================
// Suppliers
// ============================================================================
router.get('/:pageId/suppliers', getSuppliers);
router.post('/:pageId/suppliers', createSupplier);
router.put('/:pageId/suppliers/:supplierId', updateSupplier);
router.delete('/:pageId/suppliers/:supplierId', deleteSupplier);

// ============================================================================
// Sales
// ============================================================================
router.get('/:pageId/sales', getSales);
router.get('/:pageId/sales/stats', getSalesStats);
router.get('/:pageId/sales/:saleId', getSale);
router.post('/:pageId/sales', createSale);
router.put('/:pageId/sales/:saleId', updateSalePayment);

// ============================================================================
// Purchases
// ============================================================================
router.get('/:pageId/purchases', getPurchases);
router.get('/:pageId/purchases/stats', getPurchaseStats);
router.get('/:pageId/purchases/:purchaseId', getPurchase);
router.post('/:pageId/purchases', createPurchase);
router.put('/:pageId/purchases/:purchaseId', updatePurchase);
router.post('/:pageId/purchases/:purchaseId/receive', receivePurchaseItems);

export default router;
