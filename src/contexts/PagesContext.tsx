'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getUserPages,
  connectFacebookPage as apiConnectFacebook,
  connectInstagramPage as apiConnectInstagram,
  disconnectPage as apiDisconnectPage,
  type Page,
} from '@/lib/pages-api';
import { useAuth } from './AuthContext';

interface PagesContextType {
  pages: Page[];
  loading: boolean;
  error: string | null;
  connectFacebookPage: () => Promise<void>;
  connectInstagramPage: () => Promise<void>;
  disconnectPage: (pageId: string) => Promise<void>;
  refreshPages: () => Promise<void>;
  clearError: () => void;
}

const PagesContext = createContext<PagesContextType | undefined>(undefined);

export function PagesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load pages when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshPages();
    }
  }, [isAuthenticated]);

  // Listen for OAuth popup messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'facebook-oauth-success') {
        console.log('Facebook OAuth success, refreshing pages...');
        refreshPages();
      } else if (event.data?.type === 'facebook-oauth-error') {
        console.error('Facebook OAuth error:', event.data.error);
        setError(event.data.error || 'Facebook connection failed');
      } else if (event.data?.type === 'instagram-oauth-success') {
        console.log('Instagram OAuth success, refreshing pages...');
        refreshPages();
      } else if (event.data?.type === 'instagram-oauth-error') {
        console.error('Instagram OAuth error:', event.data.error);
        setError(event.data.error || 'Instagram connection failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isAuthenticated]);

  const refreshPages = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);
      const response = await getUserPages();
      setPages(response.pages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load pages';
      setError(errorMessage);
      console.error('Error loading pages:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectFacebookPage = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiConnectFacebook();

      // Open Facebook OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        response.authUrl,
        'Facebook Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Also listen for popup close as fallback
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          // Refresh pages after popup closes (fallback if postMessage fails)
          setTimeout(() => refreshPages(), 500);
        }
      }, 500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect Facebook page';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const connectInstagramPage = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiConnectInstagram();

      // Open Instagram OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        response.authUrl,
        'Instagram Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Also listen for popup close as fallback
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setTimeout(() => refreshPages(), 500);
        }
      }, 500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect Instagram page';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const disconnectPage = async (pageId: string) => {
    try {
      setLoading(true);
      setError(null);

      await apiDisconnectPage(pageId);

      // Remove page from state
      setPages(pages.filter(p => p.id !== pageId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect page';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: PagesContextType = {
    pages,
    loading,
    error,
    connectFacebookPage,
    connectInstagramPage,
    disconnectPage,
    refreshPages,
    clearError,
  };

  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>;
}

export function usePages() {
  const context = useContext(PagesContext);
  if (context === undefined) {
    throw new Error('usePages must be used within a PagesProvider');
  }
  return context;
}
