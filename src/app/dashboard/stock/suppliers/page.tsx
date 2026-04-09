'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, StatsCard, RangeSlider, DatePicker } from '@/components/stock';
import { Button, Input, Badge } from '@/components/ui';
import {
  PlusIcon, UsersIcon, EditIcon, TrashIcon, SearchIcon, EyeIcon,
  CheckCircleIcon, TruckIcon, DollarIcon, PhoneIcon, MailIcon,
  MapPinIcon, UserIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type Supplier,
} from '@/lib/user-stock-api';
import { useFilterPanel } from '@/contexts/FilterPanelContext';

const DEFAULT_PURCHASES_MAX = 1000;
const DEFAULT_SPENT_MAX = 10000000;

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Filter panel state — shared with layout via context
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftActiveFilter, setDraftActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [draftPurchasesRange, setDraftPurchasesRange] = useState<[number, number]>([0, DEFAULT_PURCHASES_MAX]);
  const [draftSpentRange, setDraftSpentRange] = useState<[number, number]>([0, DEFAULT_SPENT_MAX]);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  // Applied filters ref + trigger
  const appliedFiltersRef = useRef({
    activeFilter: '' as '' | 'true' | 'false',
    purchasesRange: [0, DEFAULT_PURCHASES_MAX] as [number, number],
    spentRange: [0, DEFAULT_SPENT_MAX] as [number, number],
    startDate: '',
    endDate: '',
  });
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '', isActive: true });

  // Active filter count
  const activeFilterCount = useMemo(() => {
    const f = appliedFiltersRef.current;
    let count = 0;
    if (f.activeFilter !== '') count++;
    if (f.purchasesRange[0] > 0 || f.purchasesRange[1] < DEFAULT_PURCHASES_MAX) count++;
    if (f.spentRange[0] > 0 || f.spentRange[1] < DEFAULT_SPENT_MAX) count++;
    if (f.startDate || f.endDate) count++;
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTrigger]);

  // Draft dirty check
  const draftDirty = useMemo(() => {
    const f = appliedFiltersRef.current;
    return (
      draftActiveFilter !== f.activeFilter ||
      draftPurchasesRange[0] !== f.purchasesRange[0] || draftPurchasesRange[1] !== f.purchasesRange[1] ||
      draftSpentRange[0] !== f.spentRange[0] || draftSpentRange[1] !== f.spentRange[1] ||
      draftStartDate !== f.startDate || draftEndDate !== f.endDate
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftActiveFilter, draftPurchasesRange, draftSpentRange, draftStartDate, draftEndDate, filterTrigger]);

  // Cleanup on unmount
  useEffect(() => () => setFiltersOpen(false), [setFiltersOpen]);

  // 300ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const f = appliedFiltersRef.current;
      const params: Record<string, any> = {
        search: searchDebounced || undefined,
      };
      if (f.activeFilter === 'true') params.isActive = true;
      else if (f.activeFilter === 'false') params.isActive = false;
      if (f.purchasesRange[0] > 0) params.minPurchases = f.purchasesRange[0];
      if (f.purchasesRange[1] < DEFAULT_PURCHASES_MAX) params.maxPurchases = f.purchasesRange[1];
      if (f.spentRange[0] > 0) params.minTotalSpent = f.spentRange[0];
      if (f.spentRange[1] < DEFAULT_SPENT_MAX) params.maxTotalSpent = f.spentRange[1];
      if (f.startDate) params.startDate = f.startDate;
      if (f.endDate) params.endDate = f.endDate;

      const res = await getSuppliers(params);
      setSuppliers(res.suppliers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, filterTrigger]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  // Computed stats
  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s.isActive !== false).length;
    const withPurchases = suppliers.filter(s => (s._count?.purchases || 0) > 0).length;
    return { total, active, withPurchases };
  }, [suppliers]);

  const applyFilters = () => {
    appliedFiltersRef.current = {
      activeFilter: draftActiveFilter,
      purchasesRange: [...draftPurchasesRange],
      spentRange: [...draftSpentRange],
      startDate: draftStartDate,
      endDate: draftEndDate,
    };
    setFilterTrigger((t) => t + 1);
  };

  const clearAllFilters = () => {
    setDraftActiveFilter('');
    setDraftPurchasesRange([0, DEFAULT_PURCHASES_MAX]);
    setDraftSpentRange([0, DEFAULT_SPENT_MAX]);
    setDraftStartDate('');
    setDraftEndDate('');
    appliedFiltersRef.current = {
      activeFilter: '',
      purchasesRange: [0, DEFAULT_PURCHASES_MAX],
      spentRange: [0, DEFAULT_SPENT_MAX],
      startDate: '',
      endDate: '',
    };
    setFilterTrigger((t) => t + 1);
  };

  const toggleFilters = () => {
    if (!filtersOpen) {
      setShowModal(false);
      setViewing(null);
      setDeleteConfirm(null);
    }
    setFiltersOpen(!filtersOpen);
  };

  const openAdd = () => {
    setFiltersOpen(false);
    setEditing(null);
    setForm({ name: '', email: '', phone: '', address: '', notes: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (supplier: Supplier) => {
    setFiltersOpen(false);
    setEditing(supplier);
    setForm({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSaving(true);
      if (editing) {
        await updateSupplier(editing.id, {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
          isActive: form.isActive,
        });
      } else {
        await createSupplier({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      }
      setShowModal(false);
      loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteSupplier(deleteConfirm.id);
      setDeleteConfirm(null);
      setViewing(null);
      loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplier');
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (loading && suppliers.length === 0) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-zinc-800 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-zinc-800 rounded-xl" />)}
        </div>
        <div className="h-64 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-sm text-zinc-400 mt-1">{suppliers.length} suppliers</p>
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
            Add Supplier
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total Suppliers" value={stats.total} icon={<UsersIcon className="w-5 h-5" />} iconColor="text-blue-400" />
        <StatsCard title="Active" value={stats.active} icon={<CheckCircleIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
        <StatsCard title="With Purchases" value={stats.withPurchases} icon={<TruckIcon className="w-5 h-5" />} iconColor="text-amber-400" />
      </div>

      {/* Search + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); appliedFiltersRef.current.startDate = v; setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); appliedFiltersRef.current.endDate = v; setFilterTrigger(t => t + 1); }} placeholder="To date" />
      </div>

      {/* Table */}
      {suppliers.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Supplier</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Address</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Purchases</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total Spent</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {getInitials(supplier.name)}
                        </div>
                        <span className="text-sm text-white font-medium">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {supplier.phone ? (
                          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                            <PhoneIcon className="w-3.5 h-3.5 text-zinc-500" />
                            {supplier.phone}
                          </div>
                        ) : null}
                        {supplier.email ? (
                          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                            <MailIcon className="w-3.5 h-3.5 text-zinc-500" />
                            {supplier.email}
                          </div>
                        ) : null}
                        {!supplier.phone && !supplier.email && (
                          <span className="text-sm text-zinc-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {supplier.address ? (
                        <div className="flex items-center gap-1.5 text-sm text-zinc-400 max-w-[200px]">
                          <MapPinIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                          <span className="truncate">{supplier.address}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="default">{supplier._count?.purchases || 0}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-white font-medium">
                        {(supplier.totalSpent || 0).toLocaleString()} DA
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={supplier.isActive !== false ? 'success' : 'error'}>
                        {supplier.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setFiltersOpen(false); setViewing(supplier); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/stock/purchases?supplierId=${supplier.id}`)}
                          className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="View Purchases"
                        >
                          <TruckIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(supplier)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Edit">
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(supplier)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-zinc-600 mb-4 flex justify-center">
            <UsersIcon className="w-16 h-16" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Suppliers</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
            {searchDebounced || activeFilterCount > 0 ? 'No suppliers match your filters' : 'Add suppliers to manage your purchases'}
          </p>
          {!searchDebounced && activeFilterCount === 0 && (
            <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>Add Supplier</Button>
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
          {/* Status Toggle */}
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

          {/* Purchase Count Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Purchase Count
              {(draftPurchasesRange[0] > 0 || draftPurchasesRange[1] < DEFAULT_PURCHASES_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftPurchasesRange[0].toLocaleString()} - {draftPurchasesRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_PURCHASES_MAX}
              value={draftPurchasesRange}
              onChange={setDraftPurchasesRange}
              step={1}
              formatLabel={(v) => v.toLocaleString()}
            />
          </div>

          {/* Total Spent Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Total Spent (DA)
              {(draftSpentRange[0] > 0 || draftSpentRange[1] < DEFAULT_SPENT_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftSpentRange[0].toLocaleString()} - {draftSpentRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_SPENT_MAX}
              value={draftSpentRange}
              onChange={setDraftSpentRange}
              step={10000}
              formatLabel={(v) => `${v.toLocaleString()} DA`}
            />
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

      {/* Details Modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Supplier Details" size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xl font-bold">
                {getInitials(viewing.name)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{viewing.name}</h3>
                <Badge variant={viewing.isActive !== false ? 'success' : 'error'}>
                  {viewing.isActive !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-zinc-800/50 rounded-lg p-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <PhoneIcon className="w-3.5 h-3.5" /> Phone
                </div>
                <p className="text-sm text-white">{viewing.phone || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <MailIcon className="w-3.5 h-3.5" /> Email
                </div>
                <p className="text-sm text-white">{viewing.email || '-'}</p>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <MapPinIcon className="w-3.5 h-3.5" /> Address
                </div>
                <p className="text-sm text-white">{viewing.address || '-'}</p>
              </div>
              {viewing.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-500 mb-1">Notes</p>
                  <p className="text-sm text-zinc-400">{viewing.notes}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Purchases</p>
                <p className="text-2xl font-bold text-white">{viewing._count?.purchases || 0}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-emerald-400">{(viewing.totalSpent || 0).toLocaleString()} <span className="text-sm text-zinc-400">DA</span></p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Member Since</p>
                <p className="text-sm font-medium text-white">{new Date(viewing.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push(`/dashboard/stock/purchases?supplierId=${viewing.id}`)}
                icon={<TruckIcon className="w-4 h-4" />}
              >
                View Purchases
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setViewing(null); openEdit(viewing); }}>
                Edit Supplier
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name *</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Supplier name"
                className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone</label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Address</label>
            <div className="relative">
              <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Supplier address"
                className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
              rows={2}
              className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
            />
          </div>

          {editing && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mt-1 ${form.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
              <span className="text-sm text-zinc-300">{form.isActive ? 'Active' : 'Inactive'}</span>
            </label>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : (editing ? 'Update Supplier' : 'Add Supplier')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Supplier"
        size="sm"
      >
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm?.name}</span>?
        </p>
        {(deleteConfirm?._count?.purchases || 0) > 0 && (
          <p className="text-amber-400 text-sm mb-4">
            This supplier has {deleteConfirm?._count?.purchases} purchases linked.
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
