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
import { useTranslation } from '@/contexts/LanguageContext';

export default function AdminUsersPage() {
  const router = useRouter();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
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
      toast.error(e instanceof Error ? e.message : t('adm.acc.users.err.load'));
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
      toast.success(`${t('adm.acc.users.toast.deleted')} — ${deleteConfirm.email}`);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.acc.err.delete'));
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t('adm.acc.users.title')}
          </h1>
          <p className="text-sm text-zinc-400">{t('adm.acc.users.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterPanelTrigger open={filterOpen} setOpen={setFilterOpen} activeCount={activeFilterCount} />
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
            title={t('adm.acc.refresh')}
            aria-label={t('adm.acc.refresh')}
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label={t('adm.acc.users.stats.total')} value={stats.total.toString()} />
        <StatCard label={t('adm.acc.users.stats.pages')} value={stats.totalPages.toString()} />
        <StatCard label={t('adm.acc.users.stats.conversations')} value={stats.totalConversations.toString()} />
        <StatCard label={t('adm.acc.users.stats.revenue')} value={`${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('adm.acc.users.searchPlaceholder')}
          className="w-full ps-10 pe-4 py-2.5 bg-zinc-900/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-zinc-500 text-sm">
          {debouncedSearch ? t('adm.acc.users.empty.search') : t('adm.acc.users.empty.none')}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-start">
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{t('adm.acc.users.th.user')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{t('adm.acc.users.th.plan')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">{t('adm.acc.users.th.pages')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">{t('adm.acc.users.th.agents')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center hidden md:table-cell">{t('adm.acc.users.th.convs')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center hidden md:table-cell">{t('adm.acc.users.th.products')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-right hidden lg:table-cell">{t('adm.acc.users.th.revenue')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">{t('adm.acc.users.th.joined')}</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-right">{t('adm.acc.users.th.actions')}</th>
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
                                  {t('adm.acc.users.badge.admin')}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
                                  {t('adm.acc.users.badge.you')}
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
                            title={t('adm.acc.users.viewDetails')}
                            aria-label={t('adm.acc.users.viewDetails')}
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditing(u)}
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title={t('adm.acc.edit')}
                            aria-label={t('adm.acc.edit')}
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(u)}
                            disabled={isCurrent}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('adm.acc.delete')}
                            aria-label={t('adm.acc.delete')}
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
        <FilterSection label={t('adm.acc.sortBy')}>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="createdAt">{t('adm.acc.users.f.sort.joined')}</option>
              <option value="email">{t('adm.acc.users.f.sort.email')}</option>
              <option value="firstName">{t('adm.acc.users.f.sort.firstName')}</option>
              <option value="lastName">{t('adm.acc.users.f.sort.lastName')}</option>
              <option value="plan">{t('adm.acc.users.f.sort.plan')}</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="desc">{t('adm.acc.users.f.sort.newest')}</option>
              <option value="asc">{t('adm.acc.users.f.sort.oldest')}</option>
            </select>
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.plan')}>
          <div className="flex flex-wrap gap-2">
            <FilterChip label={t('adm.acc.all')} active={planFilter === 'all'} onClick={() => setPlanFilter('all')} />
            <FilterChip label={t('adm.acc.users.f.individual')} active={planFilter === 'individual'} onClick={() => setPlanFilter('individual')} />
            <FilterChip label={t('adm.acc.users.f.teams')} active={planFilter === 'teams'} onClick={() => setPlanFilter('teams')} />
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.role')}>
          <div className="flex flex-wrap gap-2">
            <FilterChip label={t('adm.acc.all')} active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
            <FilterChip label={t('adm.acc.users.f.admins')} active={roleFilter === 'admin'} onClick={() => setRoleFilter('admin')} />
            <FilterChip label={t('adm.acc.users.f.regular')} active={roleFilter === 'user'} onClick={() => setRoleFilter('user')} />
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.activity')}>
          <div className="flex flex-wrap gap-2">
            <FilterChip label={t('adm.acc.all')} active={activityFilter === 'all'} onClick={() => setActivityFilter('all')} />
            <FilterChip label={t('adm.acc.users.f.withPages')} active={activityFilter === 'with-pages'} onClick={() => setActivityFilter('with-pages')} />
            <FilterChip label={t('adm.acc.users.f.withAgents')} active={activityFilter === 'with-agents'} onClick={() => setActivityFilter('with-agents')} />
            <FilterChip label={t('adm.acc.users.f.inactive')} active={activityFilter === 'inactive'} onClick={() => setActivityFilter('inactive')} />
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.users.f.joinedDate')}>
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

        <FilterSection label={t('adm.acc.users.f.pagesCount')}>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minPages} onChange={(e) => setMinPages(e.target.value)} placeholder={t('adm.acc.min')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} placeholder={t('adm.acc.max')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.users.f.productsCount')}>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minProducts} onChange={(e) => setMinProducts(e.target.value)} placeholder={t('adm.acc.min')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxProducts} onChange={(e) => setMaxProducts(e.target.value)} placeholder={t('adm.acc.max')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.users.f.revenue')}>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} placeholder={t('adm.acc.min')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxRevenue} onChange={(e) => setMaxRevenue(e.target.value)} placeholder={t('adm.acc.max')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label={t('adm.acc.users.f.minConversations')}>
          <input type="number" value={minConversations} onChange={(e) => setMinConversations(e.target.value)} placeholder={t('adm.acc.users.f.minConversationsPlaceholder')} className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
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
            <h3 className="text-lg font-bold text-white mb-2">{t('adm.acc.users.del.title')}</h3>
            <p className="text-sm text-zinc-400 mb-6">
              {t('adm.acc.users.del.bodyPrefix')} <span className="text-white font-medium">{deleteConfirm.email}</span> {t('adm.acc.users.del.bodySuffix')}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                {t('adm.acc.cancel')}
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete}>
                {t('adm.acc.delete')}
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
  const { t } = useTranslation();
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
          toast.error(t('adm.acc.userForm.err.passwordShort'));
          setSaving(false);
          return;
        }
        data.password = password;
      }
      await updateAdminUser(user.id, data);
      toast.success(t('adm.acc.users.toast.updated'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.acc.err.update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">{t('adm.acc.userForm.title')}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label={t('adm.acc.close')}>
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t('adm.acc.userForm.email')}</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2.5 bg-black/40 border border-white/5 rounded-lg text-zinc-500 text-sm cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t('adm.acc.userForm.firstName')}</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t('adm.acc.userForm.lastName')}</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t('adm.acc.userForm.plan')}</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="individual">{t('adm.acc.userForm.individual')}</option>
              <option value="teams">{t('adm.acc.userForm.teams')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              {t('adm.acc.userForm.resetPassword')} <span className="text-zinc-700 normal-case lowercase">{t('adm.acc.userForm.resetPasswordHint')}</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('adm.acc.userForm.passwordPlaceholder')}
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('adm.acc.cancel')}
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t('adm.acc.saving') : t('adm.acc.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
