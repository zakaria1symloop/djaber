'use client';

import { useEffect, useState, useCallback } from 'react';
import { Modal, Select, Pagination, ImageUploader, VariantEditor } from '@/components/stock';
import type { VariantRow } from '@/components/stock';
import { Button, Input, Badge } from '@/components/ui';
import {
  PlusIcon, BoxIcon, EditIcon, TrashIcon, SearchIcon, AlertIcon, LayersIcon, ImageIcon, EyeIcon,
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
  type ProductVariant,
} from '@/lib/user-stock-api';
import { API_BASE_URL } from '@/lib/api-config';

const LIMIT = 20;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

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

  // Image state
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);

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
      const res = await getProducts({
        search: searchDebounced || undefined,
        categoryId: categoryFilter || undefined,
        lowStock: lowStockOnly || undefined,
        limit: LIMIT,
        offset,
      });
      setProducts(res.products);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, categoryFilter, lowStockOnly, offset]);

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

  const openAdd = () => {
    setEditing(null);
    setForm({ sku: '', name: '', description: '', categoryId: '', costPrice: '', sellingPrice: '', quantity: '', minQuantity: '', unitId: '' });
    setExistingImages([]);
    setNewImageFiles([]);
    setHasVariants(false);
    setVariantRows([]);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
              // Update existing variant
              await updateProductVariant(productId, row.id, {
                name: row.name,
                sku: row.sku || undefined,
                costPrice: parseFloat(row.costPrice) || 0,
                sellingPrice: parseFloat(row.sellingPrice) || 0,
                minQuantity: parseInt(row.minQuantity) || 0,
              });
            } else {
              // Create new variant
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
          // Delete removed variants
          const keptIds = variantRows.filter((r) => r.id).map((r) => r.id!);
          for (const existingId of existingVariantIds) {
            if (!keptIds.includes(existingId)) {
              await deleteProductVariant(productId, existingId);
            }
          }
        } else if (editing.hasVariants) {
          // Variants were toggled off — delete all
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
        });
        productId = res.product.id;

        // Create variants for new product
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

      // Upload new images
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

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjust) return;
    try {
      setError(null);
      setAdjusting(true);

      if (showAdjust.hasVariants) {
        // Per-variant adjustment
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

  const openView = async (product: Product) => {
    try {
      setViewLoading(true);
      setViewing(product); // Show modal immediately with basic data
      const res = await getProduct(product.id);
      setViewing(res.product); // Replace with full data (images, variants)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} products</p>
        </div>
        <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>
          Add Product
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
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
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
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
          onClick={() => { setLowStockOnly(!lowStockOnly); setOffset(0); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            lowStockOnly
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
              : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <AlertIcon className="w-4 h-4" />
          Low Stock
        </button>
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
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Product</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">SKU</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Category</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Cost</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Price</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Qty</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Unit</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const imgUrl = getPrimaryImageUrl(product);
                  return (
                    <tr key={product.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-zinc-600" />
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
                      <td className="px-4 py-3 text-sm text-right text-zinc-400">
                        {Number(product.costPrice).toLocaleString()} DA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-400">
                        {Number(product.sellingPrice).toLocaleString()} DA
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
                        <div className="flex items-center justify-center gap-1">
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
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => openView(product)}
                            className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(product)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Edit product"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(product)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete product"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
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
          <p className="text-sm text-zinc-500 mb-4">Add your first product to get started</p>
          <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>Add Product</Button>
        </div>
      )}

      <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required placeholder="e.g., PRD-001" />
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Product name" />
          </div>
          <Input label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="Describe the product — the AI agent uses this to sell it" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cost Price (DA)" type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0" />
            <Input label="Selling Price (DA)" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} placeholder="0" />
          </div>

          {/* Quantity / Min — hide product-level qty when variants are on */}
          <div className="grid grid-cols-2 gap-4">
            {!editing && !hasVariants && (
              <Input label="Initial Quantity" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
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
              // Per-variant adjustments
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
              // Product-level adjustment
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
                  {/* Main image */}
                  <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={allImages[0]}
                      alt={viewing.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  {/* Thumbnails */}
                  {allImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {allImages.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover border-2 border-white/10 flex-shrink-0 cursor-pointer hover:border-white/30 transition-colors"
                          onClick={() => {
                            // Move clicked image to front for preview
                            const reordered = [url, ...allImages.filter((_, i) => i !== idx)];
                            // Quick trick: we can't reorder viewing.images directly,
                            // but we show a simple gallery above
                          }}
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
