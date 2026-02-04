'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Modal, StatsCard } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  UsersIcon, SearchIcon, EyeIcon, EditIcon, TrashIcon, PlusIcon,
  CheckCircleIcon, ClipboardIcon, DollarIcon, PhoneIcon, MailIcon,
  MapPinIcon, UserIcon,
} from '@/components/ui/icons';
import {
  getClients,
  createClient,
  updateClient,
  deleteClientApi,
  type Client,
} from '@/lib/user-stock-api';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  // 300ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getClients(searchDebounced || undefined);
      setClients(res.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Computed stats
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter(c => c.isActive !== false).length;
    const withOrders = clients.filter(c => c.totalOrders > 0).length;
    const totalSpent = clients.reduce((sum, c) => sum + Number(c.totalSpent), 0);
    return { total, active, withOrders, totalSpent };
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter === 'active' && c.isActive === false) return false;
      if (statusFilter === 'inactive' && c.isActive !== false) return false;
      return true;
    });
  }, [clients, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSaving(true);
      if (editing) {
        await updateClient(editing.id, {
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await createClient({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      }
      setShowModal(false);
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      setDeleting(true);
      await deleteClientApi(deleteConfirm.id);
      setDeleteConfirm(null);
      setViewing(null);
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (loading && clients.length === 0) {
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
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Customers saved from AI conversations and confirmed orders
          </p>
        </div>
        <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>
          Add Client
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Clients" value={stats.total} icon={<UsersIcon className="w-5 h-5" />} iconColor="text-blue-400" />
        <StatsCard title="Active" value={stats.active} icon={<CheckCircleIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
        <StatsCard title="With Orders" value={stats.withOrders} icon={<ClipboardIcon className="w-5 h-5" />} iconColor="text-amber-400" />
        <StatsCard title="Total Spent" value={`${stats.totalSpent.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search clients..."
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

      {/* Table / Empty State */}
      {filteredClients.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Address</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Orders</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total Spent</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Source</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {/* Client: Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {getInitials(client.name)}
                        </div>
                        <span className="text-sm text-white font-medium">{client.name}</span>
                      </div>
                    </td>
                    {/* Contact: Phone + Email stacked */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {client.phone ? (
                          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                            <PhoneIcon className="w-3.5 h-3.5 text-zinc-500" />
                            {client.phone}
                          </div>
                        ) : null}
                        {client.email ? (
                          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                            <MailIcon className="w-3.5 h-3.5 text-zinc-500" />
                            {client.email}
                          </div>
                        ) : null}
                        {!client.phone && !client.email && (
                          <span className="text-sm text-zinc-600">-</span>
                        )}
                      </div>
                    </td>
                    {/* Address */}
                    <td className="px-4 py-3">
                      {client.address ? (
                        <div className="flex items-center gap-1.5 text-sm text-zinc-400 max-w-[200px]">
                          <MapPinIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-600">-</span>
                      )}
                    </td>
                    {/* Orders count */}
                    <td className="px-4 py-3 text-center">
                      <Badge variant="default">{client.totalOrders}</Badge>
                    </td>
                    {/* Total Spent */}
                    <td className="px-4 py-3 text-sm text-right text-emerald-400 font-medium">
                      {Number(client.totalSpent).toLocaleString()} DA
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3 text-center">
                      <Badge variant={client.source === 'ai' ? 'info' : 'default'}>
                        {client.source === 'ai' ? 'AI Chat' : 'Manual'}
                      </Badge>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewing(client)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(client)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Edit">
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(client)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
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
          <h3 className="text-lg font-medium text-zinc-300 mb-1">No Clients Yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
            Clients will appear here automatically when the AI chatbot confirms orders, or add them manually.
          </p>
          <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>Add Client</Button>
        </div>
      )}

      {/* Details Modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Client Details" size="lg">
        {viewing && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl font-bold">
                {getInitials(viewing.name)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{viewing.name}</h3>
                <Badge variant={viewing.source === 'ai' ? 'info' : 'default'}>
                  {viewing.source === 'ai' ? 'AI Chat' : 'Manual'}
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
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 bg-zinc-800/50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Total Orders</p>
                <p className="text-lg font-bold text-white">{viewing.totalOrders}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Total Spent</p>
                <p className="text-lg font-bold text-emerald-400">{Number(viewing.totalSpent).toLocaleString()} DA</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Last Order</p>
                <p className="text-sm font-medium text-white">{viewing.lastOrderDate ? new Date(viewing.lastOrderDate).toLocaleDateString() : '-'}</p>
              </div>
            </div>

            {/* Notes */}
            {viewing.notes && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-400">{viewing.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setViewing(null); openEdit(viewing); }}>
                Edit Client
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Client' : 'Add Client'} size="md">
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
                placeholder="Client name"
                className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          {/* Phone + Email 2-col */}
          <div className="grid grid-cols-2 gap-4">
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
                placeholder="Client address"
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

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : (editing ? 'Update Client' : 'Add Client')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Client" size="sm">
        <p className="text-zinc-400 mb-2">
          Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm?.name}</span>?
        </p>
        {(deleteConfirm?.totalOrders || 0) > 0 && (
          <p className="text-amber-400 text-sm mb-4">
            This client has {deleteConfirm?.totalOrders} orders linked.
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
