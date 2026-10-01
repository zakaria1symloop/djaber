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
import { getLang, translateFor } from '@/lib/i18n';

// Translated at call time rather than through a hook — see AuthContext.
const tr = (key: string) => translateFor(getLang(), key);

/** One page's outcome, as reported by the OAuth callback. */
export interface PageOutcome {
  pageId: string;
  pageName: string;
  status: 'connected' | 'warning' | 'skipped';
  code?: string;
  /** Already translated by the backend. */
  message?: string;
}

/**
 * What the last connect attempt actually did. The OAuth callback reports a
 * reason per page, so a page that could not be connected can be named with
 * its reason instead of failing silently.
 */
export interface ConnectReport {
  platform: 'facebook' | 'instagram';
  ok: boolean;
  connected: number;
  total: number;
  message?: string;
  results: PageOutcome[];
}

interface PagesContextType {
  pages: Page[];
  loading: boolean;
  error: string | null;
  connectReport: ConnectReport | null;
  connectFacebookPage: () => Promise<void>;
  connectInstagramPage: () => Promise<void>;
  disconnectPage: (pageId: string) => Promise<void>;
  refreshPages: () => Promise<void>;
  clearError: () => void;
  clearConnectReport: () => void;
}

const PagesContext = createContext<PagesContextType | undefined>(undefined);

export function PagesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectReport, setConnectReport] = useState<ConnectReport | null>(null);

  // Load pages when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshPages();
    }
  }, [isAuthenticated]);

  // Listen for OAuth popup messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      const type: unknown = data?.type;
      if (typeof type !== 'string' || !type.endsWith('-oauth-success') && !type.endsWith('-oauth-error')) return;

      const platform: 'facebook' | 'instagram' = type.startsWith('instagram') ? 'instagram' : 'facebook';
      const ok = type.endsWith('-oauth-success');
      const results: PageOutcome[] = Array.isArray(data?.results) ? data.results : [];

      setConnectReport({
        platform,
        ok,
        connected: typeof data?.connected === 'number' ? data.connected : results.filter((r) => r.status !== 'skipped').length,
        total: typeof data?.total === 'number' ? data.total : results.length,
        message: typeof data?.error === 'string' ? data.error : undefined,
        results,
      });

      if (ok) {
        refreshPages();
      } else {
        setError(data?.error || tr(platform === 'instagram' ? 'shell.err.igConnect' : 'shell.err.fbConnect'));
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
      const errorMessage = err instanceof Error ? err.message : tr('shell.err.loadPages');
      setError(errorMessage);
      console.error('Error loading pages:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open the OAuth window SYNCHRONOUSLY inside the click gesture so popup
  // blockers can't kill it (window.open after an await is treated as
  // non-user-initiated and silently blocked — this is what made Meta's
  // reviewer see a "dead" login button). Navigate it once the auth URL
  // arrives; if it was still blocked, fall back to a full-page redirect —
  // the OAuth callback detects the missing opener and routes back here.
  const openOAuthFlow = async (
    fetchAuthUrl: () => Promise<{ authUrl: string }>,
    windowName: string,
    fallbackErrorMessage: string
  ) => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      '',
      windowName,
      `width=${width},height=${height},left=${left},top=${top}`
    );
    if (popup) {
      try {
        popup.document.write(
          `<p style="font-family:sans-serif;padding:24px">${tr('shell.oauth.connecting')}</p>`
        );
      } catch {
        // cross-origin reuse of a previous window — ignore
      }
    }

    try {
      setLoading(true);
      setError(null);
      setConnectReport(null);

      const response = await fetchAuthUrl();

      if (popup && !popup.closed) {
        popup.location.href = response.authUrl;
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            // Refresh pages after popup closes (fallback if postMessage fails)
            setTimeout(() => refreshPages(), 500);
          }
        }, 500);
      } else {
        // Popup blocked → run the whole OAuth flow full-page
        window.location.href = response.authUrl;
      }
    } catch (err) {
      popup?.close();
      const errorMessage = err instanceof Error ? err.message : fallbackErrorMessage;
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const connectFacebookPage = () =>
    openOAuthFlow(apiConnectFacebook, 'facebook_oauth', tr('shell.err.connectFbPage'));

  const connectInstagramPage = () =>
    openOAuthFlow(apiConnectInstagram, 'instagram_oauth', tr('shell.err.connectIgPage'));

  const disconnectPage = async (pageId: string) => {
    try {
      setLoading(true);
      setError(null);

      await apiDisconnectPage(pageId);

      // Remove page from state
      setPages(pages.filter(p => p.id !== pageId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tr('shell.err.disconnectPage');
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const clearConnectReport = () => {
    setConnectReport(null);
  };

  const value: PagesContextType = {
    pages,
    loading,
    error,
    connectReport,
    connectFacebookPage,
    connectInstagramPage,
    disconnectPage,
    refreshPages,
    clearError,
    clearConnectReport,
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
