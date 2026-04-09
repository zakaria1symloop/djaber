'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  type AdminUser,
} from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, Badge, Button } from '@/components/ui';
import {
  SearchIcon,
  RefreshIcon,
  TrashIcon,
  EditIcon,
  EyeIcon,
  CloseIcon,
} from '@/components/ui/icons';
import { FilterPanel, FilterPanelTrigger, FilterSection, FilterChip } from '@/components/admin/FilterPanel';
import { SkeletonTable } from '@/components/ui/Loader';

export default function AdminUsersPage() {
  const router = useRouter();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState<'all' | 'individual' | 'teams'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'with-pages' | 'with-agents' | 'inactive'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minPages, setMinPages] = useState('');
  const [maxPages, setMaxPages] = useState('');
  const [minProducts, setMinProducts] = useState('');
  const [maxProducts, setMaxProducts] = useState('');
  const [minRevenue, setMinRevenue] = useState('');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [minConversations, setMinConversations] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'email' | 'firstName' | 'lastName' | 'plan'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listAdminUsers({
        search: debouncedSearch || undefined,
        plan: planFilter !== 'all' ? planFilter : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        activity: activityFilter !== 'all' ? activityFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minPages: minPages ? Number(minPages) : undefined,
        maxPages: maxPages ? Number(maxPages) : undefined,
        minProducts: minProducts ? Number(minProducts) : undefined,
        maxProducts: maxProducts ? Number(maxProducts) : undefined,
        minRevenue: minRevenue ? Number(minRevenue) : undefined,
        maxRevenue: maxRevenue ? Number(maxRevenue) : undefined,
        minConversations: minConversations ? Number(minConversations) : undefined,
        sortBy,
        sortOrder,
        limit: 200,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch, planFilter, roleFilter, activityFilter, startDate, endDate,
    minPages, maxPages, minProducts, maxProducts, minRevenue, maxRevenue, minConversations,
    sortBy, sortOrder,
  ]);

  // Backend already filtered everything; no client-side re-filter needed
  const filteredUsers = users;

  const activeFilterCount =
    (planFilter !== 'all' ? 1 : 0) +
    (roleFilter !== 'all' ? 1 : 0) +
    (activityFilter !== 'all' ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (minPages ? 1 : 0) +
    (maxPages ? 1 : 0) +
    (minProducts ? 1 : 0) +
    (maxProducts ? 1 : 0) +
    (minRevenue ? 1 : 0) +
    (maxRevenue ? 1 : 0) +
    (minConversations ? 1 : 0) +
    (sortBy !== 'createdAt' || sortOrder !== 'desc' ? 1 : 0);

  const clearFilters = () => {
    setPlanFilter('all');
    setRoleFilter('all');
    setActivityFilter('all');
    setStartDate('');
    setEndDate('');
    setMinPages('');
    setMaxPages('');
    setMinProducts('');
    setMaxProducts('');
    setMinRevenue('');
    setMaxRevenue('');
    setMinConversations('');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const stats = useMemo(() => {
    const totalRevenue = users.reduce((s, u) => s + u._revenue, 0);
    const totalPages = users.reduce((s, u) => s + u._counts.pages, 0);
    const totalConversations = users.reduce((s, u) => s + u._counts.conversations, 0);
    return { total, totalRevenue, totalPages, totalConversations };
  }, [users, total]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteAdminUser(deleteConfirm.id);
      toast.success(`${deleteConfirm.email} deleted`);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            Users
          </h1>
          <p className="text-sm text-zinc-400">Manage all registered users on the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterPanelTrigger open={filterOpen} setOpen={setFilterOpen} activeCount={activeFilterCount} />
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Users" value={stats.total.toString()} />
        <StatCard label="Total Pages" value={stats.totalPages.toString()} />
        <StatCard label="Conversations" value={stats.totalConversations.toString()} />
        <StatCard label="Revenue" value={`${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, first or last name…"
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-zinc-500 text-sm">
          {debouncedSearch ? 'No users match your search' : 'No users yet'}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">Pages</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">Agents</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center hidden md:table-cell">Convs</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center hidden md:table-cell">Products</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-right hidden lg:table-cell">Revenue</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/users/${u.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            initials={`${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white truncate">{u.firstName} {u.lastName}</p>
                              {u.isAdmin && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white uppercase tracking-wider">
                                  Admin
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.plan === 'teams' ? 'info' : 'default'} size="sm">
                          {u.plan}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CountCell count={u._counts.pages} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CountCell count={u._counts.agents} />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <CountCell count={u._counts.conversations} />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <CountCell count={u._counts.products} />
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-xs text-zinc-300">
                          {u._revenue > 0 ? `${u._revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA` : <span className="text-zinc-700">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-zinc-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/admin/users/${u.id}`)}
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="View details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditing(u)}
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(u)}
                            disabled={isCurrent}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete"
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
      )}

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={clearFilters}
      >
        <FilterSection label="Sort by">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="createdAt">Joined</option>
              <option value="email">Email</option>
              <option value="firstName">First name</option>
              <option value="lastName">Last name</option>
              <option value="plan">Plan</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </FilterSection>

        <FilterSection label="Plan">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={planFilter === 'all'} onClick={() => setPlanFilter('all')} />
            <FilterChip label="Individual" active={planFilter === 'individual'} onClick={() => setPlanFilter('individual')} />
            <FilterChip label="Teams" active={planFilter === 'teams'} onClick={() => setPlanFilter('teams')} />
          </div>
        </FilterSection>

        <FilterSection label="Role">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
            <FilterChip label="Admins" active={roleFilter === 'admin'} onClick={() => setRoleFilter('admin')} />
            <FilterChip label="Regular" active={roleFilter === 'user'} onClick={() => setRoleFilter('user')} />
          </div>
        </FilterSection>

        <FilterSection label="Activity">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={activityFilter === 'all'} onClick={() => setActivityFilter('all')} />
            <FilterChip label="With pages" active={activityFilter === 'with-pages'} onClick={() => setActivityFilter('with-pages')} />
            <FilterChip label="With agents" active={activityFilter === 'with-agents'} onClick={() => setActivityFilter('with-agents')} />
            <FilterChip label="Inactive" active={activityFilter === 'inactive'} onClick={() => setActivityFilter('inactive')} />
          </div>
        </FilterSection>

        <FilterSection label="Joined date">
          <div className="space-y-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            />
          </div>
        </FilterSection>

        <FilterSection label="Pages count">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minPages} onChange={(e) => setMinPages(e.target.value)} placeholder="Min" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} placeholder="Max" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label="Products count">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minProducts} onChange={(e) => setMinProducts(e.target.value)} placeholder="Min" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxProducts} onChange={(e) => setMaxProducts(e.target.value)} placeholder="Max" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label="Revenue (DA)">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} placeholder="Min" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxRevenue} onChange={(e) => setMaxRevenue(e.target.value)} placeholder="Max" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label="Min conversations">
          <input type="number" value={minConversations} onChange={(e) => setMinConversations(e.target.value)} placeholder="e.g. 5" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
        </FilterSection>
      </FilterPanel>

      {/* Edit modal */}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Delete user?</h3>
            <p className="text-sm text-zinc-400 mb-6">
              This will permanently delete <span className="text-white font-medium">{deleteConfirm.email}</span> and all their data (pages, products, agents, conversations). This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider mb-1 text-zinc-500">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function CountCell({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-zinc-700">—</span>;
  return <span className="text-xs text-zinc-300 font-medium">{count}</span>;
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [plan, setPlan] = useState(user.plan);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const data: Record<string, string | undefined> = { firstName, lastName, plan };
      if (password.trim()) {
        if (password.length < 8) {
          toast.error('Password must be at least 8 characters');
          setSaving(false);
          return;
        }
        data.password = password;
      }
      await updateAdminUser(user.id, data);
      toast.success('User updated');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Edit user</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2.5 bg-black/40 border border-white/5 rounded-lg text-zinc-500 text-sm cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="individual">Individual</option>
              <option value="teams">Teams</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Reset password <span className="text-zinc-700 normal-case lowercase">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
