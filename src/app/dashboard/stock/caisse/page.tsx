'use client';

import { useEffect, useState, useCallback } from 'react';
import { Modal, Select, Pagination, StatsCard, DatePicker } from '@/components/stock';
import { Button, Input, Badge } from '@/components/ui';
import {
  PlusIcon, DollarIcon, TrashIcon, EditIcon, SearchIcon, FilterIcon, CloseIcon,
} from '@/components/ui/icons';
import { useFilterPanel } from '@/contexts/FilterPanelContext';
import {
  getCaisseTransactions,
  getCaisseStats,
  createCaisseTransaction,
  updateCaisseTransaction,
  deleteCaisseTransaction,
  type CaisseTransaction,
  type CaisseStats,
} from '@/lib/user-stock-api';

const LIMIT = 20;

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'sale', label: 'Sale' },
  { value: 'order', label: 'Order' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' },
];

const MANUAL_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' },
];

const categoryColor: Record<string, string> = {
  sale: 'bg-emerald-500/20 text-emerald-400',
  order: 'bg-blue-500/20 text-blue-400',
  purchase: 'bg-orange-500/20 text-orange-400',
  rent: 'bg-purple-500/20 text-purple-400',
  salary: 'bg-pink-500/20 text-pink-400',
  utilities: 'bg-yellow-500/20 text-yellow-400',
  marketing: 'bg-cyan-500/20 text-cyan-400',
  shipping: 'bg-indigo-500/20 text-indigo-400',
  other: 'bg-zinc-500/20 text-zinc-400',
};

export default function CaissePage() {
  const [transactions, setTransactions] = useState<CaisseTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<CaisseStats | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Search
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Filter panel
  const { filterPanelOpen: filtersOpen, setFilterPanelOpen: setFiltersOpen } = useFilterPanel();
  const [draftType, setDraftType] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');

  // Applied
  const [appliedType, setAppliedType] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CaisseTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CaisseTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form
  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: 'other',
    reference: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setSearchDebounced(search); setOffset(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeFilterCount = [
    appliedType, appliedCategory, appliedDateFrom, appliedDateTo,
  ].filter(Boolean).length;

  const draftDirty =
    draftType !== appliedType || draftCategory !== appliedCategory ||
    draftDateFrom !== appliedDateFrom || draftDateTo !== appliedDateTo;

  const applyFilters = () => {
    setAppliedType(draftType);
    setAppliedCategory(draftCategory);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const clearAllFilters = () => {
    setDraftType(''); setDraftCategory('');
    setDraftDateFrom(''); setDraftDateTo('');
    setAppliedType(''); setAppliedCategory('');
    setAppliedDateFrom(''); setAppliedDateTo('');
    setOffset(0);
    setFilterTrigger(t => t + 1);
  };

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCaisseTransactions({
        type: appliedType || undefined,
        category: appliedCategory || undefined,
        dateFrom: appliedDateFrom || undefined,
        dateTo: appliedDateTo || undefined,
        search: searchDebounced || undefined,
        limit: LIMIT,
        offset,
      });
      setTransactions(res.transactions);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [appliedType, appliedCategory, appliedDateFrom, appliedDateTo, searchDebounced, offset, filterTrigger]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getCaisseStats(periodFilter);
      setStats(res.stats);
    } catch {}
  }, [periodFilter]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    return () => { setFiltersOpen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      type: 'expense',
      amount: '',
      category: 'other',
      reference: '',
      description: '',
      date: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const openEdit = (t: CaisseTransaction) => {
    setEditing(t);
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category,
      reference: t.reference || '',
      description: t.description || '',
      date: new Date(t.date).toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    try {
      setSaving(true);
      if (editing) {
        await updateCaisseTransaction(editing.id, {
          type: form.type,
          amount: Number(form.amount),
          category: form.category,
          reference: form.reference,
          description: form.description,
          date: form.date,
        });
      } else {
        await createCaisseTransaction({
          type: form.type,
          amount: Number(form.amount),
          category: form.category,
          reference: form.reference || undefined,
          description: form.description || undefined,
          date: form.date,
        });
      }
      setShowModal(false);
      loadTransactions();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await deleteCaisseTransaction(deleteConfirm.id);
      setDeleteConfirm(null);
      loadTransactions();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caisse</h1>
          <p className="text-sm text-zinc-400 mt-1">Cash register &amp; treasury management</p>
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
          <Button onClick={openAdd}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Period selector + Stats */}
      <div className="flex gap-2">
        {(['today', 'week', 'month', 'year'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriodFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              periodFilter === p
                ? 'bg-white text-black'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
          </button>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Balance" value={`${stats.balance.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-blue-400" />
          <StatsCard title="Total Income" value={`${stats.totalIncome.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-emerald-400" />
          <StatsCard title="Total Expenses" value={`${stats.totalExpense.toLocaleString()} DA`} icon={<DollarIcon className="w-5 h-5" />} iconColor="text-red-400" />
          <StatsCard title="Transactions" value={stats.transactionCount.toString()} icon={<DollarIcon className="w-5 h-5" />} />
        </div>
      )}

      {/* Search bar + Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search reference or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <DatePicker value={draftDateFrom} onChange={(v) => { setDraftDateFrom(v); setAppliedDateFrom(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="From date" />
        <DatePicker value={draftDateTo} onChange={(v) => { setDraftDateTo(v); setAppliedDateTo(v); setOffset(0); setFilterTrigger(t => t + 1); }} placeholder="To date" />
      </div>

      {/* Table */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-zinc-400 font-medium">Date</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Type</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Category</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Description</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Reference</th>
                <th className="px-4 py-3 text-zinc-400 font-medium text-right">Amount</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Source</th>
                <th className="px-4 py-3 text-zinc-400 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500">No transactions found</td></tr>
              ) : transactions.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-zinc-300">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.type === 'income'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {t.type === 'income' ? '+' : '-'} {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      categoryColor[t.category] || categoryColor.other
                    }`}>
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 max-w-[200px] truncate">
                    {t.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs font-mono">
                    {t.reference || '-'}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    t.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {t.type === 'income' ? '+' : '-'}{Number(t.amount).toLocaleString()} DA
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      t.isAutomatic
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {t.isAutomatic ? 'Auto' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!t.isAutomatic && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                          title="Edit"
                        >
                          <EditIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(t)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="px-4 py-3 border-t border-white/10">
            <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={setOffset} />
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Transaction' : 'Add Transaction'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Type</label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Amount (DA)</label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Category</label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {MANUAL_CATEGORIES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reference</label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. Invoice #123" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details about this transaction" />
          </div>
          <div>
            <DatePicker label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.amount}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Transaction">
        <p className="text-sm text-zinc-400 mb-4">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>

      {/* Filter Panel */}
      {filtersOpen && (
        <div className="fixed top-0 right-0 h-full w-[336px] bg-zinc-950 border-l border-white/10 z-[45] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            <button onClick={() => setFiltersOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Type</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Category</label>
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
              >
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

          </div>

          <div className="px-5 py-4 border-t border-white/10 space-y-2">
            <button
              onClick={applyFilters}
              disabled={!draftDirty}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Apply Filters
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="w-full px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
