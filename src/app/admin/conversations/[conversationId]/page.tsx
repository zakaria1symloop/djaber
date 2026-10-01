'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getAdminConversationDetails,
  type AdminConversationDetails,
} from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui';
import {
  RefreshIcon,
  FacebookIcon,
  BotIcon,
} from '@/components/ui/icons';
import { useTranslation } from '@/contexts/LanguageContext';

export default function AdminConversationDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const id = params?.conversationId as string;

  const [data, setData] = useState<AdminConversationDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getAdminConversationDetails(id);
      setData(res.conversation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adm.plat.conv.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/admin/conversations')}
          className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1.5 mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('adm.plat.conv.back')}
        </button>
        <div className="h-24 bg-zinc-900/60 rounded-xl animate-pulse" />
        <div className="h-96 bg-zinc-900/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/admin/conversations')}
          className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('adm.plat.conv.back')}
        </button>
        <button
          onClick={load}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors"
          title={t('adm.plat.refresh')}
          aria-label={t('adm.plat.refresh')}
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Header card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-base font-semibold text-zinc-200 flex-shrink-0">
              {(data.senderName || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white truncate mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {data.senderName || t('adm.plat.convs.unknown')}
                </h1>
                <PlatformIcon />
              </div>
              <p className="text-xs text-zinc-500 truncate font-mono">{data.senderId}</p>
            </div>
          </div>
          <Badge variant={data.status === 'active' ? 'success' : data.status === 'resolved' ? 'info' : 'default'} size="sm">
            {t(`adm.plat.convs.status.${data.status}`, data.status)}
          </Badge>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/5">
          <Meta label={t('adm.plat.page')} value={data.page?.pageName || '—'} />
          <Meta label={t('adm.plat.owner')} value={data.user ? `${data.user.firstName} ${data.user.lastName}` : '—'} />
          <Meta label={t('adm.plat.conv.meta.agent')} value={data.agent?.name || '—'} />
          <Meta label={t('adm.plat.conv.meta.messages')} value={data._count.messages.toString()} />
        </div>
      </div>

      {/* Messages */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl">
        <div className="px-5 py-3 border-b border-white/5">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('adm.plat.conv.messages')}</h2>
        </div>
        {data.messages.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">{t('adm.plat.conv.noMessages')}</div>
        ) : (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {data.messages.map((msg: any) => {
              const isAi = msg.isFromPage === true;
              const text = msg.text;
              const time = msg.timestamp || msg.createdAt;
              const hasImage = msg.attachmentUrl && (msg.attachmentType === 'image' || msg.attachmentUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i));
              const hasAttachment = msg.attachmentUrl && !hasImage;
              return (
                <div key={msg.id} className={`flex gap-3 ${isAi ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isAi ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/10 text-zinc-300 border border-white/10'
                  }`}>
                    {isAi ? <BotIcon className="w-4 h-4" /> : (data.senderName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[70%] space-y-1">
                    {hasImage && (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                        <img src={msg.attachmentUrl} alt={t('adm.plat.conv.attachmentAlt')} className="max-w-full max-h-48 rounded-xl border border-white/10 object-cover hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                    {hasAttachment && (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-blue-400 hover:text-blue-300">
                        📎 {msg.attachmentType || t('adm.plat.conv.file')}
                      </a>
                    )}
                    {text && (
                      <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        isAi ? 'bg-emerald-500/10 border border-emerald-500/20 text-zinc-100' : 'bg-white/5 border border-white/10 text-zinc-100'
                      }`}>
                        {text}
                      </div>
                    )}
                    {!text && !msg.attachmentUrl && (
                      <div className="px-4 py-2.5 rounded-2xl text-sm bg-white/5 border border-white/10 text-zinc-500 italic">
                        {t('adm.plat.conv.emptyMessage')}
                      </div>
                    )}
                    <p className={`text-[10px] text-zinc-600 mt-1 ${isAi ? 'text-end' : ''}`}>
                      {new Date(time).toLocaleString()} · {isAi ? t('adm.plat.conv.ai') : t('adm.plat.conv.customer')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-white truncate">{value}</p>
    </div>
  );
}

function PlatformIcon() {
  return <span style={{ color: '#1877F2' }}><FacebookIcon className="w-4 h-4" /></span>;
}
