'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listAdminConversations,
  listAdminLookupPages,
  listAdminLookupAgents,
  type AdminConversation,
  type AdminLookupPage,
  type AdminLookupAgent,
} from '@/lib/admin-api';
import { SkeletonTable } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui';
import {
  SearchIcon,
  RefreshIcon,
  ChatIcon,
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
} from '@/components/ui/icons';
import { FilterPanel, FilterPanelTrigger, FilterSection, FilterChip } from '@/components/admin/FilterPanel';

export default function AdminConversationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram' | 'whatsapp'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved' | 'archived'>('all');
  const [pageId, setPageId] = useState<string>('');
  const [agentId, setAgentId] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [minMessages, setMinMessages] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pages, setPages] = useState<AdminLookupPage[]>([]);
  const [agents, setAgents] = useState<AdminLookupAgent[]>([]);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'messages'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hasUser, setHasUser] = useState<'all' | 'with' | 'without'>('all');
  const [hasAgent, setHasAgent] = useState<'all' | 'with' | 'without'>('all');

  useEffect(() => {
    listAdminLookupPages().then((r) => setPages(r.pages)).catch(() => {});
    listAdminLookupAgents().then((r) => setAgents(r.agents)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listAdminConversations({
        search: debouncedSearch || undefined,
        platform: platformFilter !== 'all' ? platformFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        pageId: pageId || undefined,
        agentId: agentId || undefined,
        minMessages: minMessages ? Number(minMessages) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 200,
      });
      setConversations(res.conversations);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, platformFilter, statusFilter, pageId, agentId, minMessages, startDate, endDate]);

  const filtered = useMemo(() => {
    const owner = ownerSearch.trim().toLowerCase();
    let result = conversations.filter((c) => {
      if (hasUser === 'with' && !c.user) return false;
      if (hasUser === 'without' && c.user) return false;
      if (hasAgent === 'with' && !c.agent) return false;
      if (hasAgent === 'without' && c.agent) return false;
      if (owner) {
        const u = c.user;
        if (!u) return false;
        return (
          u.email.toLowerCase().includes(owner) ||
          u.firstName.toLowerCase().includes(owner) ||
          u.lastName.toLowerCase().includes(owner)
        );
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortBy) {
        case 'createdAt': av = a.createdAt; bv = b.createdAt; break;
        case 'messages': av = a._count.messages; bv = b._count.messages; break;
        default: av = a.updatedAt; bv = b.updatedAt;
      }
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [conversations, ownerSearch, hasUser, hasAgent, sortBy, sortOrder]);

  const activeFilterCount =
    (platformFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (pageId ? 1 : 0) +
    (agentId ? 1 : 0) +
    (ownerSearch.trim() ? 1 : 0) +
    (minMessages ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (hasUser !== 'all' ? 1 : 0) +
    (hasAgent !== 'all' ? 1 : 0) +
    (sortBy !== 'updatedAt' || sortOrder !== 'desc' ? 1 : 0);

  const stats = useMemo(() => {
    const totalMessages = conversations.reduce((s, c) => s + c._count.messages, 0);
    return {
      total,
      active: conversations.filter((c) => c.status === 'active').length,
      messages: totalMessages,
      uniqueUsers: new Set(conversations.map((c) => c.user?.id).filter(Boolean)).size,
    };
  }, [conversations, total]);

  const clearFilters = () => {
    setPlatformFilter('all');
    setStatusFilter('all');
    setPageId('');
    setAgentId('');
    setOwnerSearch('');
    setMinMessages('');
    setStartDate('');
    setEndDate('');
    setHasUser('all');
    setHasAgent('all');
    setSortBy('updatedAt');
    setSortOrder('desc');
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Conversations
          </h1>
          <p className="text-sm text-zinc-400">All AI-handled conversations across the platform</p>
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
        <StatCard label="Total" value={stats.total.toString()} />
        <StatCard label="Active" value={stats.active.toString()} />
        <StatCard label="Total Messages" value={stats.messages.toString()} />
        <StatCard label="Unique Users" value={stats.uniqueUsers.toString()} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by sender name…"
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-sm text-zinc-500">
          {activeFilterCount > 0 || debouncedSearch ? 'No conversations match your filters' : 'No conversations yet'}
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Sender</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Page</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">User</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-center">Messages</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/conversations/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-zinc-300 flex-shrink-0">
                          {(c.senderName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white truncate">{c.senderName || 'Unknown'}</p>
                            <PlatformIcon platform={c.platform} />
                          </div>
                          <p className="text-[11px] text-zinc-500 truncate">{c.senderId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.page ? (
                        <span className="text-xs text-zinc-300">{c.page.pageName}</span>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.user ? (
                        <div className="text-xs">
                          <p className="text-zinc-300 truncate max-w-[150px]">{c.user.firstName} {c.user.lastName}</p>
                          <p className="text-zinc-600 truncate max-w-[150px]">{c.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 text-xs text-zinc-300">
                        <ChatIcon className="w-3.5 h-3.5 text-zinc-500" />
                        {c._count.messages}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === 'active' ? 'success' : c.status === 'resolved' ? 'info' : 'default'} size="sm">
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-zinc-500">
                        {new Date(c.updatedAt).toLocaleDateString()} {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} onClear={clearFilters}>
        <FilterSection label="Sort by">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="updatedAt">Last activity</option>
              <option value="createdAt">Created</option>
              <option value="messages">Message count</option>
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

        <FilterSection label="Platform">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={platformFilter === 'all'} onClick={() => setPlatformFilter('all')} />
            <FilterChip label="Facebook" active={platformFilter === 'facebook'} onClick={() => setPlatformFilter('facebook')} />
            <FilterChip label="Instagram" active={platformFilter === 'instagram'} onClick={() => setPlatformFilter('instagram')} />
            <FilterChip label="WhatsApp" active={platformFilter === 'whatsapp'} onClick={() => setPlatformFilter('whatsapp')} />
          </div>
        </FilterSection>

        <FilterSection label="Status">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Active" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
            <FilterChip label="Resolved" active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')} />
            <FilterChip label="Archived" active={statusFilter === 'archived'} onClick={() => setStatusFilter('archived')} />
          </div>
        </FilterSection>

        <FilterSection label="Page">
          <select
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
          >
            <option value="">All pages</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.pageName} ({p.platform})</option>
            ))}
          </select>
        </FilterSection>

        <FilterSection label="Agent">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </FilterSection>

        <FilterSection label="Owner">
          <input
            type="text"
            value={ownerSearch}
            onChange={(e) => setOwnerSearch(e.target.value)}
            placeholder="Search owner email or name"
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
        </FilterSection>

        <FilterSection label="Min messages">
          <input
            type="number"
            value={minMessages}
            onChange={(e) => setMinMessages(e.target.value)}
            placeholder="e.g. 5"
            className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
        </FilterSection>

        <FilterSection label="Date range">
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

        <FilterSection label="Has owner (user)">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={hasUser === 'all'} onClick={() => setHasUser('all')} />
            <FilterChip label="With" active={hasUser === 'with'} onClick={() => setHasUser('with')} />
            <FilterChip label="Without" active={hasUser === 'without'} onClick={() => setHasUser('without')} />
          </div>
        </FilterSection>

        <FilterSection label="Has agent">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={hasAgent === 'all'} onClick={() => setHasAgent('all')} />
            <FilterChip label="With" active={hasAgent === 'with'} onClick={() => setHasAgent('with')} />
            <FilterChip label="Without" active={hasAgent === 'without'} onClick={() => setHasAgent('without')} />
          </div>
        </FilterSection>
      </FilterPanel>
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

function PlatformIcon({ platform }: { platform: string }) {
  const Icon =
    platform === 'facebook' ? FacebookIcon :
    platform === 'instagram' ? InstagramIcon :
    WhatsAppIcon;
  const color =
    platform === 'facebook' ? '#1877F2' :
    platform === 'instagram' ? '#E4405F' : '#25D366';
  return <span style={{ color }}><Icon className="w-3.5 h-3.5" /></span>;
}
