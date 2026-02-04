'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import {
  Button,
  Card,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  EmptyState,
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
  PlusIcon,
  SettingsIcon,
  CloseIcon,
  ChatIcon,
  ChartIcon,
  ClockIcon,
  BoltIcon,
  GlobeIcon,
  MessageIcon,
  BoxIcon,
} from '@/components/ui';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-white">Loading...</div>}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { pages, loading: pagesLoading, connectFacebookPage, disconnectPage } = usePages();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState('all');

  const activeSection = searchParams.get('section') || 'overview';

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

  const filteredPages = activePlatformTab === 'all'
    ? pages
    : pages.filter(page => page.platform === activePlatformTab);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <FacebookIcon className="w-6 h-6 text-[#1877F2]" />;
      case 'instagram':
        return <InstagramIcon className="w-6 h-6 text-[#E4405F]" />;
      case 'whatsapp':
        return <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />;
      default:
        return <ChatIcon className="w-6 h-6" />;
    }
  };

  return (
    <>
      {/* Overview Section */}
      {activeSection === 'overview' && (
        <>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Connected Pages</h3>
                <ChatIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{pages.length}</div>
              <p className="text-xs text-zinc-500">{pages.length === 0 ? 'No pages connected yet' : `${pages.length} page${pages.length > 1 ? 's' : ''} connected`}</p>
            </Card>

            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Active Conversations</h3>
                <MessageIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0</div>
              <p className="text-xs text-zinc-500">No active conversations</p>
            </Card>

            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">AI Responses (24h)</h3>
                <BoltIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0</div>
              <p className="text-xs text-zinc-500">AI not active yet</p>
            </Card>

            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Total Reach</h3>
                <GlobeIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0</div>
              <p className="text-xs text-zinc-500">Connect pages to see reach</p>
            </Card>
          </div>

          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
              Recent Activity
            </h2>
            <Card>
              <EmptyState
                icon={<ClockIcon className="w-16 h-16" />}
                title="No recent activity"
                description="Your recent conversations and AI responses will appear here"
              />
            </Card>
          </div>
        </>
      )}

      {/* Pages Section */}
      {activeSection === 'pages' && (
        <>
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Social Media
                </h1>
                <p className="text-zinc-400">Manage all your connected social media pages and platforms</p>
              </div>
              <Button
                onClick={handleConnectFacebook}
                loading={pagesLoading}
                icon={<PlusIcon className="w-4 h-4" />}
              >
                Connect New Page
              </Button>
            </div>
          </div>

          <Tabs defaultValue="all" value={activePlatformTab} onValueChange={setActivePlatformTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Platforms</TabsTrigger>
              <TabsTrigger value="facebook" icon={<FacebookIcon className="w-4 h-4" />}>Facebook</TabsTrigger>
              <TabsTrigger value="instagram" icon={<InstagramIcon className="w-4 h-4" />}>Instagram</TabsTrigger>
              <TabsTrigger value="whatsapp" icon={<WhatsAppIcon className="w-4 h-4" />}>WhatsApp</TabsTrigger>
            </TabsList>

            <TabsContent value={activePlatformTab}>
              {filteredPages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPages.map((page) => (
                    <Card key={page.id} variant="interactive">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                            {getPlatformIcon(page.platform)}
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{page.pageName}</h3>
                            <p className="text-xs text-zinc-500 capitalize">{page.platform}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Status</span>
                          <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Connected</span>
                          <span className="text-white">{new Date(page.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">AI Agent</span>
                          <Badge variant="success">Active</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(`/dashboard/page/${page.id}`)}
                          icon={<SettingsIcon className="w-4 h-4" />}
                        >
                          Configure
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/page/${page.id}/stock`)}
                          icon={<BoxIcon className="w-4 h-4" />}
                        >
                          Stock
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDisconnectConfirm(page.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <CloseIcon className="w-4 h-4" />
                        </Button>
                      </div>

                      {showDisconnectConfirm === page.id && (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                          <Card className="max-w-md mx-4">
                            <h3 className="text-xl font-bold text-white mb-2">Disconnect Page?</h3>
                            <p className="text-zinc-400 mb-6">
                              Are you sure you want to disconnect {page.pageName}? You won't receive messages anymore.
                            </p>
                            <div className="flex gap-3">
                              <Button variant="outline" className="flex-1" onClick={() => setShowDisconnectConfirm(null)}>Cancel</Button>
                              <Button variant="danger" className="flex-1" onClick={() => handleDisconnect(page.id)}>Disconnect</Button>
                            </div>
                          </Card>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<ChatIcon className="w-20 h-20" />}
                    title={activePlatformTab === 'all' ? 'No Pages Connected' : `No ${activePlatformTab.charAt(0).toUpperCase() + activePlatformTab.slice(1)} Pages`}
                    description={
                      activePlatformTab === 'all'
                        ? 'Connect your social media pages to start managing them with AI'
                        : `Connect your ${activePlatformTab.charAt(0).toUpperCase() + activePlatformTab.slice(1)} pages to get started`
                    }
                    action={
                      <Button onClick={handleConnectFacebook} loading={pagesLoading} icon={<PlusIcon className="w-4 h-4" />}>
                        Connect Your First Page
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Analytics Section */}
      {activeSection === 'analytics' && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
            <p className="text-zinc-400">Track performance across all your pages</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Total Messages</h3>
                <MessageIcon className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0</div>
              <p className="text-xs text-zinc-500">+0% from last week</p>
            </Card>
            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">AI Response Rate</h3>
                <ChartIcon className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>0%</div>
              <p className="text-xs text-zinc-500">No data yet</p>
            </Card>
            <Card variant="interactive">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Avg Response Time</h3>
                <ClockIcon className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>--</div>
              <p className="text-xs text-zinc-500">No data yet</p>
            </Card>
          </div>

          <Card>
            <EmptyState
              icon={<ChartIcon className="w-20 h-20" />}
              title="Analytics Coming Soon"
              description="Connect your pages and start using the AI to see detailed analytics about performance, engagement, and customer interactions."
            />
          </Card>
        </>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Settings</h1>
            <p className="text-zinc-400">Manage your account and application settings</p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Account Information</h2>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="First Name" value={user?.firstName || ''} disabled />
                  <Input label="Last Name" value={user?.lastName || ''} disabled />
                  <div className="md:col-span-2">
                    <Input label="Email" type="email" value={user?.email || ''} disabled />
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Plan & Billing</h2>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-semibold mb-1">Current Plan</p>
                    <p className="text-zinc-400 text-sm">You are on the <span className="text-white capitalize">{user?.plan || 'Free'}</span> plan</p>
                  </div>
                  <Badge variant="info" size="md">{user?.plan || 'Free'}</Badge>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400 text-sm">Pages Limit</span>
                    <span className="text-white text-sm">{pages.length} / 10</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
                    <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${(pages.length / 10) * 100}%` }} />
                  </div>
                  <Button className="w-full">Upgrade Plan</Button>
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Facebook API Permissions</h2>
              <Card>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-semibold mb-2">Currently Active Permissions</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">pages_show_list</Badge>
                      <Badge variant="success">pages_manage_metadata</Badge>
                      <Badge variant="success">pages_messaging</Badge>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <h3 className="text-white font-semibold mb-2">Available Advanced Permissions</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="info">pages_read_engagement</Badge>
                      <Badge variant="info">pages_read_user_content</Badge>
                      <Badge variant="info">pages_manage_posts</Badge>
                      <Badge variant="info">pages_manage_engagement</Badge>
                      <Badge variant="info">read_insights</Badge>
                    </div>
                    <p className="text-sm text-zinc-400">These permissions require Facebook App Review approval.</p>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-bold text-red-400 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Danger Zone</h2>
              <Card className="border-red-500/20 bg-red-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-red-400 font-semibold mb-1">Delete Account</h3>
                    <p className="text-red-300/80 text-sm">Permanently delete your account and all associated data.</p>
                  </div>
                  <Button variant="danger">Delete Account</Button>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
