'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  getPageInsights,
  getPageConversations,
  getPageMessages,
  getPageAISettings,
  updatePageAISettings as apiUpdateAISettings,
  sendReply as apiSendReply,
  type PageInsightsResponse,
  type ConversationsResponse,
  type MessagesResponse,
  type PageAISettings,
} from '@/lib/page-config-api';

interface PageConfigContextType {
  // State
  insights: PageInsightsResponse | null;
  conversations: ConversationsResponse | null;
  messages: MessagesResponse | null;
  aiSettings: PageAISettings | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchInsights: (pageId: string) => Promise<void>;
  fetchConversations: (pageId: string, params?: any) => Promise<void>;
  fetchMessages: (pageId: string, params?: any) => Promise<void>;
  fetchAISettings: (pageId: string) => Promise<void>;
  updateAISettings: (pageId: string, settings: Partial<PageAISettings>) => Promise<void>;
  sendReply: (conversationId: string, message: string) => Promise<void>;
  clearError: () => void;
}

const PageConfigContext = createContext<PageConfigContextType | undefined>(undefined);

export function PageConfigProvider({ children }: { children: ReactNode }) {
  const [insights, setInsights] = useState<PageInsightsResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationsResponse | null>(null);
  const [messages, setMessages] = useState<MessagesResponse | null>(null);
  const [aiSettings, setAISettings] = useState<PageAISettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async (pageId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPageInsights(pageId);
      setInsights(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch insights';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async (pageId: string, params?: any) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPageConversations(pageId, params);
      setConversations(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (pageId: string, params?: any) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPageMessages(pageId, params);
      setMessages(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch messages';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchAISettings = async (pageId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPageAISettings(pageId);
      setAISettings(data.settings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch AI settings';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateAISettings = async (pageId: string, settings: Partial<PageAISettings>) => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiUpdateAISettings(pageId, settings);
      setAISettings(data.settings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update AI settings';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async (conversationId: string, message: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiSendReply(conversationId, message);
      // Optionally refresh conversations after sending
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reply';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const value: PageConfigContextType = {
    insights,
    conversations,
    messages,
    aiSettings,
    loading,
    error,
    fetchInsights,
    fetchConversations,
    fetchMessages,
    fetchAISettings,
    updateAISettings,
    sendReply,
    clearError,
  };

  return <PageConfigContext.Provider value={value}>{children}</PageConfigContext.Provider>;
}

export function usePageConfig() {
  const context = useContext(PageConfigContext);
  if (context === undefined) {
    throw new Error('usePageConfig must be used within a PageConfigProvider');
  }
  return context;
}
