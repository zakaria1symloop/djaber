'use client';
// /channels/[id]/messages — Figma "CHN-07b — … Messages": the inbox filtered on this page (same conversations, same
// pills); each row opens the thread, "Ouvrir dans la boîte ›" opens the inbox with the channel filter.
import { Card, Pill, StatusPill } from '@djaber/ui';
import type { AppLocale } from '@djaber/shared';
import { ChevronRight, MessagesSquare } from 'lucide-react';
import { ListEmpty, ListLoading, QueryError } from '@/components/global-states';
import { previewTypeKey } from '@/features/inbox/logic';
import { Link } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import { useChannelConversations } from '../api';
import { useChannelPage } from './channel-shell';

export function ChannelMessages() {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const { channel: c } = useChannelPage();
  const q = useChannelConversations(c.id);
  const rows = q.data?.rows ?? [];
  return (
    <Card className="flex flex-col" data-testid="channel-messages">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="ts-title">{t('channels.messages.title')}</h2>
        <Link href={`/inbox?channel=${c.id}`} className="inline-flex items-center gap-1 ts-label-meta text-accent-inbound hover:underline">
          {t('channels.messages.openInbox')}
          <ChevronRight className="size-3 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>
      {q.isPending ? (
        <ListLoading rows={4} columns={3} />
      ) : q.isError ? (
        <div className="p-4">
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <ListEmpty title={t('channels.messages.empty.title')} description={t('channels.messages.empty.description')} />
        </div>
      ) : (
        <ul className="divide-y divide-line-hairline">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/inbox/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-raised/60" data-conversation={r.id}>
                <MessagesSquare className="size-4 shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.client?.name ?? t('channels.messages.noClient')}</span>
                  <span className="block truncate ts-label-meta text-text-muted" dir="auto">
                    {previewTypeKey(r.lastMessagePreview) ? t(previewTypeKey(r.lastMessagePreview)!) : (r.lastMessagePreview ?? '—')}
                  </span>
                </span>
                <span className="ts-label-meta shrink-0 text-text-muted">{r.lastMessageAt ? relativeTime(r.lastMessageAt, locale) : '—'}</span>
                {r.status === 'needs_human' ? (
                  <StatusPill enumKey="Conversation.status" value="needs_human" className="!rounded-[4px]">
                    {t('enum.Conversation.status.needs_human')}
                  </StatusPill>
                ) : r.aiPaused ? (
                  <Pill className="!rounded-[4px]">{t('enum.Conversation.aiPaused')}</Pill>
                ) : r.agent ? (
                  <Pill tone="success" className="!rounded-[4px]">
                    {t('enum.Conversation.author.ai')}
                  </Pill>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="px-4 pb-4 pt-3 ts-label-meta text-text-muted">{t('channels.messages.note')}</p>
    </Card>
  );
}
