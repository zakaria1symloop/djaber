'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { pages, loading: pagesLoading, connectFacebookPage, disconnectPage, error: pagesError, clearError } = usePages();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleConnectFacebook = async () => {
    try {
      await connectFacebookPage();
    } catch (error) {
      console.error('Failed to connect Facebook:', error);
    }
  };

  const handleDisconnect = async (pageId: string) => {
    try {
      await disconnectPage(pageId);
      setShowDisconnectConfirm(null);
    } catch (error) {
      console.error('Failed to disconnect page:', error);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-xl text-zinc-400">
            Manage your social media pages and AI agents from here.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400">Connected Pages</h3>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{pages.length}</div>
            <p className="text-xs text-zinc-500">{pages.length === 0 ? 'No pages connected yet' : `${pages.length} page${pages.length > 1 ? 's' : ''} connected`}</p>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400">Active Conversations</h3>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0</div>
            <p className="text-xs text-zinc-500">No active conversations</p>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400">AI Responses (24h)</h3>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0</div>
            <p className="text-xs text-zinc-500">AI not active yet</p>
          </div>
        </div>

        {/* Connected Pages Section */}
        {pages.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Connected Pages
              </h2>
              <button
                onClick={handleConnectFacebook}
                disabled={pagesLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Page
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map((page) => (
                <div key={page.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{page.pageName}</h3>
                        <p className="text-xs text-zinc-500 capitalize">{page.platform}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                      Active
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/page/${page.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-xs transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Configure
                      </button>

                      <button
                        onClick={() => setShowDisconnectConfirm(page.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1.5"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Disconnect Confirmation */}
                  {showDisconnectConfirm === page.id && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-md mx-4">
                        <h3 className="text-xl font-bold text-white mb-2">Disconnect Page?</h3>
                        <p className="text-zinc-400 mb-6">
                          Are you sure you want to disconnect {page.pageName}? You won't receive messages anymore.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowDisconnectConfirm(null)}
                            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDisconnect(page.id)}
                            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-all"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Get Started Section - Show only if no pages */}
        {pages.length === 0 && (
          <div className="bg-gradient-to-br from-[#0a0a0a] to-black border border-white/10 rounded-3xl p-8 sm:p-12 mb-12">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Get Started with Djaber.ai
              </h2>
              <p className="text-lg text-zinc-400 mb-8">
                Connect your Facebook and Instagram pages to let AI handle your customer conversations 24/7.
              </p>

              {pagesError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{pagesError}</p>
                </div>
              )}

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Connect Your Social Media Pages</h3>
                    <p className="text-sm text-zinc-500">Link your Facebook and Instagram business pages with one click</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-400 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Configure Your AI Agent</h3>
                    <p className="text-sm text-zinc-500">Customize your AI's personality and response style</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Let AI Handle Conversations</h3>
                    <p className="text-sm text-zinc-500">Watch your AI respond to customers automatically</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnectFacebook}
                disabled={pagesLoading}
                className="btn-primary px-8 py-4 rounded-full font-semibold disabled:opacity-50"
              >
                <span>{pagesLoading ? 'Connecting...' : 'Connect Your First Page'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Account Info */}
        <div className="mt-12 bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            Account Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Name</p>
              <p className="text-white">{user?.firstName} {user?.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-1">Email</p>
              <p className="text-white">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-1">Plan</p>
              <p className="text-white capitalize">{user?.plan}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-1">Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
