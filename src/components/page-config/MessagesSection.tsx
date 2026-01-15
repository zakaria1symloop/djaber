'use client';

import { useEffect, useState, useRef } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';
import type { ConversationSummary } from '@/lib/page-config-api';

interface Page {
  id: string;
  pageName: string;
  platform: string;
}

interface MessagesSectionProps {
  pageId: string;
  page: Page;
}

export default function MessagesSection({ pageId }: MessagesSectionProps) {
  const { conversations, loading, error, fetchConversations, sendReply, clearError } = usePageConfig();
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [pageId]);

  const loadConversations = async () => {
    try {
      await fetchConversations(pageId);
    } catch (err) {
      // Error handled by context
    }
  };

  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || sending) return;

    try {
      setSending(true);
      await sendReply(selectedConversation.id, replyText.trim());
      setReplyText('');
      // Refresh conversations to show new message
      await loadConversations();
    } catch (err) {
      // Error handled by context
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          Messages
        </h2>
        <button
          onClick={loadConversations}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-400 font-medium">Error Loading Conversations</h3>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
              <button
                onClick={() => {
                  clearError();
                  loadConversations();
                }}
                className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        {/* Conversation List */}
        <div className="lg:col-span-1 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">Conversations</h3>
            <p className="text-xs text-zinc-500 mt-1">
              {conversations?.total || 0} total
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && !conversations && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-white/10 rounded w-24 mb-2"></div>
                        <div className="h-3 bg-white/10 rounded w-32"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {conversations?.conversations.length === 0 && !loading && (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-zinc-500 text-sm">No conversations yet</p>
              </div>
            )}

            {conversations?.conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors border-b border-white/5 text-left ${
                  selectedConversation?.id === conv.id ? 'bg-white/5' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-medium">
                    {conv.senderName ? conv.senderName[0].toUpperCase() : 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-white text-sm font-medium truncate">
                      {conv.senderName || conv.senderId}
                    </p>
                    {conv.lastMessage && (
                      <span className="text-xs text-zinc-500 flex-shrink-0 ml-2">
                        {formatTime(conv.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-zinc-400 text-xs truncate">
                      {conv.lastMessage.isFromPage && '↗ '}
                      {conv.lastMessage.text || '(No text)'}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {selectedConversation.senderName ? selectedConversation.senderName[0].toUpperCase() : 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">
                    {selectedConversation.senderName || selectedConversation.senderId}
                  </h3>
                  <p className="text-xs text-zinc-500 capitalize">{selectedConversation.status}</p>
                </div>
              </div>

              {/* Messages (simplified - showing last message only) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedConversation.lastMessage && (
                  <div className={`flex ${selectedConversation.lastMessage.isFromPage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        selectedConversation.lastMessage.isFromPage
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      <p className="text-sm">{selectedConversation.lastMessage.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatTime(selectedConversation.lastMessage.timestamp)}
                      </p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/20"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <svg className="w-16 h-16 text-zinc-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-zinc-500">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
