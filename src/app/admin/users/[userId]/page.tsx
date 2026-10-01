'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getAdminUserDetails,
  updateAdminUser,
  deleteAdminUser,
  type AdminUserDetails,
} from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { Avatar, Badge, Button } from '@/components/ui';
import {
  ChatIcon,
  BotIcon,
  BoxIcon,
  ShoppingCartIcon,
  UsersIcon,
  DollarIcon,
  FacebookIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  RefreshIcon,
} from '@/components/ui/icons';
import { useTranslation } from '@/contexts/LanguageContext';

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { t } = useTranslation();
  const userId = params?.userId as string;

  const [data, setData] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getAdminUserDetails(userId);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.acc.udet.err.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteAdminUser(userId);
      toast.success(t('adm.acc.users.toast.deleted'));
      router.push('/admin/users');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.acc.err.delete'));
      setDeleting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin/users')}
            className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('adm.acc.udet.back')}
          </button>
        </div>
        <div className="h-24 bg-zinc-900/60 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900/60 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-zinc-900/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {/* Top bar with back + actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/admin/users')}
          className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('adm.acc.udet.back')}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors"
            title={t('adm.acc.refresh')}
            aria-label={t('adm.acc.refresh')}
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
          <Button variant="outline" size="sm" icon={<EditIcon className="w-4 h-4" />} onClick={() => setEditing(true)}>
            {t('adm.acc.edit')}
          </Button>
          <Button variant="danger" size="sm" icon={<TrashIcon className="w-4 h-4" />} onClick={() => setDeleteConfirm(true)}>
            {t('adm.acc.delete')}
          </Button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <Avatar initials={`${data.user.firstName?.[0] || ''}${data.user.lastName?.[0] || ''}`} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white truncate mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {data.user.firstName} {data.user.lastName}
              </h1>
              {data.user.isAdmin && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white uppercase tracking-wider">{t('adm.acc.users.badge.admin')}</span>
              )}
            </div>
            <p className="text-sm text-zinc-400 truncate">{data.user.email}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              <Badge variant={data.user.plan === 'teams' ? 'info' : 'default'} size="sm">{data.user.plan}</Badge>
              <span>{t('adm.acc.udet.joined')} {new Date(data.user.createdAt).toLocaleDateString()}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{t('adm.acc.udet.updated')} {new Date(data.user.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatTile icon={<ChatIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.pages')} value={data.pages.length} />
        <StatTile icon={<BotIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.agents')} value={data.agents.length} />
        <StatTile icon={<ChatIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.conversations')} value={data.stats.conversations} />
        <StatTile icon={<ChatIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.messages')} value={data.stats.messages} />
        <StatTile icon={<BoxIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.products')} value={data.stats.products} />
        <StatTile icon={<UsersIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.clients')} value={data.stats.clients} />
        <StatTile icon={<ShoppingCartIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.sales')} value={data.stats.sales} />
        <StatTile icon={<ShoppingCartIcon className="w-4 h-4" />} label={t('adm.acc.udet.stat.orders')} value={data.stats.orders} />
        <StatTile
          icon={<DollarIcon className="w-4 h-4" />}
          label={t('adm.acc.udet.stat.revenue')}
          value={`${data.stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pages list */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            {t('adm.acc.udet.connectedPages')} ({data.pages.length})
          </h3>
          {data.pages.length === 0 ? (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 text-center text-xs text-zinc-600">
              {t('adm.acc.udet.noPages')}
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl divide-y divide-white/5 overflow-hidden">
              {data.pages.map((page) => (
                <div key={page.id} className="p-3 flex items-center gap-3 hover:bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <PlatformIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{page.pageName}</p>
                    <p className="text-[11px] text-zinc-500 capitalize">
                      {page.platform} · {page._count.conversations} {t('adm.acc.udet.convShort')} · {new Date(page.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {page.isActive ? (
                    <Badge variant="success" size="sm">{t('adm.acc.active')}</Badge>
                  ) : (
                    <Badge variant="default" size="sm">{t('adm.acc.inactive')}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agents list */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            {t('adm.acc.udet.aiAgents')} ({data.agents.length})
          </h3>
          {data.agents.length === 0 ? (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 text-center text-xs text-zinc-600">
              {t('adm.acc.udet.noAgents')}
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl divide-y divide-white/5 overflow-hidden">
              {data.agents.map((agent) => (
                <div key={agent.id} className="p-3 flex items-center gap-3 hover:bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <BotIcon className="w-4 h-4 text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white truncate">{agent.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 capitalize">{agent.personality}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {agent.aiModel} · {agent._count.pages} {t('adm.acc.udet.pagesShort')} · {agent._count.conversations} {t('adm.acc.udet.convsShort')}
                    </p>
                  </div>
                  {agent.isActive ? (
                    <Badge variant="success" size="sm">{t('adm.acc.active')}</Badge>
                  ) : (
                    <Badge variant="default" size="sm">{t('adm.acc.inactive')}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          {t('adm.acc.udet.recentConvs')}
        </h3>
        {data.recentConversations.length === 0 ? (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 text-center text-xs text-zinc-600">
            {t('adm.acc.udet.noConvs')}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl divide-y divide-white/5 overflow-hidden">
            {data.recentConversations.map((conv) => (
              <div key={conv.id} className="p-3 flex items-center gap-3 hover:bg-white/[0.02]">
                <PlatformIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{conv.senderName || t('adm.acc.udet.unknown')}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {conv.page?.pageName || t('adm.acc.udet.noPage')} · {conv._count.messages} {conv._count.messages !== 1 ? t('adm.acc.udet.messageMany') : t('adm.acc.udet.messageOne')} · {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={conv.status === 'active' ? 'success' : 'default'} size="sm">{conv.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditUserModal
          user={data.user}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
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
              {t('adm.acc.users.del.bodyPrefix')} <span className="text-white font-medium">{data.user.email}</span> {t('adm.acc.users.del.bodySuffixShort')}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                {t('adm.acc.cancel')}
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('adm.acc.deleting') : t('adm.acc.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-3">
      <div className="flex items-center gap-2 text-zinc-500 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function PlatformIcon() {
  return <span style={{ color: '#1877F2' }}><FacebookIcon className="w-4 h-4" /></span>;
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserDetails['user'];
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
