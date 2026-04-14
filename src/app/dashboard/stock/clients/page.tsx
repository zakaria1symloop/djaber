'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, StatsCard, RangeSlider, DatePicker } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import {
  UsersIcon, SearchIcon, EyeIcon, EditIcon, TrashIcon, PlusIcon,
  CheckCircleIcon, ClipboardIcon, DollarIcon, PhoneIcon, MailIcon,
  MapPinIcon, UserIcon, ChatIcon, FacebookIcon, BotIcon,
  ClockIcon, MessageIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import {
  getClients,
  createClient,
  updateClient,
  deleteClientApi,
  getClientMetrics,
  type Client,
  type ClientMetrics,
  type ClientConversation,
} from '@/lib/user-stock-api';
import { useFilterPanel } from '@/contexts/FilterPanelContext';

const DEFAULT_ORDERS_MAX = 1000;
const DEFAULT_SPENT_MAX = 1000000;

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [phoneSearchDebounced, setPhoneSearchDebounced] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter panel state — shared with layout via context
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftActiveFilter, setDraftActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [draftSource, setDraftSource] = useState<'' | 'ai' | 'manual'>('');
  const [draftOrdersRange, setDraftOrdersRange] = useState<[number, number]>([0, DEFAULT_ORDERS_MAX]);
  const [draftSpentRange, setDraftSpentRange] = useState<[number, number]>([0, DEFAULT_SPENT_MAX]);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  // Applied filters ref + trigger
  const appliedFiltersRef = useRef({
    activeFilter: '' as '' | 'true' | 'false',
    source: '' as '' | 'ai' | 'manual',
    ordersRange: [0, DEFAULT_ORDERS_MAX] as [number, number],
    spentRange: [0, DEFAULT_SPENT_MAX] as [number, number],
    startDate: '',
    endDate: '',
  });
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [metricsConversations, setMetricsConversations] = useState<ClientConversation[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  // Active filter count
  const activeFilterCount = useMemo(() => {
    const f = appliedFiltersRef.current;
    let count = 0;
    if (f.activeFilter !== '') count++;
    if (f.source !== '') count++;
    if (f.ordersRange[0] > 0 || f.ordersRange[1] < DEFAULT_ORDERS_MAX) count++;
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
      draftSource !== f.source ||
      draftOrdersRange[0] !== f.ordersRange[0] || draftOrdersRange[1] !== f.ordersRange[1] ||
      draftSpentRange[0] !== f.spentRange[0] || draftSpentRange[1] !== f.spentRange[1] ||
      draftStartDate !== f.startDate || draftEndDate !== f.endDate
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftActiveFilter, draftSource, draftOrdersRange, draftSpentRange, draftStartDate, draftEndDate, filterTrigger]);

  // Cleanup on unmount
  useEffect(() => () => setFiltersOpen(false), [setFiltersOpen]);

  // 300ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setPhoneSearchDebounced(phoneSearch), 300);
    return () => clearTimeout(timer);
  }, [phoneSearch]);

  // Load metrics when viewing a client
  useEffect(() => {
    if (!viewing) {
      setMetrics(null);
      setMetricsConversations([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setMetricsLoading(true);
      try {
        const res = await getClientMetrics(viewing.id);
        if (!cancelled) {
          setMetrics(res.metrics);
          setMetricsConversations(res.conversations);
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [viewing]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const f = appliedFiltersRef.current;
      const params: Record<string, any> = {
        search: searchDebounced || undefined,
        phone: phoneSearchDebounced || undefined,
      };
      if (f.activeFilter === 'true') params.isActive = true;
      else if (f.activeFilter === 'false') params.isActive = false;
      if (f.source) params.source = f.source;
      if (f.ordersRange[0] > 0) params.minOrders = f.ordersRange[0];
      if (f.ordersRange[1] < DEFAULT_ORDERS_MAX) params.maxOrders = f.ordersRange[1];
      if (f.spentRange[0] > 0) params.minSpent = f.spentRange[0];
      if (f.spentRange[1] < DEFAULT_SPENT_MAX) params.maxSpent = f.spentRange[1];
      if (f.startDate) params.startDate = f.startDate;
      if (f.endDate) params.endDate = f.endDate;

      const res = await getClients(params);
      setClients(res.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, phoneSearchDebounced, filterTrigger]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Computed stats
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter(c => c.isActive !== false).length;
    const withOrders = clients.filter(c => c.totalOrders > 0).length;
    const totalSpent = clients.reduce((sum, c) => sum + Number(c.totalSpent), 0);
    return { total, active, withOrders, totalSpent };
  }, [clients]);

  const applyFilters = () => {
    appliedFiltersRef.current = {
      activeFilter: draftActiveFilter,
      source: draftSource,
      ordersRange: [...draftOrdersRange],
      spentRange: [...draftSpentRange],
      startDate: draftStartDate,
      endDate: draftEndDate,
    };
    setFilterTrigger((t) => t + 1);
  };

  const clearAllFilters = () => {
    setDraftActiveFilter('');
    setDraftSource('');
    setDraftOrdersRange([0, DEFAULT_ORDERS_MAX]);
    setDraftSpentRange([0, DEFAULT_SPENT_MAX]);
    setDraftStartDate('');
    setDraftEndDate('');
    appliedFiltersRef.current = {
      activeFilter: '',
      source: '',
      ordersRange: [0, DEFAULT_ORDERS_MAX],
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
    setForm({ name: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setFiltersOpen(false);
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
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Clients</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Customers saved from AI conversations and confirmed orders
          </p>
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
            Add Client
          </Button>
        </div>
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

      {/* Search + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <div className="relative flex-1 max-w-[200px]">
          <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by phone..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftStartDate} onChange={(v) => { setDraftStartDate(v); appliedFiltersRef.current.startDate = v; setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftEndDate} onChange={(v) => { setDraftEndDate(v); appliedFiltersRef.current.endDate = v; setFilterTrigger(t => t + 1); }} placeholder="To date" />
      </div>

      {/* Table / Empty State */}
      {clients.length > 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Address</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Conversations</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Orders</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total Spent</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Source</th>
                  <th className="text-center text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {getInitials(client.name)}
                        </div>
                        <span className="text-sm text-white font-medium">{client.name}</span>
                      </div>
                    </td>
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
                    <td className="px-4 py-3 text-center">
                      {(client._count?.conversations || 0) > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <ChatIcon className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-sm text-blue-400 font-medium">{client._count?.conversations}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="default">{client.totalOrders}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-400 font-medium">
                      {Number(client.totalSpent).toLocaleString()} DA
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={client.source === 'ai' ? 'info' : 'default'}>
                        {client.source === 'ai' ? 'AI Chat' : 'Manual'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setFiltersOpen(false); setViewing(client); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/stock/orders?clientId=${client.id}`)}
                          className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="View Orders"
                        >
                          <ClipboardIcon className="w-4 h-4" />
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
            {searchDebounced || activeFilterCount > 0
              ? 'No clients match your filters'
              : 'Clients will appear here automatically when the AI chatbot confirms orders, or add them manually.'}
          </p>
          {!searchDebounced && activeFilterCount === 0 && (
            <Button onClick={openAdd} icon={<PlusIcon className="w-4 h-4" />}>Add Client</Button>
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

          {/* Source Toggle */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">Source</label>
            <div className="flex gap-1.5">
              {[
                { value: '' as const, label: 'All' },
                { value: 'ai' as const, label: 'AI Chat' },
                { value: 'manual' as const, label: 'Manual' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraftSource(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    draftSource === opt.value
                      ? opt.value === 'ai'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : opt.value === 'manual'
                          ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Total Orders Range */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2.5 block">
              Total Orders
              {(draftOrdersRange[0] > 0 || draftOrdersRange[1] < DEFAULT_ORDERS_MAX) && (
                <span className="ml-1.5 text-blue-400 font-normal normal-case">
                  {draftOrdersRange[0].toLocaleString()} - {draftOrdersRange[1].toLocaleString()}
                </span>
              )}
            </label>
            <RangeSlider
              min={0}
              max={DEFAULT_ORDERS_MAX}
              value={draftOrdersRange}
              onChange={setDraftOrdersRange}
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
              step={100}
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
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Client Details" size="lg">
        {viewing && (
          <div className="space-y-5">
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

            {/* AI Metrics */}
            {metricsLoading ? (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-zinc-700 rounded w-32" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-12 bg-zinc-700 rounded" />
                    <div className="h-12 bg-zinc-700 rounded" />
                    <div className="h-12 bg-zinc-700 rounded" />
                  </div>
                </div>
              </div>
            ) : metrics && (metrics.conversationCount > 0 || metricsConversations.length > 0) ? (
              <>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BotIcon className="w-4 h-4 text-blue-400" />
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">AI Conversation Metrics</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center bg-zinc-900/50 rounded-lg p-2.5">
                      <p className="text-lg font-bold text-blue-400">{metrics.conversationCount}</p>
                      <p className="text-[10px] text-zinc-500">Conversations</p>
                    </div>
                    <div className="text-center bg-zinc-900/50 rounded-lg p-2.5">
                      <p className="text-lg font-bold text-white">{metrics.totalMessages}</p>
                      <p className="text-[10px] text-zinc-500">Total Messages</p>
                    </div>
                    <div className="text-center bg-zinc-900/50 rounded-lg p-2.5">
                      <p className="text-lg font-bold text-emerald-400">{metrics.aiResponseCount}</p>
                      <p className="text-[10px] text-zinc-500">AI Responses</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs text-zinc-500">
                    <span>Client messages: {metrics.messagesReceived}</span>
                    {metrics.lastMessageDate && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        Last: {new Date(metrics.lastMessageDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {metricsConversations.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageIcon className="w-4 h-4 text-zinc-400" />
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Conversation History</p>
                    </div>
                    <div className="space-y-2">
                      {metricsConversations.map((conv) => (
                        <div key={conv.id} className="flex items-start gap-3 p-2.5 bg-zinc-900/50 rounded-lg">
                          <div className="flex-shrink-0 mt-0.5">
                            <FacebookIcon className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-white">{conv.pageName || conv.platform}</span>
                              <Badge variant={conv.status === 'active' ? 'success' : 'default'}>
                                {conv.status}
                              </Badge>
                              <span className="text-[10px] text-zinc-500 ml-auto">{conv.messageCount} msgs</span>
                            </div>
                            {conv.lastMessage && (
                              <p className="text-xs text-zinc-500 truncate">
                                {conv.lastMessageIsFromPage ? 'AI: ' : 'Client: '}{conv.lastMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {viewing.notes && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-400">{viewing.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push(`/dashboard/stock/orders?clientId=${viewing.id}`)}
                icon={<ClipboardIcon className="w-4 h-4" />}
              >
                View Orders
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setViewing(null); openEdit(viewing); }}>
                Edit Client
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Client' : 'Add Client'} size="md">
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
                placeholder="Client name"
                className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

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
