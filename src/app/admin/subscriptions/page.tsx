'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listAdminSubscriptions,
  createAdminSubscription,
  updateAdminSubscription,
  deleteAdminSubscription,
  listAdminPlans,
  listAdminUsers,
  type AdminSubscription,
  type AdminPlan,
  type AdminUser,
} from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { Avatar, Badge, Button } from '@/components/ui';
import {
  PlusIcon,
  RefreshIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  SearchIcon,
} from '@/components/ui/icons';
import { FilterPanel, FilterPanelTrigger, FilterSection, FilterChip } from '@/components/admin/FilterPanel';
import { SkeletonTable } from '@/components/ui/Loader';

export default function AdminSubscriptionsPage() {
  const toast = useToast();
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminSubscription | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminSubscription | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'cancelled' | 'expired'>('all');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [expiringSoon, setExpiringSoon] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    try {
      setLoading(true);
      const expiringBefore = expiringSoon
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const res = await listAdminSubscriptions({
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        planSlug: planFilter || undefined,
        expiringBefore,
        limit: 200,
      });
      setSubs(res.subscriptions);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, planFilter, expiringSoon]);

  const stats = useMemo(() => {
    const now = Date.now();
    const monthly = subs
      .filter((s) => s.status === 'active' && s.billingCycle === 'monthly')
      .reduce((sum, s) => sum + Number(s.plan?.priceMonthly || 0), 0);
    const yearly = subs
      .filter((s) => s.status === 'active' && s.billingCycle === 'yearly')
      .reduce((sum, s) => sum + Number(s.plan?.priceYearly || 0), 0);
    const expiringIn7 = subs.filter(
      (s) => s.status === 'active' && new Date(s.endDate).getTime() - now < 7 * 24 * 60 * 60 * 1000
    ).length;
    return {
      total: subs.length,
      active: subs.filter((s) => s.status === 'active').length,
      mrr: monthly + yearly / 12,
      expiringSoon: expiringIn7,
    };
  }, [subs]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (planFilter ? 1 : 0) + (expiringSoon ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('all');
    setPlanFilter('');
    setExpiringSoon(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteAdminSubscription(deleteConfirm.id);
      toast.success('Subscription deleted');
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
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Subscriptions
          </h1>
          <p className="text-sm text-zinc-400">Manage which user is on which plan, billing dates, and renewals</p>
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
          <Button onClick={() => setCreating(true)} icon={<PlusIcon className="w-4 h-4" />}>
            New subscription
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={stats.total.toString()} />
        <StatCard label="Active" value={stats.active.toString()} />
        <StatCard label="Expiring 7d" value={stats.expiringSoon.toString()} />
        <StatCard label="MRR" value={`${Math.round(stats.mrr).toLocaleString()} DA`} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user name or email…"
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : subs.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-sm text-zinc-500">
          {activeFilterCount > 0 || debouncedSearch
            ? 'No subscriptions match your filters'
            : 'No subscriptions yet — click "New subscription" to assign a plan to a user'}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Cycle</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Started</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Ends</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const daysLeft = Math.ceil(
                    (new Date(s.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                  );
                  return (
                    <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        {s.user ? (
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              initials={`${s.user.firstName?.[0] || ''}${s.user.lastName?.[0] || ''}`}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">
                                {s.user.firstName} {s.user.lastName}
                              </p>
                              <p className="text-[11px] text-zinc-500 truncate">{s.user.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">Deleted user</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white">{s.plan?.name || s.planSlug}</p>
                          <p className="text-[11px] text-zinc-500">
                            {s.plan ? `${Number(s.plan.priceMonthly).toLocaleString()} ${s.plan.currency}/mo` : ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            s.status === 'active' ? 'success' :
                            s.status === 'trial' ? 'info' :
                            s.status === 'cancelled' ? 'warning' : 'default'
                          }
                          size="sm"
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-zinc-300 capitalize">{s.billingCycle}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-zinc-500">{new Date(s.startDate).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="text-white">{new Date(s.endDate).toLocaleDateString()}</p>
                          <p
                            className={`text-[11px] ${
                              daysLeft < 0 ? 'text-red-400' : daysLeft < 7 ? 'text-yellow-400' : 'text-zinc-500'
                            }`}
                          >
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(s)}
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(s)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} onClear={clearFilters}>
        <FilterSection label="Status">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Active" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
            <FilterChip label="Trial" active={statusFilter === 'trial'} onClick={() => setStatusFilter('trial')} />
            <FilterChip label="Cancelled" active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} />
            <FilterChip label="Expired" active={statusFilter === 'expired'} onClick={() => setStatusFilter('expired')} />
          </div>
        </FilterSection>
        <FilterSection label="Plan">
          <PlanSelect value={planFilter} onChange={setPlanFilter} />
        </FilterSection>
        <FilterSection label="Expiring soon">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={expiringSoon}
              onChange={(e) => setExpiringSoon(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-black/60 text-white focus:ring-1 focus:ring-white/30"
            />
            Expiring within 7 days
          </label>
        </FilterSection>
      </FilterPanel>

      {/* Edit/Create modal */}
      {(editing || creating) && (
        <SubscriptionFormModal
          subscription={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={async () => {
            setEditing(null);
            setCreating(false);
            await load();
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Delete subscription?</h3>
            <p className="text-sm text-zinc-400 mb-6">
              This removes the subscription record. The user&apos;s plan field stays as-is. Continue?
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

function PlanSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  useEffect(() => {
    listAdminPlans().then((r) => setPlans(r.plans)).catch(() => {});
  }, []);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
    >
      <option value="">All plans</option>
      {plans.map((p) => (
        <option key={p.id} value={p.slug}>{p.name}</option>
      ))}
    </select>
  );
}

function SubscriptionFormModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: AdminSubscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!subscription;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [userId, setUserId] = useState(subscription?.userId || '');
  const [planSlug, setPlanSlug] = useState(subscription?.planSlug || '');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    (subscription?.billingCycle as 'monthly' | 'yearly') || 'monthly'
  );
  const [status, setStatus] = useState<'active' | 'trial' | 'cancelled' | 'expired'>(
    (subscription?.status as 'active' | 'trial' | 'cancelled' | 'expired') || 'active'
  );
  const toDateInput = (iso: string) => new Date(iso).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const monthFromToday = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  })();

  const [startDate, setStartDate] = useState(
    subscription ? toDateInput(subscription.startDate) : today
  );
  const [endDate, setEndDate] = useState(
    subscription ? toDateInput(subscription.endDate) : monthFromToday
  );
  const [notes, setNotes] = useState(subscription?.notes || '');
  const [chargilySubId, setChargilySubId] = useState(subscription?.chargilySubscriptionId || '');
  const [chargilyCustomerId, setChargilyCustomerId] = useState(subscription?.chargilyCustomerId || '');

  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    listAdminPlans().then((r) => setPlans(r.plans)).catch(() => {});
    if (!isEdit) {
      listAdminUsers({ limit: 500 }).then((r) => setUsers(r.users)).catch(() => {});
    }
  }, [isEdit]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users.slice(0, 50);
    return users
      .filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [users, userSearch]);

  const handleSave = async () => {
    if (!userId || !planSlug) {
      toast.error('Pick a user and a plan');
      return;
    }
    try {
      setSaving(true);
      const data = {
        userId,
        planSlug,
        billingCycle,
        status,
        startDate,
        endDate,
        notes: notes || null,
        chargilySubscriptionId: chargilySubId || null,
        chargilyCustomerId: chargilyCustomerId || null,
      };
      if (isEdit && subscription) {
        await updateAdminSubscription(subscription.id, data);
        toast.success('Subscription updated');
      } else {
        await createAdminSubscription(data);
        toast.success('Subscription created');
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">
            {isEdit ? 'Edit subscription' : 'New subscription'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!isEdit && (
            <Field label="User">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user by email or name…"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none mb-2"
              />
              <div className="max-h-48 overflow-y-auto bg-black/40 border border-white/5 rounded-lg divide-y divide-white/5">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUserId(u.id)}
                    className={`w-full text-left px-3 py-2 hover:bg-white/5 transition-colors ${
                      userId === u.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <p className="text-xs text-white">{u.firstName} {u.lastName}</p>
                    <p className="text-[10px] text-zinc-500">{u.email}</p>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="px-3 py-2 text-xs text-zinc-600">No users found</p>
                )}
              </div>
            </Field>
          )}

          <Field label="Plan">
            <select
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="">— Select a plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name} — {Number(p.priceMonthly).toLocaleString()} {p.currency}/mo
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing cycle">
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes about this subscription…"
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none resize-none"
            />
          </Field>

          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Chargily Pay</p>
            <div className="space-y-3">
              <Field label="Subscription ID">
                <input
                  type="text"
                  value={chargilySubId}
                  onChange={(e) => setChargilySubId(e.target.value)}
                  placeholder="01_xxx"
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none font-mono"
                />
              </Field>
              <Field label="Customer ID">
                <input
                  type="text"
                  value={chargilyCustomerId}
                  onChange={(e) => setChargilyCustomerId(e.target.value)}
                  placeholder="01_xxx"
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none font-mono"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}
