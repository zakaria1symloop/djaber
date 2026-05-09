'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';
import {
  getConversationMessages,
  updateConversationStatus,
  syncPageFromFacebook,
} from '@/lib/page-config-api';
import type { ConversationSummary } from '@/lib/page-config-api';
import { RefreshIcon, ChatIcon, BotIcon, CheckCircleIcon, CloseIcon, SearchIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

interface MessagesSectionProps {
  pageId: string;
  page: { id: string; pageName: string; platform: string };
  // When true, the component renders without its own page-level header (inbox shortcut renders its own).
  hideHeader?: boolean;
  // Tells the layout to take the parent's available height instead of a fixed 68vh.
  fullHeight?: boolean;
}

interface ConversationMessage {
  id: string;
  text: string | null;
  timestamp: string;
  isFromPage: boolean;
  senderId: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}

type FilterTab = 'all' | 'active' | 'resolved' | 'archived';

const QUICK_REPLIES = ['Bonjour 👋', 'Merci pour votre message', 'Disponible, oui', 'Je vous envoie le détail'];

export default function MessagesSection({ pageId, page, hideHeader = false, fullHeight = false }: MessagesSectionProps) {
  const { conversations, loading, error, fetchConversations, sendReply, clearError } = usePageConfig();
  const toast = useToast();
  const [selectedConv, setSelectedConv] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
  }, [pageId]);

  const handleRefresh = async () => {
    if (syncing || loading) return;
    setSyncing(true);
    clearError();
    try {
      const result = await syncPageFromFacebook(pageId);
      if (result.newConversations + result.newMessages > 0) {
        toast.success(`Synced — ${result.newMessages} new message${result.newMessages === 1 ? '' : 's'}`);
      } else {
        toast.success('Up to date');
      }
      setLastSyncedAt(new Date());
    } catch (err: any) {
      toast.error(err?.message || 'Could not reach Facebook. Try again.');
    } finally {
      setSyncing(false);
      // Always re-pull from DB so the list reflects latest state
      fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
    }
  };

  const selectConversation = async (conv: ConversationSummary) => {
    setSelectedConv(conv);
    setMessages([]);
    setMessagesLoading(true);
    try {
      const res = await getConversationMessages(conv.id);
      setMessages(res.messages as any);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      if (conv.lastMessage) {
        setMessages([
          {
            id: 'last',
            text: conv.lastMessage.text,
            timestamp: conv.lastMessage.timestamp,
            isFromPage: conv.lastMessage.isFromPage,
            senderId: conv.senderId,
          },
        ]);
      }
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendReply = async (text?: string) => {
    const body = (text ?? replyText).trim();
    if (!selectedConv || !body || sending) return;
    try {
      setSending(true);
      await sendReply(selectedConv.id, body);
      setMessages((prev) => [
        ...prev,
        {
          id: `sent_${Date.now()}`,
          text: body,
          timestamp: new Date().toISOString(),
          isFromPage: true,
          senderId: 'page',
        },
      ]);
      setReplyText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
    } catch (err: any) {
      const fbMsg = err?.data?.message || err?.message;
      if (err?.data?.outsideWindow) {
        toast.error(fbMsg || 'Customer hasn\'t messaged in 24h — Facebook blocks new messages until they reply again.');
      } else {
        toast.error(fbMsg || 'Could not send message');
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 7 * 86400000) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredConversations = useMemo(() => {
    const list = conversations?.conversations || [];
    return list
      .filter((c) => (filterTab === 'all' ? true : c.status === filterTab))
      .filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (c.senderName || '').toLowerCase().includes(q) ||
          (c.lastMessage?.text || '').toLowerCase().includes(q)
        );
      });
  }, [conversations, filterTab, search]);

  const counts = useMemo(() => {
    const list = conversations?.conversations || [];
    return {
      all: list.length,
      active: list.filter((c) => c.status === 'active').length,
      resolved: list.filter((c) => c.status === 'resolved').length,
      archived: list.filter((c) => c.status === 'archived').length,
    };
  }, [conversations]);

  const isUnread = (c: ConversationSummary) => c.lastMessage && !c.lastMessage.isFromPage && c.status === 'active';

  return (
    <div className={fullHeight ? 'flex flex-col min-h-0 flex-1 gap-4' : 'space-y-4'}>
      {/* Header — hidden when used inside the Inbox shortcut (which provides its own chrome) */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Inbox
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {page.pageName} · {conversations?.total || 0} conversations
              {lastSyncedAt && <span className="ml-2 text-zinc-600">· last synced {formatTime(lastSyncedAt.toISOString())} ago</span>}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={syncing || loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-white hover:bg-zinc-100 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Pull the latest messages from Facebook"
          >
            <RefreshIcon className={`w-4 h-4 ${syncing || loading ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Facebook'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => {
              clearError();
              fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
            }}
            className="underline text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className={`flex gap-3 ${fullHeight ? 'flex-1 min-h-0' : 'h-[68vh] min-h-[480px]'}`}>
        {/* Conversation list */}
        <div className="w-[340px] flex-shrink-0 bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <SearchIcon className="w-4 h-4 text-zinc-500 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or message…"
                className="w-full ps-9 pe-3 py-2 bg-black/40 border border-white/10 focus:border-white/30 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
          </div>
          {/* Filter tabs */}
          <div className="px-2 pt-2 pb-1 flex items-center gap-1 border-b border-white/5">
            {(['all', 'active', 'resolved', 'archived'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${
                  filterTab === tab
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                {tab}
                <span className="ms-1 text-[9px] text-zinc-500">{counts[tab]}</span>
              </button>
            ))}
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && !conversations && (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            )}
            {filteredConversations.length === 0 && !loading && (
              <div className="p-8 text-center">
                <ChatIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-xs text-zinc-500 mb-3">
                  {search ? 'No matches' : conversations?.conversations.length === 0 ? 'No conversations yet' : 'Nothing in this view'}
                </p>
                {conversations?.conversations.length === 0 && !search && (
                  <button
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg"
                  >
                    <RefreshIcon className="w-3.5 h-3.5" />
                    Pull from Facebook
                  </button>
                )}
              </div>
            )}
            {filteredConversations.map((conv) => {
              const unread = isUnread(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full px-3 py-3 flex items-start gap-3 border-b border-white/5 text-left transition-colors ${
                    selectedConv?.id === conv.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold text-zinc-200">
                      {(conv.senderName || '?')[0].toUpperCase()}
                    </div>
                    {unread && (
                      <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${unread ? 'text-white font-semibold' : 'text-zinc-200 font-medium'}`}>
                        {conv.senderName || conv.senderId}
                      </p>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-zinc-600 flex-shrink-0 ms-2">
                          {formatTime(conv.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className={`text-[11px] truncate ${unread ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {conv.lastMessage.isFromPage && <span className="text-zinc-600">↗ </span>}
                        {conv.lastMessage.text || '(attachment)'}
                      </p>
                    )}
                    {conv.status !== 'active' && (
                      <span className="inline-block mt-1 text-[9px] uppercase tracking-wider text-zinc-600">
                        {conv.status}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden flex flex-col">
          {selectedConv ? (
            <>
              {/* Conv header */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/80 backdrop-blur">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold text-zinc-200 flex-shrink-0">
                    {(selectedConv.senderName || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{selectedConv.senderName || selectedConv.senderId}</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          selectedConv.status === 'active'
                            ? 'success'
                            : selectedConv.status === 'resolved'
                            ? 'info'
                            : 'default'
                        }
                        size="sm"
                      >
                        {selectedConv.status}
                      </Badge>
                      <span className="text-[10px] text-zinc-600">via {page.platform === 'instagram' ? 'Instagram' : 'Messenger'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedConv.status === 'active' && (
                    <button
                      onClick={async () => {
                        await updateConversationStatus(selectedConv.id, 'resolved');
                        toast.success('Marked as resolved');
                        fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-sm transition-colors"
                      title="Mark this conversation as resolved"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Mark resolved
                    </button>
                  )}
                  {selectedConv.status !== 'active' && (
                    <button
                      onClick={async () => {
                        await updateConversationStatus(selectedConv.id, 'active');
                        toast.success('Reopened');
                        fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                  {selectedConv.status !== 'archived' && (
                    <button
                      onClick={async () => {
                        await updateConversationStatus(selectedConv.id, 'archived');
                        toast.success('Archived');
                        setSelectedConv(null);
                        fetchConversations(pageId, { status: 'all', limit: 100 }).catch(() => {});
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Archive conversation"
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.02),transparent_60%)]">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 bg-white/5 rounded-lg animate-pulse"
                        style={{ width: `${40 + i * 15}%` }}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-8">No messages yet</p>
                ) : (
                  messages.map((msg: any, idx) => {
                    const prev = messages[idx - 1] as any;
                    const showAvatar = !prev || prev.isFromPage !== msg.isFromPage;
                    return (
                      <div key={msg.id} className={`flex ${msg.isFromPage ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}>
                        <div className={`max-w-[78%] flex flex-col ${msg.isFromPage ? 'items-end' : 'items-start'} gap-1`}>
                          {/* Image attachment */}
                          {msg.attachmentUrl &&
                            (msg.attachmentType === 'image' || msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) && (
                              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={msg.attachmentUrl}
                                  alt="attachment"
                                  className="max-w-full max-h-56 rounded-2xl border border-white/10 object-cover hover:opacity-90 transition-opacity"
                                />
                              </a>
                            )}
                          {/* Non-image attachment */}
                          {msg.attachmentUrl &&
                            msg.attachmentType &&
                            msg.attachmentType !== 'image' &&
                            !msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
                              <a
                                href={msg.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs text-blue-400 hover:text-blue-300"
                              >
                                <span>📎</span> {msg.attachmentType}
                              </a>
                            )}
                          {/* Text */}
                          {msg.text && (
                            <div
                              className={`px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                                msg.isFromPage
                                  ? 'bg-blue-500 text-white rounded-2xl rounded-br-md shadow-sm'
                                  : 'bg-white/[0.07] border border-white/10 text-zinc-100 rounded-2xl rounded-bl-md'
                              }`}
                            >
                              {msg.text}
                            </div>
                          )}
                          {!msg.text && !msg.attachmentUrl && (
                            <div className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-zinc-500 rounded-2xl italic">
                              (empty message)
                            </div>
                          )}
                          {showAvatar && (
                            <p className={`text-[10px] text-zinc-600 px-1 ${msg.isFromPage ? 'text-end' : ''}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {msg.isFromPage && (
                                <span className="ms-1.5 inline-flex items-center gap-1">
                                  <BotIcon className="w-3 h-3 inline text-zinc-500" />
                                  {msg.id?.startsWith?.('sent_') ? 'You' : 'AI'}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              {selectedConv.status === 'active' && (
                <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-white/5">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => handleSendReply(qr)}
                      disabled={sending}
                      className="px-2.5 py-1 text-[11px] text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors disabled:opacity-40"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* Reply input */}
              <div className="px-3 py-3 border-t border-white/5 bg-zinc-950/40">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder="Type your reply… (Shift+Enter for new line)"
                    rows={1}
                    className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 focus:border-white/30 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none resize-none max-h-32"
                    disabled={sending || selectedConv.status !== 'active'}
                  />
                  <button
                    onClick={() => handleSendReply()}
                    disabled={!replyText.trim() || sending || selectedConv.status !== 'active'}
                    className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                {selectedConv.status !== 'active' && (
                  <p className="text-[10px] text-zinc-600 mt-2 text-center">
                    Reopen this conversation to reply.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ChatIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500 mb-1">Select a conversation</p>
                <p className="text-xs text-zinc-600">
                  Or hit <span className="text-zinc-400">Sync from Facebook</span> to pull the latest.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
