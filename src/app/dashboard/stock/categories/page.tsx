'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Modal, RangeSlider } from '@/components/stock';
import { Button, Input, Badge } from '@/components/ui';
import { PlusIcon, TagIcon, EditIcon, TrashIcon, SearchIcon, FilterIcon, CloseIcon } from '@/components/ui/icons';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from '@/lib/user-stock-api';
import { useFilterPanel } from '@/contexts/FilterPanelContext';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#6B7280',
];

const DEFAULT_PRODUCTS_MAX = 1000;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Filter panel state — shared with layout via context
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftProductsRange, setDraftProductsRange] = useState<[number, number]>([0, DEFAULT_PRODUCTS_MAX]);
  const [draftHasDescription, setDraftHasDescription] = useState<'' | 'true' | 'false'>('');
  const [draftColors, setDraftColors] = useState<string[]>([]);

  // Applied filters ref + trigger
  const appliedFiltersRef = useRef({
    productsRange: [0, DEFAULT_PRODUCTS_MAX] as [number, number],
    hasDescription: '' as '' | 'true' | 'false',
    colors: [] as string[],
  });
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', description: '', color: '#6B7280' });

  // Active filter count
  const activeFilterCount = useMemo(() => {
    const f = appliedFiltersRef.current;
    let count = 0;
    if (f.productsRange[0] > 0 || f.productsRange[1] < DEFAULT_PRODUCTS_MAX) count++;
    if (f.hasDescription !== '') count++;
    if (f.colors.length > 0) count++;
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTrigger]);

  // Draft dirty check
  const draftDirty = useMemo(() => {
    const f = appliedFiltersRef.current;
    return (
      draftProductsRange[0] !== f.productsRange[0] || draftProductsRange[1] !== f.productsRange[1] ||
      draftHasDescription !== f.hasDescription ||
      JSON.stringify(draftColors) !== JSON.stringify(f.colors)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftProductsRange, draftHasDescription, draftColors, filterTrigger]);

  // Cleanup on unmount
  useEffect(() => () => setFiltersOpen(false), [setFiltersOpen]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const f = appliedFiltersRef.current;
      const params: Record<string, any> = {
        search: searchDebounced || undefined,
      };
      if (f.productsRange[0] > 0) params.minProducts = f.productsRange[0];
      if (f.productsRange[1] < DEFAULT_PRODUCTS_MAX) params.maxProducts = f.productsRange[1];
      if (f.hasDescription === 'true') params.hasDescription = true;
      else if (f.hasDescription === 'false') params.hasDescription = false;
      if (f.colors.length > 0) params.color = f.colors;

      const res = await getCategories(params);
      setCategories(res.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, filterTrigger]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const applyFilters = () => {
    appliedFiltersRef.current = {
      productsRange: [...draftProductsRange],
      hasDescription: draftHasDescription,
      colors: [...draftColors],
    };
    setFilterTrigger((t) => t + 1);
  };

  const clearAllFilters = () => {
    setDraftProductsRange([0, DEFAULT_PRODUCTS_MAX]);
    setDraftHasDescription('');
    setDraftColors([]);
    appliedFiltersRef.current = {
      productsRange: [0, DEFAULT_PRODUCTS_MAX],
      hasDescription: '',
      colors: [],
    };
    setFilterTrigger((t) => t + 1);
  };

  const toggleFilters = () => {
    if (!filtersOpen) {
      setShowModal(false);
      setDeleteConfirm(null);
    }
    setFiltersOpen(!filtersOpen);
  };

  const toggleColorChip = (color: string) => {
    setDraftColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const openAdd = () => {
    setFiltersOpen(false);
    setEditing(null);
    setForm({ name: '', description: '', color: '#6B7280' });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setFiltersOpen(false);
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', color: cat.color || '#6B7280' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSaving(true);
      if (editing) {
        await updateCategory(editing.id, form);
      } else {
        await createCategory(form);
      }
      setShowModal(false);
      loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteCategory(deleteConfirm.id);
      setDeleteConfirm(null);
      loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-zinc-800 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-zinc-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Categories</h1>
          <p className="text-sm text-zinc-400 mt-1">{categories.length} categories</p>
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
            Add Category
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      </div>

      {/* Category Cards */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || '#6B7280' }}
                  />
                  <h3 className="text-white font-semibold">{cat.name}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(cat)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {cat.description && (
                <p className="text-sm text-zinc-400 mb-3">{cat.description}</p>
              )}
              <p className="text-xs text-zinc-500">{cat._count?.products || 0} products</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center">
            <TagIcon className="w-16 h-16" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Categories</h3>
          <p className="text-sm text-zinc-500 mb-4">
            {searchDebounced || activeFilterCount > 0 ? 'No categories match your filters' : 'Create categories to organize your products'}
          </p>
          {!searchDebounced && activeFilterCount === 0 && (
            <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>
              Add Category
            </Button>
          )}
        </div>
      )}

      {/* Filter Panel — Right Side */}
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
          {/* Product Count Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Product Count
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_PRODUCTS_MAX}
              value={draftProductsRange}
              onChange={setDraftProductsRange}
              step={1}
              formatLabel={(v) => v.toLocaleString()}
            />
          </div>

          {/* Has Description Toggle */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">Has Description</label>
            <div className="flex gap-1.5">
              {[
                { value: '' as const, label: 'All' },
                { value: 'true' as const, label: 'Yes' },
                { value: 'false' as const, label: 'No' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraftHasDescription(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    draftHasDescription === opt.value
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

          {/* Color Filter */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => {
                const isSelected = draftColors.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleColorChip(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-150 ${
                      isSelected ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-zinc-500'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
            {draftColors.length > 0 && (
              <p className="text-[10px] text-zinc-500 mt-2">{draftColors.length} selected</p>
            )}
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g., Electronics"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
          />
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : (editing ? 'Update' : 'Add')} {!saving && 'Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Category"
        size="sm"
      >
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm?.name}</span>?
        </p>
        {(deleteConfirm?._count?.products || 0) > 0 && (
          <p className="text-amber-400 text-sm mb-4">
            This category has {deleteConfirm?._count?.products} products. They will become uncategorized.
          </p>
        )}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
