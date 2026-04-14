'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Modal, Select, Pagination, ImageUploader, VariantEditor, RangeSlider } from '@/components/stock';
import type { VariantRow } from '@/components/stock';
import { Button, Input, Badge } from '@/components/ui';
import {
  PlusIcon, BoxIcon, EditIcon, TrashIcon, SearchIcon, AlertIcon, LayersIcon, ImageIcon, EyeIcon, FilterIcon, CloseIcon, SparklesIcon, DollarIcon, ArrowUpIcon, ArrowDownIcon, ChevronDownIcon,
} from '@/components/ui/icons';
import {
  getProducts,
  getProduct,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getUnits,
  createUnit,
  uploadProductImages,
  deleteProductImage,
  setPrimaryImage,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  adjustVariantStock,
  type Product,
  type Category,
  type Unit,
  type ProductImage,
  analyzeProductImage,
  getProductExpenses,
  getProductMarginsApi,
  createProductExpense,
  deleteProductExpenseApi,
  type ProductExpense,
  type ProductMargins,
} from '@/lib/user-stock-api';
import { API_BASE_URL } from '@/lib/api-config';
import { useFilterPanel } from '@/contexts/FilterPanelContext';

const LIMIT = 20;

// Default filter ranges
const DEFAULT_PRICE_MAX = 100000;
const DEFAULT_COST_MAX = 100000;
const DEFAULT_QTY_MAX = 10000;
const DEFAULT_PROFIT_MIN = -50000;
const DEFAULT_PROFIT_MAX = 50000;
const DEFAULT_MARGIN_MIN = -100;
const DEFAULT_MARGIN_MAX = 100;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting — newest first by default
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Filter panel state — shared with layout via context
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [draftPriceRange, setDraftPriceRange] = useState<[number, number]>([0, DEFAULT_PRICE_MAX]);
  const [draftCostRange, setDraftCostRange] = useState<[number, number]>([0, DEFAULT_COST_MAX]);
  const [draftQtyRange, setDraftQtyRange] = useState<[number, number]>([0, DEFAULT_QTY_MAX]);
  const [draftLowStock, setDraftLowStock] = useState(false);
  const [draftActiveFilter, setDraftActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [draftProfitRange, setDraftProfitRange] = useState<[number, number]>([DEFAULT_PROFIT_MIN, DEFAULT_PROFIT_MAX]);
  const [draftMarginRange, setDraftMarginRange] = useState<[number, number]>([DEFAULT_MARGIN_MIN, DEFAULT_MARGIN_MAX]);

  // Applied filters — stored in ref so loadProducts always reads latest values
  const appliedFiltersRef = useRef({
    categories: [] as string[],
    priceRange: [0, DEFAULT_PRICE_MAX] as [number, number],
    costRange: [0, DEFAULT_COST_MAX] as [number, number],
    qtyRange: [0, DEFAULT_QTY_MAX] as [number, number],
    profitRange: [DEFAULT_PROFIT_MIN, DEFAULT_PROFIT_MAX] as [number, number],
    marginRange: [DEFAULT_MARGIN_MIN, DEFAULT_MARGIN_MAX] as [number, number],
    lowStock: false,
    activeFilter: '' as '' | 'true' | 'false',
  });
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showAdjust, setShowAdjust] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  // New unit modal
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [newUnitForm, setNewUnitForm] = useState({ name: '', abbreviation: '' });

  // Product form
  const [form, setForm] = useState({
    sku: '', name: '', description: '', categoryId: '',
    costPrice: '', sellingPrice: '', quantity: '', minQuantity: '', unitId: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Image state
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Variant state
  const [hasVariants, setHasVariants] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Adjust form
  const [adjustForm, setAdjustForm] = useState({
    type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '',
    reason: '',
  });
  const [adjustVariantForms, setAdjustVariantForms] = useState<Record<string, { type: string; quantity: string; reason: string }>>({});

  // Expense panel state
  const [expenseProduct, setExpenseProduct] = useState<Product | null>(null);
  const [expenses, setExpenses] = useState<ProductExpense[]>([]);
  const [margins, setMargins] = useState<ProductMargins | null>(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'marketing', amount: '', isPerUnit: false, description: '' });
  const [addingExpense, setAddingExpense] = useState(false);

  // Count active APPLIED filters (badge on button) — re-derived on filterTrigger
  const activeFilterCount = useMemo(() => {
    const f = appliedFiltersRef.current;
    let count = 0;
    if (f.categories.length > 0) count++;
    if (f.priceRange[0] > 0 || f.priceRange[1] < DEFAULT_PRICE_MAX) count++;
    if (f.costRange[0] > 0 || f.costRange[1] < DEFAULT_COST_MAX) count++;
    if (f.qtyRange[0] > 0 || f.qtyRange[1] < DEFAULT_QTY_MAX) count++;
    if (f.profitRange[0] > DEFAULT_PROFIT_MIN || f.profitRange[1] < DEFAULT_PROFIT_MAX) count++;
    if (f.marginRange[0] > DEFAULT_MARGIN_MIN || f.marginRange[1] < DEFAULT_MARGIN_MAX) count++;
    if (f.lowStock) count++;
    if (f.activeFilter !== '') count++;
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTrigger]);

  // Check if draft differs from applied
  const draftDirty = useMemo(() => {
    const f = appliedFiltersRef.current;
    return (
      JSON.stringify(draftCategories) !== JSON.stringify(f.categories) ||
      draftPriceRange[0] !== f.priceRange[0] || draftPriceRange[1] !== f.priceRange[1] ||
      draftCostRange[0] !== f.costRange[0] || draftCostRange[1] !== f.costRange[1] ||
      draftQtyRange[0] !== f.qtyRange[0] || draftQtyRange[1] !== f.qtyRange[1] ||
      draftProfitRange[0] !== f.profitRange[0] || draftProfitRange[1] !== f.profitRange[1] ||
      draftMarginRange[0] !== f.marginRange[0] || draftMarginRange[1] !== f.marginRange[1] ||
      draftLowStock !== f.lowStock ||
      draftActiveFilter !== f.activeFilter
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCategories, draftPriceRange, draftCostRange, draftQtyRange, draftProfitRange, draftMarginRange, draftLowStock, draftActiveFilter, filterTrigger]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const f = appliedFiltersRef.current;
      const params: Record<string, any> = {
        search: searchDebounced || undefined,
        lowStock: f.lowStock || undefined,
        limit: LIMIT,
        offset,
        sortBy,
        sortOrder,
      };

      // Category filter — applied categories or toolbar dropdown
      if (f.categories.length === 1) {
        params.categoryId = f.categories[0];
      } else if (f.categories.length === 0 && categoryFilter) {
        params.categoryId = categoryFilter;
      }

      // Range filters — only send if not at defaults
      if (f.priceRange[0] > 0) params.minPrice = f.priceRange[0];
      if (f.priceRange[1] < DEFAULT_PRICE_MAX) params.maxPrice = f.priceRange[1];
      if (f.costRange[0] > 0) params.minCost = f.costRange[0];
      if (f.costRange[1] < DEFAULT_COST_MAX) params.maxCost = f.costRange[1];
      if (f.qtyRange[0] > 0) params.minQty = f.qtyRange[0];
      if (f.qtyRange[1] < DEFAULT_QTY_MAX) params.maxQty = f.qtyRange[1];

      if (f.profitRange[0] > DEFAULT_PROFIT_MIN) params.minProfit = f.profitRange[0];
      if (f.profitRange[1] < DEFAULT_PROFIT_MAX) params.maxProfit = f.profitRange[1];
      if (f.marginRange[0] > DEFAULT_MARGIN_MIN) params.minMargin = f.marginRange[0];
      if (f.marginRange[1] < DEFAULT_MARGIN_MAX) params.maxMargin = f.marginRange[1];

      if (f.activeFilter === 'true') params.isActive = true;
      else if (f.activeFilter === 'false') params.isActive = false;

      const res = await getProducts(params);
      setProducts(res.products);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, categoryFilter, offset, filterTrigger, sortBy, sortOrder]);

  const loadCategories = async () => {
    try {
      const res = await getCategories();
      setCategories(res.categories);
    } catch {}
  };

  const loadUnits = async () => {
    try {
      const res = await getUnits();
      setUnits(res.units);
    } catch {}
  };

  useEffect(() => { loadCategories(); loadUnits(); }, []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Close filter/expense panel when leaving the page
  useEffect(() => {
    return () => { setFiltersOpen(false); setExpenseProduct(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close modals when filter panel opens
  const toggleFilters = () => {
    if (!filtersOpen) {
      setViewing(null);
      setShowModal(false);
      setShowAdjust(null);
      setDeleteConfirm(null);
      setExpenseProduct(null); // close expense panel when opening filters
    }
    setFiltersOpen(!filtersOpen);
  };

  // Close filter panel when modals open
  const openAdd = () => {
    setFiltersOpen(false);
    setEditing(null);
    setForm({ sku: '', name: '', description: '', categoryId: '', costPrice: '', sellingPrice: '', quantity: '', minQuantity: '', unitId: '' });
    setFieldErrors({});
    setExistingImages([]);
    setNewImageFiles([]);
    setHasVariants(false);
    setVariantRows([]);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setFiltersOpen(false);
    setEditing(product);
    setFieldErrors({});
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId || '',
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      quantity: '',
      minQuantity: String(product.minQuantity),
      unitId: product.unitId || '',
    });
    setExistingImages(product.images || []);
    setNewImageFiles([]);
    setHasVariants(product.hasVariants);
    setVariantRows(
      (product.variants || []).map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku || '',
        costPrice: String(v.costPrice),
        sellingPrice: String(v.sellingPrice),
        quantity: String(v.quantity),
        minQuantity: String(v.minQuantity),
      }))
    );
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.sku.trim()) errors.sku = 'SKU is required';
    if (!form.name.trim()) errors.name = 'Product name is required';
    if (!editing) {
      if (!form.costPrice || parseFloat(form.costPrice) <= 0) errors.costPrice = 'Cost price is required';
      if (!form.sellingPrice || parseFloat(form.sellingPrice) <= 0) errors.sellingPrice = 'Selling price is required';
      if (!hasVariants && (!form.quantity || parseInt(form.quantity) <= 0)) errors.quantity = 'Initial quantity is required';
    }
    if (form.sellingPrice && form.costPrice && parseFloat(form.sellingPrice) < parseFloat(form.costPrice)) {
      errors.sellingPrice = 'Selling price should be ≥ cost price';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Scroll to first error field inside the modal
      setTimeout(() => {
        const firstKey = Object.keys(errors)[0];
        const labelMap: Record<string, string> = {
          sku: 'SKU *', name: 'Name *', costPrice: 'Cost Price (DA) *',
          sellingPrice: 'Selling Price (DA) *', quantity: 'Initial Quantity *',
        };
        const id = (labelMap[firstKey] || firstKey).toLowerCase().replace(/\s+/g, '-');
        const el = formRef.current?.querySelector(`#${CSS.escape(id)}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setError(null);
      setSaving(true);

      let productId: string;

      if (editing) {
        const res = await updateProduct(editing.id, {
          sku: form.sku,
          name: form.name,
          description: form.description,
          categoryId: form.categoryId || undefined,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice: parseFloat(form.sellingPrice) || 0,
          minQuantity: parseInt(form.minQuantity) || 0,
          unitId: form.unitId || undefined,
        });
        productId = res.product.id;

        // Handle variant changes for existing product
        if (hasVariants) {
          const existingVariantIds = (editing.variants || []).map((v) => v.id);
          for (const row of variantRows) {
            if (row.id) {
              await updateProductVariant(productId, row.id, {
                name: row.name,
                sku: row.sku || undefined,
                costPrice: parseFloat(row.costPrice) || 0,
                sellingPrice: parseFloat(row.sellingPrice) || 0,
                minQuantity: parseInt(row.minQuantity) || 0,
              });
            } else {
              await createProductVariant(productId, {
                name: row.name,
                sku: row.sku || undefined,
                costPrice: parseFloat(row.costPrice) || 0,
                sellingPrice: parseFloat(row.sellingPrice) || 0,
                quantity: parseInt(row.quantity) || 0,
                minQuantity: parseInt(row.minQuantity) || 0,
              });
            }
          }
          const keptIds = variantRows.filter((r) => r.id).map((r) => r.id!);
          for (const existingId of existingVariantIds) {
            if (!keptIds.includes(existingId)) {
              await deleteProductVariant(productId, existingId);
            }
          }
        } else if (editing.hasVariants) {
          for (const v of editing.variants || []) {
            await deleteProductVariant(productId, v.id);
          }
        }
      } else {
        const res = await createProduct({
          sku: form.sku,
          name: form.name,
          description: form.description,
          categoryId: form.categoryId || undefined,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice: parseFloat(form.sellingPrice) || 0,
          quantity: hasVariants ? 0 : (parseInt(form.quantity) || 0),
          minQuantity: parseInt(form.minQuantity) || 0,
          unitId: form.unitId || undefined,
          hasVariants,
        });
        productId = res.product.id;

        if (hasVariants) {
          for (const row of variantRows) {
            if (row.name.trim()) {
              await createProductVariant(productId, {
                name: row.name,
                sku: row.sku || undefined,
                costPrice: parseFloat(row.costPrice) || 0,
                sellingPrice: parseFloat(row.sellingPrice) || 0,
                quantity: parseInt(row.quantity) || 0,
                minQuantity: parseInt(row.minQuantity) || 0,
              });
            }
          }
        }
      }

      if (newImageFiles.length > 0) {
        await uploadProductImages(productId, newImageFiles);
      }

      setShowModal(false);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExistingImage = async (imageId: string) => {
    if (!editing) return;
    try {
      await deleteProductImage(editing.id, imageId);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!editing) return;
    try {
      await setPrimaryImage(editing.id, imageId);
      setExistingImages((prev) =>
        prev.map((img) => ({ ...img, isPrimary: img.id === imageId }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set primary image');
    }
  };

  const handleAnalyzeImage = async () => {
    if (newImageFiles.length === 0) return;
    try {
      setAnalyzing(true);
      setAnalyzeError(null);
      const result = await analyzeProductImage(newImageFiles[0]);
      setForm((prev) => ({
        ...prev,
        name: prev.name || result.name,
        description: prev.description || result.description,
        categoryId: prev.categoryId || (
          categories.find(c => c.name.toLowerCase() === result.suggestedCategory.toLowerCase())?.id || prev.categoryId
        ),
        unitId: prev.unitId || (
          units.find(u => u.name.toLowerCase() === result.suggestedUnit.toLowerCase())?.id || prev.unitId
        ),
      }));
    } catch (err: any) {
      setAnalyzeError(err.message || 'Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjust) return;
    try {
      setError(null);
      setAdjusting(true);

      if (showAdjust.hasVariants) {
        for (const [variantId, form] of Object.entries(adjustVariantForms)) {
          if (form.quantity && parseInt(form.quantity) > 0) {
            await adjustVariantStock(showAdjust.id, variantId, {
              type: form.type as 'in' | 'out' | 'adjustment',
              quantity: parseInt(form.quantity),
              reason: form.reason || undefined,
            });
          }
        }
      } else {
        await adjustStock(showAdjust.id, {
          type: adjustForm.type,
          quantity: parseInt(adjustForm.quantity),
          reason: adjustForm.reason || undefined,
        });
      }

      setShowAdjust(null);
      setAdjustForm({ type: 'in', quantity: '', reason: '' });
      setAdjustVariantForms({});
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteProduct(deleteConfirm.id);
      setDeleteConfirm(null);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUnit(newUnitForm);
      setUnits((prev) => [...prev, res.unit]);
      setForm((prev) => ({ ...prev, unitId: res.unit.id }));
      setShowNewUnit(false);
      setNewUnitForm({ name: '', abbreviation: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    }
  };

  // Expense panel functions
  const openExpensePanel = async (product: Product) => {
    setExpenseProduct(product);
    setExpenseForm({ category: 'marketing', amount: '', isPerUnit: false, description: '' });
    setFiltersOpen(true);
    try {
      setExpenseLoading(true);
      const [expRes, marginRes] = await Promise.all([
        getProductExpenses(product.id),
        getProductMarginsApi(product.id),
      ]);
      setExpenses(expRes.expenses);
      setMargins(marginRes.margins);
    } catch {
      // non-critical
    } finally {
      setExpenseLoading(false);
    }
  };

  const closeExpensePanel = () => {
    setExpenseProduct(null);
    setFiltersOpen(false);
  };

  const handleAddExpense = async () => {
    if (!expenseProduct || !expenseForm.amount) return;
    try {
      setAddingExpense(true);
      await createProductExpense(expenseProduct.id, {
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        isPerUnit: expenseForm.isPerUnit,
        description: expenseForm.description || undefined,
      });
      setExpenseForm({ category: 'marketing', amount: '', isPerUnit: false, description: '' });
      // Reload expenses & margins
      const [expRes, marginRes] = await Promise.all([
        getProductExpenses(expenseProduct.id),
        getProductMarginsApi(expenseProduct.id),
      ]);
      setExpenses(expRes.expenses);
      setMargins(marginRes.margins);
    } catch {
      // error handled silently
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!expenseProduct) return;
    try {
      await deleteProductExpenseApi(expenseProduct.id, expenseId);
      const [expRes, marginRes] = await Promise.all([
        getProductExpenses(expenseProduct.id),
        getProductMarginsApi(expenseProduct.id),
      ]);
      setExpenses(expRes.expenses);
      setMargins(marginRes.margins);
    } catch {
      // error handled silently
    }
  };

  const openView = async (product: Product) => {
    setFiltersOpen(false);
    try {
      setViewLoading(true);
      setViewing(product);
      const res = await getProduct(product.id);
      setViewing(res.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product details');
    } finally {
      setViewLoading(false);
    }
  };

  const getPrimaryImageUrl = (product: Product): string | null => {
    if (product.images && product.images.length > 0) {
      return `${API_BASE_URL}${product.images[0].url}`;
    }
    if (product.imageUrl) return product.imageUrl;
    return null;
  };

  // Apply draft filters → writes ref + bumps trigger → loadProducts re-runs
  const applyFilters = () => {
    appliedFiltersRef.current = {
      categories: [...draftCategories],
      priceRange: [...draftPriceRange],
      costRange: [...draftCostRange],
      qtyRange: [...draftQtyRange],
      profitRange: [...draftProfitRange],
      marginRange: [...draftMarginRange],
      lowStock: draftLowStock,
      activeFilter: draftActiveFilter,
    };
    setLowStockOnly(draftLowStock);
    setOffset(0);
    setFilterTrigger((t) => t + 1);
  };

  const clearAllFilters = () => {
    // Reset draft
    setDraftCategories([]);
    setDraftPriceRange([0, DEFAULT_PRICE_MAX]);
    setDraftCostRange([0, DEFAULT_COST_MAX]);
    setDraftQtyRange([0, DEFAULT_QTY_MAX]);
    setDraftProfitRange([DEFAULT_PROFIT_MIN, DEFAULT_PROFIT_MAX]);
    setDraftMarginRange([DEFAULT_MARGIN_MIN, DEFAULT_MARGIN_MAX]);
    setDraftLowStock(false);
    setDraftActiveFilter('');
    // Reset applied ref
    appliedFiltersRef.current = {
      categories: [],
      priceRange: [0, DEFAULT_PRICE_MAX],
      costRange: [0, DEFAULT_COST_MAX],
      qtyRange: [0, DEFAULT_QTY_MAX],
      profitRange: [DEFAULT_PROFIT_MIN, DEFAULT_PROFIT_MAX],
      marginRange: [DEFAULT_MARGIN_MIN, DEFAULT_MARGIN_MAX],
      lowStock: false,
      activeFilter: '',
    };
    setLowStockOnly(false);
    setCategoryFilter('');
    setOffset(0);
    setFilterTrigger((t) => t + 1);
  };

  const toggleCategoryChip = (catId: string) => {
    setDraftCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId]
    );
  };

  return (
    <div className="relative">
      {/* Main content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Products</h1>
            <p className="text-sm text-zinc-400 mt-1">{total} products</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFilters}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
                filtersOpen
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : activeFilterCount > 0
                    ? 'border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10'
                    : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              <FilterIcon className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>
              Add Product
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
          </div>
        )}

        {/* Search bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          {!filtersOpen && (
            <>
              <Select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setOffset(0); }}
                className="w-auto min-w-[160px]"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <button
                onClick={() => { const v = !lowStockOnly; setLowStockOnly(v); setDraftLowStock(v); appliedFiltersRef.current.lowStock = v; setOffset(0); setFilterTrigger((t) => t + 1); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  lowStockOnly
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                    : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                }`}
              >
                <AlertIcon className="w-4 h-4" />
                Low Stock
              </button>
            </>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="animate-pulse">
            <div className="h-64 bg-zinc-800 rounded-xl" />
          </div>
        ) : products.length > 0 ? (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3 w-10"></th>
                    {[
                      { key: 'name', label: 'Product', cls: 'text-left' },
                      { key: 'sku', label: 'SKU', cls: 'text-left' },
                      { key: '', label: 'Category', cls: 'text-left' },
                      { key: 'costPrice', label: 'Cost', cls: 'text-right' },
                      { key: 'sellingPrice', label: 'Price', cls: 'text-right' },
                      { key: '', label: 'Profit', cls: 'text-right' },
                      { key: '', label: 'Margin', cls: 'text-center' },
                      { key: 'quantity', label: 'Qty', cls: 'text-center' },
                      { key: '', label: 'Unit', cls: 'text-center' },
                    ].map((col) => {
                      const sortable = !!col.key;
                      const isSorted = sortable && sortBy === col.key;
                      return (
                        <th
                          key={col.label}
                          className={`${col.cls} text-xs font-medium px-4 py-3 ${
                            sortable ? 'cursor-pointer select-none hover:text-white transition-colors' : ''
                          } ${isSorted ? 'text-white' : 'text-zinc-400'}`}
                          onClick={sortable ? () => {
                            if (sortBy === col.key) {
                              setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(col.key);
                              setSortOrder(col.key === 'name' || col.key === 'sku' ? 'asc' : 'desc');
                            }
                            setOffset(0);
                          } : undefined}
                        >
                          <span className={`inline-flex items-center gap-1 ${col.cls.includes('right') ? 'justify-end' : col.cls.includes('center') ? 'justify-center' : ''}`}>
                            {col.label}
                            {isSorted && (
                              sortOrder === 'asc'
                                ? <ArrowUpIcon className="w-3 h-3" />
                                : <ArrowDownIcon className="w-3 h-3" />
                            )}
                          </span>
                        </th>
                      );
                    })}
                    <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const imgUrl = getPrimaryImageUrl(product);
                    const exps = product.expenses || [];
                    const fixedTotal = exps.filter(e => !e.isPerUnit).reduce((s, e) => s + Number(e.amount), 0);
                    const perUnitTotal = exps.filter(e => e.isPerUnit).reduce((s, e) => s + Number(e.amount), 0);
                    const qty = product.quantity || 1;
                    const expPerUnit = (fixedTotal / qty) + perUnitTotal;
                    const trueCost = Number(product.costPrice) + expPerUnit;
                    const sellingPrice = Number(product.sellingPrice);
                    const netProfit = sellingPrice - trueCost;
                    const marginPercent = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
                    return (
                      <React.Fragment key={product.id}>
                      <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/10">
                              <ImageIcon className="w-5 h-5 text-zinc-600" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium">{product.name}</span>
                            {product.hasVariants && (
                              <Badge variant="default">
                                <LayersIcon className="w-3 h-3 mr-1 inline" />
                                {product._count?.variants || '?'} variants
                              </Badge>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">{product.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">{product.sku}</td>
                        <td className="px-4 py-3 text-sm">
                          {product.category ? (
                            <Badge variant="default">{product.category.name}</Badge>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {exps.length === 0 ? (
                            <span className="text-zinc-400">{Number(product.costPrice).toLocaleString()} DA</span>
                          ) : (
                            <div className="relative group/cost">
                              <div className="flex items-center justify-end gap-1 cursor-help">
                                <span className="text-orange-400 font-medium">{trueCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} DA</span>
                                <span className="text-[10px] text-orange-400/60">+</span>
                              </div>
                              <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover/cost:block w-56 bg-zinc-800 border border-white/10 rounded-lg shadow-xl p-3 space-y-1.5">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-400">Base Cost</span>
                                  <span className="text-white">{Number(product.costPrice).toLocaleString()} DA</span>
                                </div>
                                {exps.map((exp) => (
                                  <div key={exp.id} className="flex justify-between text-xs">
                                    <span className="text-zinc-500">{exp.category}{exp.isPerUnit ? ' /unit' : ' (fixed)'}</span>
                                    <span className="text-orange-400">
                                      +{exp.isPerUnit
                                        ? `${Number(exp.amount).toLocaleString()} DA/u`
                                        : `${(Number(exp.amount) / qty).toLocaleString(undefined, { maximumFractionDigits: 2 })} DA/u (${Number(exp.amount).toLocaleString()} total)`
                                      }
                                    </span>
                                  </div>
                                ))}
                                <div className="border-t border-white/10 pt-1.5 flex justify-between text-xs font-medium">
                                  <span className="text-zinc-300">True Cost</span>
                                  <span className="text-white">{trueCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} DA</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-emerald-400">
                          {sellingPrice.toLocaleString()} DA
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} DA
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            marginPercent >= 30 ? 'bg-emerald-500/10 text-emerald-400' :
                            marginPercent >= 10 ? 'bg-yellow-500/10 text-yellow-400' :
                            marginPercent >= 0 ? 'bg-orange-500/10 text-orange-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {marginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <Badge variant={product.quantity <= product.minQuantity ? 'warning' : 'success'}>
                            {product.quantity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-zinc-400">
                          {product.unitRef?.abbreviation || product.unit}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setExpandedRowId(prev => prev === product.id ? null : product.id)}
                              className={`p-1.5 rounded-lg transition-all ${
                                expandedRowId === product.id
                                  ? 'bg-white/10 text-white'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
                              }`}
                              title="Actions"
                              aria-expanded={expandedRowId === product.id}
                            >
                              <ChevronDownIcon className={`w-4 h-4 transition-transform ${expandedRowId === product.id ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRowId === product.id && (
                        <tr key={`${product.id}-actions`} className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={11} className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-2 animate-[slideDown_0.2s_ease-out]">
                              <button
                                onClick={() => {
                                  setShowAdjust(product);
                                  setAdjustForm({ type: 'in', quantity: '', reason: '' });
                                  if (product.hasVariants && product.variants) {
                                    const forms: Record<string, { type: string; quantity: string; reason: string }> = {};
                                    product.variants.forEach((v) => { forms[v.id] = { type: 'in', quantity: '', reason: '' }; });
                                    setAdjustVariantForms(forms);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                              >
                                Adjust Stock
                              </button>
                              <button
                                onClick={() => openExpensePanel(product)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
                              >
                                <DollarIcon className="w-3.5 h-3.5" />
                                Expenses
                              </button>
                              <button
                                onClick={() => openView(product)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors"
                              >
                                <EyeIcon className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                onClick={() => openEdit(product)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(product)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
            <div className="text-zinc-600 mb-4 flex justify-center"><BoxIcon className="w-16 h-16" /></div>
            <h3 className="text-lg font-medium text-zinc-300 mb-1">No Products</h3>
            <p className="text-sm text-zinc-500 mb-4">
              {activeFilterCount > 0 ? 'No products match your filters' : 'Add your first product to get started'}
            </p>
            {activeFilterCount > 0 ? (
              <Button onClick={clearAllFilters} variant="outline">Clear Filters</Button>
            ) : (
              <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>Add Product</Button>
            )}
          </div>
        )}

        <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />
      </div>

      {/* Expense Panel — Right Side */}
      {expenseProduct && (
        <div
          className={`fixed top-0 right-0 h-full w-[336px] bg-zinc-900 border-l border-white/10 z-[45] transition-transform duration-300 ease-in-out flex flex-col ${
            filtersOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <DollarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-semibold text-white truncate">{expenseProduct.name}</h2>
            </div>
            <button
              onClick={closeExpensePanel}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {expenseLoading ? (
              <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
            ) : (
              <>
                {/* Margin Summary */}
                {margins && (
                  <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Margin Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Cost Price</span>
                        <span className="text-white">{margins.costPrice.toLocaleString()} DA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Selling Price</span>
                        <span className="text-white">{margins.sellingPrice.toLocaleString()} DA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Total Expenses</span>
                        <span className="text-orange-400">{margins.totalExpenses.toLocaleString()} DA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Expense/Unit</span>
                        <span className="text-orange-400">{margins.expensePerUnit.toFixed(2)} DA</span>
                      </div>
                      <div className="border-t border-white/10 pt-2 flex justify-between">
                        <span className="text-zinc-400">True Cost</span>
                        <span className="text-white font-semibold">{margins.trueCost.toFixed(2)} DA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Net Margin</span>
                        <span className={`font-semibold ${margins.netMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {margins.netMargin.toFixed(2)} DA ({margins.marginPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expense List */}
                <div>
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Expenses ({expenses.length})</h3>
                  {expenses.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3">No expenses yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {expenses.map((exp) => (
                        <div key={exp.id} className="flex items-start justify-between gap-2 bg-zinc-800/50 rounded-lg p-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-700 text-zinc-300">
                                {exp.category}
                              </span>
                              {exp.isPerUnit && (
                                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-medium">/unit</span>
                              )}
                            </div>
                            {exp.description && (
                              <p className="text-xs text-zinc-500 mt-1 truncate">{exp.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-sm font-medium text-white">{Number(exp.amount).toLocaleString()} DA</span>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <TrashIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Expense Form */}
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Add Expense</h3>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="marketing">Marketing</option>
                    <option value="shipping">Shipping</option>
                    <option value="packaging">Packaging</option>
                    <option value="customs">Customs</option>
                    <option value="storage">Storage</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="flex-1 px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                    <button
                      onClick={() => setExpenseForm({ ...expenseForm, isPerUnit: !expenseForm.isPerUnit })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        expenseForm.isPerUnit
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                          : 'border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {expenseForm.isPerUnit ? '/unit' : 'fixed'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    onClick={handleAddExpense}
                    disabled={addingExpense || !expenseForm.amount}
                    className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {addingExpense ? 'Adding...' : 'Add Expense'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter Panel — Right Side */}
      {!expenseProduct && (
      <div
        className={`fixed top-0 right-0 h-full w-[336px] bg-zinc-900 border-l border-white/10 z-[45] transition-transform duration-300 ease-in-out flex flex-col ${
          filtersOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-medium">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Panel body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Category chips */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = draftCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategoryChip(cat.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                      isSelected
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {cat.name}
                    {cat._count?.products !== undefined && (
                      <span className={`ml-1 ${isSelected ? 'text-blue-200' : 'text-zinc-500'}`}>
                        {cat._count.products}
                      </span>
                    )}
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-zinc-500">No categories yet</p>
              )}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Selling Price (DA)
              {(draftPriceRange[0] > 0 || draftPriceRange[1] < DEFAULT_PRICE_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftPriceRange[0].toLocaleString()} - {draftPriceRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_PRICE_MAX}
              value={draftPriceRange}
              onChange={setDraftPriceRange}
              step={100}
              formatLabel={(v) => `${v.toLocaleString()} DA`}
            />
          </div>

          {/* Cost Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Cost Price (DA)
              {(draftCostRange[0] > 0 || draftCostRange[1] < DEFAULT_COST_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftCostRange[0].toLocaleString()} - {draftCostRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_COST_MAX}
              value={draftCostRange}
              onChange={setDraftCostRange}
              step={100}
              formatLabel={(v) => `${v.toLocaleString()} DA`}
            />
          </div>

          {/* Quantity Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Quantity
              {(draftQtyRange[0] > 0 || draftQtyRange[1] < DEFAULT_QTY_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftQtyRange[0].toLocaleString()} - {draftQtyRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_QTY_MAX}
              value={draftQtyRange}
              onChange={setDraftQtyRange}
              step={1}
              formatLabel={(v) => v.toLocaleString()}
            />
          </div>

          {/* Net Profit Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Net Profit (DA)
              {(draftProfitRange[0] > DEFAULT_PROFIT_MIN || draftProfitRange[1] < DEFAULT_PROFIT_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftProfitRange[0] >= 0 ? '+' : ''}{draftProfitRange[0].toLocaleString()} - {draftProfitRange[1] >= 0 ? '+' : ''}{draftProfitRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={DEFAULT_PROFIT_MIN}
              max={DEFAULT_PROFIT_MAX}
              value={draftProfitRange}
              onChange={setDraftProfitRange}
              step={100}
              formatLabel={(v) => `${v >= 0 ? '+' : ''}${v.toLocaleString()} DA`}
            />
          </div>

          {/* Margin % Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Margin (%)
              {(draftMarginRange[0] > DEFAULT_MARGIN_MIN || draftMarginRange[1] < DEFAULT_MARGIN_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftMarginRange[0]}% - {draftMarginRange[1]}%
                </span>
              )}
            </label>
            <RangeSlider
              min={DEFAULT_MARGIN_MIN}
              max={DEFAULT_MARGIN_MAX}
              value={draftMarginRange}
              onChange={setDraftMarginRange}
              step={1}
              formatLabel={(v) => `${v}%`}
            />
          </div>

          {/* Low Stock Toggle */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">Stock Level</label>
            <button
              onClick={() => setDraftLowStock(!draftLowStock)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                draftLowStock
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertIcon className={`w-4 h-4 ${draftLowStock ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span className={`text-sm ${draftLowStock ? 'text-amber-400' : 'text-zinc-400'}`}>Low Stock Only</span>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${draftLowStock ? 'bg-amber-500' : 'bg-zinc-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${draftLowStock ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Active/Inactive Toggle */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">Status</label>
            <div className="flex gap-1.5">
              {[
                { value: '' as const, label: 'All' },
                { value: 'true' as const, label: 'Active' },
                { value: 'false' as const, label: 'Inactive' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraftActiveFilter(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    draftActiveFilter === opt.value
                      ? opt.value === 'true'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : opt.value === 'false'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel footer */}
        <div className="px-5 py-4 border-t border-white/10 shrink-0 space-y-2">
          <button
            onClick={applyFilters}
            disabled={!draftDirty}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
          >
            Apply Filters
          </button>
          <button
            onClick={clearAllFilters}
            disabled={activeFilterCount === 0 && !draftDirty}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700"
          >
            Clear All{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
        </div>
      </div>
      )}

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="xl"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" ref={formRef}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU *" value={form.sku} onChange={(e) => { setForm({ ...form, sku: e.target.value }); setFieldErrors(prev => { const { sku, ...rest } = prev; return rest; }); }} error={fieldErrors.sku} placeholder="e.g., PRD-001" />
            <Input label="Name *" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors(prev => { const { name, ...rest } = prev; return rest; }); }} error={fieldErrors.name} placeholder="Product name" />
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the product — the AI agent uses this to sell it" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={editing ? "Cost Price (DA)" : "Cost Price (DA) *"} type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => { setForm({ ...form, costPrice: e.target.value }); setFieldErrors(prev => { const { costPrice, ...rest } = prev; return rest; }); }} error={fieldErrors.costPrice} placeholder="0" />
            <Input label={editing ? "Selling Price (DA)" : "Selling Price (DA) *"} type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => { setForm({ ...form, sellingPrice: e.target.value }); setFieldErrors(prev => { const { sellingPrice, ...rest } = prev; return rest; }); }} error={fieldErrors.sellingPrice} placeholder="0" />
          </div>

          {/* Quantity / Min — hide product-level qty when variants are on */}
          <div className="grid grid-cols-2 gap-4">
            {!editing && !hasVariants && (
              <Input label="Initial Quantity *" type="number" min="0" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setFieldErrors(prev => { const { quantity, ...rest } = prev; return rest; }); }} error={fieldErrors.quantity} placeholder="0" />
            )}
            {hasVariants && !editing && <div />}
            <Input label="Min Quantity (Alert)" type="number" min="0" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} placeholder="0" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">No Category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select label="Unit" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
                    <option value="">Select Unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                    ))}
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewUnit(true)}
                  className="mt-6 p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                  title="Add custom unit"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Images Section */}
          <div className="border-t border-white/10 pt-4">
            <ImageUploader
              existingImages={existingImages}
              newFiles={newImageFiles}
              onFilesAdded={(files) => setNewImageFiles((prev) => [...prev, ...files])}
              onRemoveNewFile={(i) => setNewImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
              onDeleteExisting={handleDeleteExistingImage}
              onSetPrimary={handleSetPrimary}
            />
            {/* AI Analyze Button */}
            {newImageFiles.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleAnalyzeImage}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-60"
                >
                  {analyzing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                  {analyzing ? 'Analyzing...' : 'AI Auto-Fill from Image'}
                </button>
                {analyzeError && (
                  <p className="text-xs text-red-400 mt-1">{analyzeError}</p>
                )}
              </div>
            )}
          </div>

          {/* Variants Section */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="rounded border-white/20 bg-black text-emerald-500 focus:ring-emerald-500/30"
              />
              <span className="text-sm text-zinc-300">This product has variants</span>
            </label>

            {hasVariants && (
              <VariantEditor
                variants={variantRows}
                onChange={setVariantRows}
                isEditing={!!editing}
              />
            )}

            {hasVariants && editing && (
              <p className="text-xs text-zinc-500">
                To adjust variant quantities, use the &quot;Adjust&quot; button in the product table.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : (editing ? 'Update' : 'Add')} {!saving && 'Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Unit Modal */}
      <Modal
        isOpen={showNewUnit}
        onClose={() => setShowNewUnit(false)}
        title="Add Custom Unit"
        size="sm"
      >
        <form onSubmit={handleCreateUnit} className="space-y-4">
          <Input
            label="Unit Name *"
            value={newUnitForm.name}
            onChange={(e) => setNewUnitForm({ ...newUnitForm, name: e.target.value })}
            required
            placeholder="e.g., Dozen"
          />
          <Input
            label="Abbreviation *"
            value={newUnitForm.abbreviation}
            onChange={(e) => setNewUnitForm({ ...newUnitForm, abbreviation: e.target.value })}
            required
            placeholder="e.g., dz"
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewUnit(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">Add Unit</Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={!!showAdjust}
        onClose={() => setShowAdjust(null)}
        title="Adjust Stock"
        size={showAdjust?.hasVariants ? 'lg' : 'md'}
      >
        {showAdjust && (
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-3 mb-2">
              <p className="text-white font-medium">{showAdjust.name}</p>
              <p className="text-sm text-zinc-400">
                Current stock: <span className="text-white font-medium">{showAdjust.quantity}</span> {showAdjust.unitRef?.abbreviation || showAdjust.unit}
              </p>
            </div>

            {showAdjust.hasVariants && showAdjust.variants ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {showAdjust.variants.map((v) => (
                  <div key={v.id} className="bg-zinc-800/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium">{v.name}</span>
                      <span className="text-xs text-zinc-400">Qty: {v.quantity}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={adjustVariantForms[v.id]?.type || 'in'}
                        onChange={(e) => setAdjustVariantForms((prev) => ({ ...prev, [v.id]: { ...prev[v.id], type: e.target.value } }))}
                      >
                        <option value="in">In (+)</option>
                        <option value="out">Out (-)</option>
                        <option value="adjustment">Set</option>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        value={adjustVariantForms[v.id]?.quantity || ''}
                        onChange={(e) => setAdjustVariantForms((prev) => ({ ...prev, [v.id]: { ...prev[v.id], quantity: e.target.value } }))}
                        placeholder="Qty"
                      />
                      <Input
                        value={adjustVariantForms[v.id]?.reason || ''}
                        onChange={(e) => setAdjustVariantForms((prev) => ({ ...prev, [v.id]: { ...prev[v.id], reason: e.target.value } }))}
                        placeholder="Reason"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Select
                  label="Adjustment Type"
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
                >
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (-)</option>
                  <option value="adjustment">Set Exact Quantity</option>
                </Select>
                <Input
                  label="Quantity *"
                  type="number"
                  min="0"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  required
                  placeholder="Enter quantity"
                />
                <Input
                  label="Reason"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g., Inventory count, damaged goods"
                />
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdjust(null)} disabled={adjusting}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={adjusting}>
                {adjusting ? 'Adjusting...' : 'Adjust Stock'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Product Details Modal */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Product Details"
        size="lg"
      >
        {viewing && viewLoading && (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Loading product details...</p>
          </div>
        )}
        {viewing && !viewLoading && (() => {
          const allImages = (viewing.images || []).map((img) => `${API_BASE_URL}${img.url}`);
          if (!allImages.length && viewing.imageUrl) allImages.push(viewing.imageUrl);
          const profit = Number(viewing.sellingPrice) - Number(viewing.costPrice);
          const margin = Number(viewing.sellingPrice) > 0
            ? ((profit / Number(viewing.sellingPrice)) * 100).toFixed(1)
            : '0';

          return (
            <div className="space-y-5">
              {/* Images */}
              {allImages.length > 0 ? (
                <div className="space-y-2">
                  <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={allImages[0]}
                      alt={viewing.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  {allImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {allImages.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover border-2 border-white/10 flex-shrink-0 cursor-pointer hover:border-white/30 transition-colors"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-40 bg-zinc-800/50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No images</p>
                  </div>
                </div>
              )}

              {/* Product Info */}
              <div>
                <h3 className="text-lg font-bold text-white">{viewing.name}</h3>
                <p className="text-sm text-zinc-500">{viewing.sku}</p>
                {viewing.description && (
                  <p className="text-sm text-zinc-400 mt-2">{viewing.description}</p>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-zinc-500">Cost Price</p>
                  <p className="text-sm font-bold text-zinc-300 mt-0.5">{Number(viewing.costPrice).toLocaleString()} DA</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-zinc-500">Selling Price</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{Number(viewing.sellingPrice).toLocaleString()} DA</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-zinc-500">Profit / Margin</p>
                  <p className={`text-sm font-bold mt-0.5 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {profit.toLocaleString()} DA ({margin}%)
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-zinc-500">In Stock</p>
                  <p className={`text-sm font-bold mt-0.5 ${viewing.quantity <= viewing.minQuantity ? 'text-amber-400' : 'text-white'}`}>
                    {viewing.quantity} {viewing.unitRef?.abbreviation || viewing.unit}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Category</p>
                  <p className="text-sm text-white">{viewing.category?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Unit</p>
                  <p className="text-sm text-white">{viewing.unitRef ? `${viewing.unitRef.name} (${viewing.unitRef.abbreviation})` : viewing.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Min Quantity (Alert)</p>
                  <p className="text-sm text-white">{viewing.minQuantity}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Status</p>
                  <Badge variant={viewing.isActive ? 'success' : 'error'}>
                    {viewing.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Variants */}
              {viewing.hasVariants && viewing.variants && viewing.variants.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Variants ({viewing.variants.length})</p>
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-zinc-800/50">
                          <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Name</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">SKU</th>
                          <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Cost</th>
                          <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Price</th>
                          <th className="text-center text-xs font-medium text-zinc-400 px-3 py-2">Qty</th>
                          <th className="text-center text-xs font-medium text-zinc-400 px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewing.variants.map((v) => (
                          <tr key={v.id} className="border-t border-white/5">
                            <td className="px-3 py-2 text-sm text-white">{v.name}</td>
                            <td className="px-3 py-2 text-xs text-zinc-500">{v.sku || '-'}</td>
                            <td className="px-3 py-2 text-sm text-right text-zinc-400">{Number(v.costPrice).toLocaleString()} DA</td>
                            <td className="px-3 py-2 text-sm text-right text-emerald-400">{Number(v.sellingPrice).toLocaleString()} DA</td>
                            <td className="px-3 py-2 text-sm text-center">
                              <Badge variant={v.quantity <= v.minQuantity ? 'warning' : 'success'}>{v.quantity}</Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={v.isActive ? 'success' : 'error'}>
                                {v.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setViewing(null);
                    openEdit(viewing);
                  }}
                  icon={<EditIcon className="w-4 h-4" />}
                >
                  Edit
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setViewing(null)}>
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Product"
        size="sm"
      >
        <p className="text-zinc-400 mb-4">
          Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm?.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
          <Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
