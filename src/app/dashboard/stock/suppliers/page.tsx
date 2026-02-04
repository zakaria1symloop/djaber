'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Modal, StatsCard } from '@/components/stock';
import { Button, Input, Badge } from '@/components/ui';
import {
  PlusIcon, UsersIcon, EditIcon, TrashIcon, SearchIcon, EyeIcon,
  CheckCircleIcon, TruckIcon, DollarIcon, PhoneIcon, MailIcon,
  MapPinIcon, UserIcon,
} from '@/components/ui/icons';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type Supplier,
} from '@/lib/user-stock-api';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '', isActive: true });

  // 300ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSuppliers(searchDebounced || undefined);
      setSuppliers(res.suppliers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  // Computed stats
  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s.isActive !== false).length;
    const withPurchases = suppliers.filter(s => (s._count?.purchases || 0) > 0).length;
    // We don't have purchase totals on supplier objects, so show count-based stat
    return { total, active, withPurchases };
  }, [suppliers]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      if (statusFilter === 'active' && s.isActive === false) return false;
      if (statusFilter === 'inactive' && s.isActive !== false) return false;
      return true;
    });
  }, [suppliers, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', address: '', notes: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (supplier: Supplier) => {
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
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-zinc-800 rounded-xl" />)}
          </div>
          <div className="h-64 bg-zinc-800 rounded-xl" />
        </div>
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
        <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>
          Add Supplier
        </Button>
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

      {/* Filters */}
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {filteredSuppliers.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Supplier</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Address</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Purchases</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {/* Supplier: Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {getInitials(supplier.name)}
                        </div>
                        <span className="text-sm text-white font-medium">{supplier.name}</span>
                      </div>
                    </td>
                    {/* Contact: Phone + Email stacked */}
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
                    {/* Address */}
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
                    {/* Purchases count */}
                    <td className="px-4 py-3 text-center">
                      <Badge variant="default">{supplier._count?.purchases || 0}</Badge>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <Badge variant={supplier.isActive !== false ? 'success' : 'error'}>
                        {supplier.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewing(supplier)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View">
                          <EyeIcon className="w-4 h-4" />
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
            {searchDebounced || statusFilter !== 'all' ? 'No suppliers match your filters' : 'Add suppliers to manage your purchases'}
          </p>
          {!searchDebounced && statusFilter === 'all' && (
            <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>Add Supplier</Button>
          )}
        </div>
      )}

      {/* Details Modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Supplier Details" size="lg">
        {viewing && (
          <div className="space-y-5">
            {/* Header */}
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

            {/* Info Grid */}
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

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Total Purchases</p>
                <p className="text-2xl font-bold text-white">{viewing._count?.purchases || 0}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Member Since</p>
                <p className="text-sm font-medium text-white">{new Date(viewing.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setViewing(null); openEdit(viewing); }}>
                Edit Supplier
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setViewing(null)}>
                Close
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
          {/* Name with icon */}
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

          {/* Email + Phone 2-col */}
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

          {/* Address with icon */}
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

          {/* Notes */}
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

          {/* Active toggle (only when editing) */}
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
