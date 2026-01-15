'use client';

import { useEffect, useState } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';

interface Page {
  id: string;
  pageName: string;
  platform: string;
}

interface MessageHistorySectionProps {
  pageId: string;
  page: Page;
}

export default function MessageHistorySection({ pageId }: MessageHistorySectionProps) {
  const { messages, loading, error, fetchMessages, clearError } = usePageConfig();
  const [filters, setFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 50;

  useEffect(() => {
    loadMessages();
  }, [pageId, currentPage]);

  const loadMessages = async () => {
    try {
      const params: any = {
        limit: messagesPerPage,
        offset: (currentPage - 1) * messagesPerPage,
      };

      if (filters.type !== 'all') {
        params.type = filters.type;
      }
      if (filters.dateFrom) {
        params.dateFrom = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.dateTo = filters.dateTo;
      }

      await fetchMessages(pageId, params);
    } catch (err) {
      // Error handled by context
    }
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    loadMessages();
  };

  const handleClearFilters = () => {
    setFilters({
      type: 'all',
      dateFrom: '',
      dateTo: '',
    });
    setCurrentPage(1);
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = messages ? Math.ceil(messages.total / messagesPerPage) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          Message History
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          View all messages exchanged on this page
        </p>
      </div>

      {/* Filters */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Message Type Filter */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Message Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20"
            >
              <option value="all">All Messages</option>
              <option value="incoming">Incoming Only</option>
              <option value="outgoing">Outgoing Only</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Filter Actions */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-400 font-medium">Error Loading Messages</h3>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
              <button
                onClick={() => {
                  clearError();
                  loadMessages();
                }}
                className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Table */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Sender
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !messages && (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-4 py-3" colSpan={4}>
                        <div className="animate-pulse">
                          <div className="h-4 bg-white/10 rounded w-full"></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {messages?.messages.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-zinc-500 text-sm">No messages found</p>
                  </td>
                </tr>
              )}

              {messages?.messages.map((msg) => (
                <tr key={msg.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
                    {formatDateTime(msg.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {msg.senderName || msg.senderId.substring(0, 15) + '...'}
                  </td>
                  <td className="px-4 py-3">
                    {msg.isFromPage ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Outgoing
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                        </svg>
                        Incoming
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300 max-w-md truncate">
                    {msg.text || '(No text)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {messages && messages.total > messagesPerPage && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Showing {(currentPage - 1) * messagesPerPage + 1} to{' '}
              {Math.min(currentPage * messagesPerPage, messages.total)} of {messages.total} messages
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded text-white text-sm transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded text-white text-sm transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
