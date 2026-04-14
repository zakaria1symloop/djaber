'use client';

import { useEffect, useState, useRef } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';
import { getConversationMessages } from '@/lib/page-config-api';
import type { ConversationSummary } from '@/lib/page-config-api';
import { RefreshIcon, ChatIcon, BotIcon } from '@/components/ui/icons';

interface MessagesSectionProps {
  pageId: string;
  page: { id: string; pageName: string; platform: string };
}

interface ConversationMessage {
  id: string;
  text: string | null;
  timestamp: string;
  isFromPage: boolean;
  senderId: string;
}

export default function MessagesSection({ pageId }: MessagesSectionProps) {
  const { conversations, loading, error, fetchConversations, sendReply, clearError } = usePageConfig();
  const [selectedConv, setSelectedConv] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations(pageId).catch(() => {});
  }, [pageId]);

  // Load full thread when conversation is selected
  const selectConversation = async (conv: ConversationSummary) => {
    setSelectedConv(conv);
    setMessages([]);
    setMessagesLoading(true);
    try {
      const res = await getConversationMessages(conv.id);
      setMessages(res.messages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      // Fall back to just showing last message
      if (conv.lastMessage) {
        setMessages([{
          id: 'last',
          text: conv.lastMessage.text,
          timestamp: conv.lastMessage.timestamp,
          isFromPage: conv.lastMessage.isFromPage,
          senderId: conv.senderId,
        }]);
      }
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedConv || !replyText.trim() || sending) return;
    try {
      setSending(true);
      await sendReply(selectedConv.id, replyText.trim());
      // Add to local messages immediately
      setMessages((prev) => [
        ...prev,
        { id: `sent_${Date.now()}`, text: replyText.trim(), timestamp: new Date().toISOString(), isFromPage: true, senderId: 'page' },
      ]);
      setReplyText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      // Refresh conversation list in background
      fetchConversations(pageId).catch(() => {});
    } catch {
      // Error via context
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Messages</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{conversations?.total || 0} conversations</p>
        </div>
        <button
          onClick={() => fetchConversations(pageId).catch(() => {})}
          disabled={loading}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => { clearError(); fetchConversations(pageId).catch(() => {}); }} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-3 h-[65vh] min-h-[400px]">
        {/* Conversation list */}
        <div className="w-80 flex-shrink-0 bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && !conversations && (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />)}
              </div>
            )}
            {conversations?.conversations.length === 0 && !loading && (
              <div className="p-6 text-center">
                <ChatIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No conversations yet</p>
              </div>
            )}
            {conversations?.conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full px-3 py-3 flex items-start gap-3 border-b border-white/5 text-left transition-colors ${
                  selectedConv?.id === conv.id ? 'bg-white/5' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-zinc-300 flex-shrink-0">
                  {(conv.senderName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm text-white truncate font-medium">{conv.senderName || conv.senderId}</p>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-2">{formatTime(conv.lastMessage.timestamp)}</span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-[11px] text-zinc-500 truncate">
                      {conv.lastMessage.isFromPage && '↗ '}{conv.lastMessage.text || '(attachment)'}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden flex flex-col">
          {selectedConv ? (
            <>
              {/* Conv header */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-zinc-300">
                  {(selectedConv.senderName || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{selectedConv.senderName || selectedConv.senderId}</p>
                  <p className="text-[10px] text-zinc-500 capitalize">{selectedConv.status}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" style={{ width: `${40 + i * 15}%` }} />)}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-8">No messages</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isFromPage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%]`}>
                        <div className={`px-3.5 py-2 rounded-2xl text-sm ${
                          msg.isFromPage
                            ? 'bg-white text-black rounded-br-sm'
                            : 'bg-white/5 border border-white/10 text-zinc-100 rounded-bl-sm'
                        }`}>
                          {msg.text || '(attachment)'}
                        </div>
                        <p className={`text-[10px] text-zinc-600 mt-1 px-1 ${msg.isFromPage ? 'text-right' : ''}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.isFromPage && (
                            <span className="ml-1.5 text-zinc-500">
                              <BotIcon className="w-3 h-3 inline" />
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="px-4 py-3 border-t border-white/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                    placeholder="Type a reply…"
                    className="flex-1 px-3.5 py-2 bg-black/40 border border-white/10 focus:border-white/30 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2 bg-white text-black rounded-xl text-xs font-semibold hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ChatIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
