'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
  type AdminPlan,
  type AdminPlanInput,
} from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { Badge, Button } from '@/components/ui';
import {
  PlusIcon,
  RefreshIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  CloseIcon,
  StarIcon,
  UsersIcon,
  BoxIcon,
  ChatIcon,
  BotIcon,
} from '@/components/ui/icons';
import { FilterPanel, FilterPanelTrigger, FilterSection, FilterChip } from '@/components/admin/FilterPanel';
import { SkeletonCard } from '@/components/ui/Loader';

type StatusFilter = 'all' | 'active' | 'inactive';
type ChargilyFilter = 'all' | 'linked' | 'not-linked';
type SortBy = 'sortOrder' | 'name' | 'priceMonthly' | 'subscriberCount' | 'createdAt';

export default function AdminPlansPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminPlan | null>(null);

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [chargilyFilter, setChargilyFilter] = useState<ChargilyFilter>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [minProductsLimit, setMinProductsLimit] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('sortOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    try {
      setLoading(true);
      const res = await listAdminPlans();
      setPlans(res.plans);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = plans.filter((p) => {
      if (statusFilter === 'active' && !p.isActive) return false;
      if (statusFilter === 'inactive' && p.isActive) return false;
      if (featuredOnly && !p.isFeatured) return false;
      if (chargilyFilter === 'linked' && !p.chargilyProductId) return false;
      if (chargilyFilter === 'not-linked' && p.chargilyProductId) return false;
      if (minPrice && Number(p.priceMonthly) < Number(minPrice)) return false;
      if (maxPrice && Number(p.priceMonthly) > Number(maxPrice)) return false;
      if (minSubs && p.subscriberCount < Number(minSubs)) return false;
      if (maxSubs && p.subscriberCount > Number(maxSubs)) return false;
      if (minProductsLimit && p.maxProducts < Number(minProductsLimit) && p.maxProducts !== -1) return false;
      if (q) {
        const match =
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortBy) {
        case 'name': av = a.name; bv = b.name; break;
        case 'priceMonthly': av = Number(a.priceMonthly); bv = Number(b.priceMonthly); break;
        case 'subscriberCount': av = a.subscriberCount; bv = b.subscriberCount; break;
        case 'createdAt': av = a.createdAt; bv = b.createdAt; break;
        default: av = a.sortOrder; bv = b.sortOrder;
      }
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [plans, statusFilter, featuredOnly, chargilyFilter, minPrice, maxPrice, minSubs, maxSubs, minProductsLimit, search, sortBy, sortOrder]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (featuredOnly ? 1 : 0) +
    (chargilyFilter !== 'all' ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (minSubs ? 1 : 0) +
    (maxSubs ? 1 : 0) +
    (minProductsLimit ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (sortBy !== 'sortOrder' || sortOrder !== 'asc' ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('all');
    setFeaturedOnly(false);
    setChargilyFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setMinSubs('');
    setMaxSubs('');
    setMinProductsLimit('');
    setSearch('');
    setSortBy('sortOrder');
    setSortOrder('asc');
  };

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter((p) => p.isActive).length,
    totalSubscribers: plans.reduce((s, p) => s + p.subscriberCount, 0),
    revenuePotential: plans.reduce((s, p) => s + p.subscriberCount * Number(p.priceMonthly), 0),
  }), [plans]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteAdminPlan(deleteConfirm.id);
      toast.success(`Plan "${deleteConfirm.name}" deleted`);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleToggleActive = async (plan: AdminPlan) => {
    try {
      await updateAdminPlan(plan.id, { isActive: !plan.isActive });
      toast.success(`${plan.name} ${!plan.isActive ? 'enabled' : 'disabled'}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle');
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Plans
          </h1>
          <p className="text-sm text-zinc-400">
            Manage subscription plans, limits, and Chargily Pay integration
          </p>
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
            New plan
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Plans" value={stats.total.toString()} />
        <StatCard label="Active" value={stats.active.toString()} />
        <StatCard label="Subscribers" value={stats.totalSubscribers.toString()} />
        <StatCard label="MRR Potential" value={`${stats.revenuePotential.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`} />
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} className="h-96" />)}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-sm text-zinc-500">
          {activeFilterCount > 0 ? 'No plans match your filters' : 'No plans yet — click New plan to create one'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => setEditing(plan)}
              onDelete={() => setDeleteConfirm(plan)}
              onToggleActive={() => handleToggleActive(plan)}
            />
          ))}
        </div>
      )}

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={clearFilters}
      >
        <FilterSection label="Search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, slug or description"
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
        </FilterSection>

        <FilterSection label="Sort by">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="sortOrder">Display order</option>
              <option value="name">Name</option>
              <option value="priceMonthly">Price</option>
              <option value="subscriberCount">Subscribers</option>
              <option value="createdAt">Created</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </FilterSection>

        <FilterSection label="Status">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Active" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
            <FilterChip label="Inactive" active={statusFilter === 'inactive'} onClick={() => setStatusFilter('inactive')} />
          </div>
        </FilterSection>

        <FilterSection label="Featured">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(e) => setFeaturedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-black/60 text-white focus:ring-1 focus:ring-white/30"
            />
            Featured plans only
          </label>
        </FilterSection>

        <FilterSection label="Chargily Pay">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={chargilyFilter === 'all'} onClick={() => setChargilyFilter('all')} />
            <FilterChip label="Linked" active={chargilyFilter === 'linked'} onClick={() => setChargilyFilter('linked')} />
            <FilterChip label="Not linked" active={chargilyFilter === 'not-linked'} onClick={() => setChargilyFilter('not-linked')} />
          </div>
        </FilterSection>

        <FilterSection label="Monthly price (DA)">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label="Subscribers">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={minSubs} onChange={(e) => setMinSubs(e.target.value)} placeholder="Min" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
            <input type="number" value={maxSubs} onChange={(e) => setMaxSubs(e.target.value)} placeholder="Max" className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none" />
          </div>
        </FilterSection>

        <FilterSection label="Min products limit">
          <input
            type="number"
            value={minProductsLimit}
            onChange={(e) => setMinProductsLimit(e.target.value)}
            placeholder="e.g. 100"
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
        </FilterSection>
      </FilterPanel>

      {/* Edit modal */}
      {(editing || creating) && (
        <PlanFormModal
          plan={editing}
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
            <h3 className="text-lg font-bold text-white mb-2">Delete plan?</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Permanently delete <span className="text-white font-medium">{deleteConfirm.name}</span>?
              {deleteConfirm.subscriberCount > 0 && (
                <> <span className="text-yellow-400">{deleteConfirm.subscriberCount} user{deleteConfirm.subscriberCount !== 1 ? 's are' : ' is'} on this plan.</span></>
              )}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>
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

function PlanCard({
  plan,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  plan: AdminPlan;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-colors flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white truncate">{plan.name}</h3>
            {plan.isFeatured && (
              <span title="Featured" className="text-yellow-400">
                <StarIcon className="w-4 h-4" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">{plan.slug}</p>
        </div>
        <Badge variant={plan.isActive ? 'success' : 'default'} size="sm">
          {plan.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Description */}
      {plan.description && <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{plan.description}</p>}

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {Number(plan.priceMonthly).toLocaleString()}
          </span>
          <span className="text-sm text-zinc-500">{plan.currency}/mo</span>
        </div>
        {Number(plan.priceYearly) > 0 && (
          <p className="text-[11px] text-zinc-600 mt-0.5">
            or {Number(plan.priceYearly).toLocaleString()} {plan.currency}/yr
          </p>
        )}
      </div>

      {/* Limits */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <LimitTile icon={<ChatIcon className="w-3.5 h-3.5" />} label="Pages" value={plan.maxPages} />
        <LimitTile icon={<BotIcon className="w-3.5 h-3.5" />} label="Agents" value={plan.maxAgents} />
        <LimitTile icon={<BoxIcon className="w-3.5 h-3.5" />} label="Products" value={plan.maxProducts} />
        <LimitTile icon={<ChatIcon className="w-3.5 h-3.5" />} label="Convs" value={plan.maxConversations} />
      </div>

      {/* Features */}
      {plan.features.length > 0 && (
        <ul className="space-y-1 mb-4 flex-1">
          {plan.features.slice(0, 5).map((feat, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{feat}</span>
            </li>
          ))}
          {plan.features.length > 5 && (
            <li className="text-[11px] text-zinc-600 ml-5">+{plan.features.length - 5} more</li>
          )}
        </ul>
      )}

      {/* Subscribers + Chargily */}
      <div className="space-y-2 mb-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 flex items-center gap-1.5">
            <UsersIcon className="w-3.5 h-3.5" /> Subscribers
          </span>
          <span className="text-white font-semibold">{plan.subscriberCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Chargily</span>
          {plan.chargilyProductId ? (
            <span className="text-emerald-400 font-mono text-[10px]">
              {plan.chargilyProductId.slice(0, 12)}…
            </span>
          ) : (
            <span className="text-zinc-600">Not linked</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleActive}
          className="flex-1 px-3 py-2 text-xs text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
        >
          {plan.isActive ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          title="Edit"
        >
          <EditIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-lg transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function LimitTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2">
      <div className="flex items-center gap-1 text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-white">
        {value === -1 ? '∞' : value.toLocaleString()}
      </div>
    </div>
  );
}

function PlanFormModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: AdminPlan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!plan;

  const [form, setForm] = useState<AdminPlanInput>({
    slug: plan?.slug || '',
    name: plan?.name || '',
    description: plan?.description || '',
    priceMonthly: Number(plan?.priceMonthly || 0),
    priceYearly: Number(plan?.priceYearly || 0),
    currency: plan?.currency || 'DA',
    maxPages: plan?.maxPages ?? 1,
    maxAgents: plan?.maxAgents ?? 1,
    maxProducts: plan?.maxProducts ?? 50,
    maxConversations: plan?.maxConversations ?? 100,
    maxTeamMembers: plan?.maxTeamMembers ?? 1,
    features: plan?.features || [],
    isActive: plan?.isActive ?? true,
    isFeatured: plan?.isFeatured ?? false,
    sortOrder: plan?.sortOrder ?? 0,
    chargilyProductId: plan?.chargilyProductId || '',
    chargilyPriceMonthlyId: plan?.chargilyPriceMonthlyId || '',
    chargilyPriceYearlyId: plan?.chargilyPriceYearlyId || '',
  });

  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof AdminPlanInput>(key: K, value: AdminPlanInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addFeature = () => {
    const v = featureInput.trim();
    if (!v) return;
    update('features', [...(form.features || []), v]);
    setFeatureInput('');
  };

  const removeFeature = (i: number) => {
    update('features', (form.features || []).filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim()) {
      toast.error('Slug and name are required');
      return;
    }
    try {
      setSaving(true);
      if (isEdit && plan) {
        await updateAdminPlan(plan.id, form);
        toast.success('Plan updated');
      } else {
        await createAdminPlan(form);
        toast.success('Plan created');
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
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{isEdit ? 'Edit plan' : 'Create plan'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug">
              <input
                type="text"
                value={form.slug}
                onChange={(e) => update('slug', e.target.value)}
                placeholder="individual"
                disabled={isEdit}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none disabled:opacity-50"
              />
            </Field>
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Individual"
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none resize-none"
            />
          </Field>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Monthly price">
              <input
                type="number"
                value={form.priceMonthly}
                onChange={(e) => update('priceMonthly', Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
            <Field label="Yearly price">
              <input
                type="number"
                value={form.priceYearly}
                onChange={(e) => update('priceYearly', Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={form.currency}
                onChange={(e) => update('currency', e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
              />
            </Field>
          </div>

          {/* Limits */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Limits <span className="text-zinc-700 normal-case">(use −1 for unlimited)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Pages">
                <input type="number" value={form.maxPages} onChange={(e) => update('maxPages', Number(e.target.value))} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
              </Field>
              <Field label="Agents">
                <input type="number" value={form.maxAgents} onChange={(e) => update('maxAgents', Number(e.target.value))} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
              </Field>
              <Field label="Products">
                <input type="number" value={form.maxProducts} onChange={(e) => update('maxProducts', Number(e.target.value))} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
              </Field>
              <Field label="Conversations / month">
                <input type="number" value={form.maxConversations} onChange={(e) => update('maxConversations', Number(e.target.value))} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
              </Field>
              <Field label="Team members">
                <input type="number" value={form.maxTeamMembers} onChange={(e) => update('maxTeamMembers', Number(e.target.value))} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
              </Field>
              <Field label="Sort order">
                <input type="number" value={form.sortOrder} onChange={(e) => update('sortOrder', Number(e.target.value))} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
              </Field>
            </div>
          </div>

          {/* Features */}
          <Field label="Features">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeature();
                  }
                }}
                placeholder="Add a feature and press Enter"
                className="flex-1 px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
              />
              <button
                onClick={addFeature}
                type="button"
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white"
              >
                Add
              </button>
            </div>
            {(form.features || []).length > 0 && (
              <ul className="space-y-1.5">
                {(form.features || []).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-300 px-3 py-1.5 bg-white/5 rounded-lg">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="flex-1">{f}</span>
                    <button onClick={() => removeFeature(i)} className="text-zinc-500 hover:text-red-400">
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          {/* Chargily */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Chargily Pay <span className="text-zinc-700 normal-case">(Algerian payment processor)</span>
            </p>
            <div className="space-y-3">
              <Field label="Product ID">
                <input
                  type="text"
                  value={form.chargilyProductId || ''}
                  onChange={(e) => update('chargilyProductId', e.target.value)}
                  placeholder="01_xxx"
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none font-mono"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly price ID">
                  <input
                    type="text"
                    value={form.chargilyPriceMonthlyId || ''}
                    onChange={(e) => update('chargilyPriceMonthlyId', e.target.value)}
                    placeholder="01_xxx"
                    className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none font-mono"
                  />
                </Field>
                <Field label="Yearly price ID">
                  <input
                    type="text"
                    value={form.chargilyPriceYearlyId || ''}
                    onChange={(e) => update('chargilyPriceYearlyId', e.target.value)}
                    placeholder="01_xxx"
                    className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none font-mono"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-black/60 text-white focus:ring-1 focus:ring-white/30"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => update('isFeatured', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-black/60 text-white focus:ring-1 focus:ring-white/30"
              />
              Featured (highlighted on pricing page)
            </label>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create plan'}
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
