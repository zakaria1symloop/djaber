import Link from 'next/link';

export default function DocsPage() {
  return (
    <main className="min-h-screen pt-20 overflow-x-hidden">
      <section className="relative py-16 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">Documentation</span>
            </h1>
            <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto px-4">
              Everything you need to get started with Djaber.ai
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-24 space-y-2">
                <h3 className="text-sm font-semibold text-white mb-4 px-4">Contents</h3>
                {[
                  'Getting Started',
                  'Connect Your Pages',
                  'Train Your AI',
                  'Manage Conversations',
                  'Analytics',
                  'API Reference'
                ].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                    className="block px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-12 min-w-0">
              <div id="getting-started" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Getting Started
                </h2>
                <div className="prose prose-invert max-w-none">
                  <p className="text-zinc-400 mb-6">
                    Welcome to Djaber.ai! This guide will help you set up your AI agent in minutes.
                  </p>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 mb-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Quick Setup</h4>
                    <ol className="space-y-4 text-zinc-400">
                      <li className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00fff0]/20 text-[#00fff0] flex items-center justify-center text-sm font-semibold">1</span>
                        <div>
                          <strong className="text-white">Create an account</strong>
                          <p className="text-sm mt-1">Sign up for free and verify your email</p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00fff0]/20 text-[#00fff0] flex items-center justify-center text-sm font-semibold">2</span>
                        <div>
                          <strong className="text-white">Connect your pages</strong>
                          <p className="text-sm mt-1">Link Facebook and Instagram via OAuth</p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00fff0]/20 text-[#00fff0] flex items-center justify-center text-sm font-semibold">3</span>
                        <div>
                          <strong className="text-white">Train your AI</strong>
                          <p className="text-sm mt-1">Upload FAQs and customize responses</p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              <div id="connect-your-pages" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Connect Your Pages
                </h2>
                <p className="text-zinc-400 mb-6">
                  Connecting your social media pages is simple and secure using OAuth authentication.
                </p>
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Facebook & Instagram</h4>
                  <ul className="space-y-3 text-zinc-400">
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-[#00fff0] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Navigate to Settings and click Connect Pages
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-[#00fff0] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Log in to Facebook and grant permissions
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-[#00fff0] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Select which pages you want to connect
                    </li>
                  </ul>
                </div>
              </div>

              <div id="train-your-ai" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Train Your AI
                </h2>
                <p className="text-zinc-400 mb-6">
                  Customize your AI to match your brand voice and product knowledge.
                </p>
                <div className="grid gap-6 mb-8">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">Brand Voice</h4>
                    <p className="text-zinc-400 text-sm mb-4">
                      Define how your AI should communicate - formal, casual, friendly, professional, etc.
                    </p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto">
                      <p className="text-xs text-zinc-500 mb-2">Example:</p>
                      <code className="text-[#00fff0] text-xs sm:text-sm block break-words">
                        &quot;Always be friendly and use casual language. Include emojis when appropriate.&quot;
                      </code>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">FAQ Library</h4>
                    <p className="text-zinc-400 text-sm mb-4">
                      Upload common questions and answers to help AI respond accurately.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <svg className="w-4 h-4 text-[#00fff0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Support CSV, JSON, or manual entry
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">Product Catalog</h4>
                    <p className="text-zinc-400 text-sm">
                      Import your products so AI can answer questions about pricing, availability, and features.
                    </p>
                  </div>
                </div>
              </div>

              <div id="manage-conversations" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Manage Conversations
                </h2>
                <p className="text-zinc-400 mb-6">
                  Monitor and manage all customer conversations from your dashboard.
                </p>

                <div className="space-y-6">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Real-time Monitoring</h4>
                    <p className="text-zinc-400 text-sm mb-4">
                      See all conversations as they happen across all connected pages.
                    </p>
                    <ul className="space-y-2 text-sm text-zinc-500">
                      <li className="flex items-start gap-2">
                        <span className="text-[#00fff0] mt-1">→</span>
                        Live message feed
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#00fff0] mt-1">→</span>
                        Filter by page, status, or sentiment
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#00fff0] mt-1">→</span>
                        Search conversation history
                      </li>
                    </ul>
                  </div>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Human Takeover</h4>
                    <p className="text-zinc-400 text-sm mb-4">
                      Step in anytime to handle conversations manually.
                    </p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4">
                      <p className="text-xs text-zinc-500 mb-2">When to take over:</p>
                      <ul className="text-xs sm:text-sm text-zinc-400 space-y-1">
                        <li>• Complex technical questions</li>
                        <li>• Upset or frustrated customers</li>
                        <li>• Custom pricing negotiations</li>
                        <li>• Refund or complaint handling</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div id="analytics" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Analytics
                </h2>
                <p className="text-zinc-400 mb-6">
                  Track performance metrics and gain insights into customer interactions.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">Key Metrics</h4>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-zinc-400">Response Time</span>
                        <span className="text-[#00fff0] font-semibold">Average</span>
                      </li>
                      <li className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-zinc-400">Resolution Rate</span>
                        <span className="text-[#00fff0] font-semibold">Percentage</span>
                      </li>
                      <li className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-zinc-400">Customer Satisfaction</span>
                        <span className="text-[#00fff0] font-semibold">CSAT Score</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-zinc-400">Messages Handled</span>
                        <span className="text-[#00fff0] font-semibold">Total Count</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">Sentiment Analysis</h4>
                    <p className="text-zinc-400 text-sm mb-4">
                      Understand customer emotions and satisfaction levels.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-zinc-400">Positive</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm text-zinc-400">Neutral</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm text-zinc-400">Negative</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div id="api-reference" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  API Reference
                </h2>
                <p className="text-zinc-400 mb-6">
                  Integrate Djaber.ai into your existing systems with our REST API.
                </p>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Authentication</h3>
                    <p className="text-zinc-400 text-sm mb-4">
                      All API requests require authentication using an API key in the header.
                    </p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6 overflow-x-auto">
                      <pre className="text-[#00fff0] text-xs sm:text-sm whitespace-pre-wrap break-all">
                        <code>{`Authorization: Bearer YOUR_API_KEY`}</code>
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Endpoints</h3>

                    <div className="space-y-6">
                      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Send Message</h4>
                            <code className="text-[#00fff0] text-xs sm:text-sm break-all">POST /api/v1/messages</code>
                          </div>
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-semibold self-start">POST</span>
                        </div>
                        <p className="text-zinc-400 text-sm mb-4">
                          Send a message to your AI agent programmatically.
                        </p>
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto">
                          <p className="text-xs text-zinc-500 mb-2">Request Body:</p>
                          <pre className="text-[#00fff0] text-xs whitespace-pre overflow-x-auto">
                            <code>{`{
  "page_id": "123456789",
  "recipient_id": "user_123",
  "message": "Hello, how can I help?"
}`}</code>
                          </pre>
                        </div>
                      </div>

                      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Get Conversations</h4>
                            <code className="text-[#00fff0] text-xs sm:text-sm break-all">GET /api/v1/conversations</code>
                          </div>
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-semibold self-start">GET</span>
                        </div>
                        <p className="text-zinc-400 text-sm mb-4">
                          Retrieve all conversations for a specific page.
                        </p>
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto">
                          <p className="text-xs text-zinc-500 mb-2">Query Parameters:</p>
                          <pre className="text-[#00fff0] text-xs whitespace-pre overflow-x-auto">
                            <code>{`page_id (required): string
limit (optional): number (default: 50)
offset (optional): number (default: 0)`}</code>
                          </pre>
                        </div>
                      </div>

                      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Update AI Training</h4>
                            <code className="text-[#00fff0] text-xs sm:text-sm break-all">PUT /api/v1/training</code>
                          </div>
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-semibold self-start">PUT</span>
                        </div>
                        <p className="text-zinc-400 text-sm mb-4">
                          Update your AI training data, FAQs, or brand voice.
                        </p>
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto">
                          <p className="text-xs text-zinc-500 mb-2">Request Body:</p>
                          <pre className="text-[#00fff0] text-xs whitespace-pre overflow-x-auto">
                            <code>{`{
  "page_id": "123456789",
  "brand_voice": "Friendly and casual",
  "faqs": [
    {
      "question": "What are your hours?",
      "answer": "We're open 9am-5pm Mon-Fri"
    }
  ]
}`}</code>
                          </pre>
                        </div>
                      </div>

                      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Get Analytics</h4>
                            <code className="text-[#00fff0] text-xs sm:text-sm break-all">GET /api/v1/analytics</code>
                          </div>
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-semibold self-start">GET</span>
                        </div>
                        <p className="text-zinc-400 text-sm mb-4">
                          Retrieve analytics and metrics for your pages.
                        </p>
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto">
                          <p className="text-xs text-zinc-500 mb-2">Response:</p>
                          <pre className="text-[#00fff0] text-xs whitespace-pre overflow-x-auto">
                            <code>{`{
  "total_messages": 1234,
  "avg_response_time": 0.8,
  "satisfaction_score": 4.5,
  "resolution_rate": 0.92
}`}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Rate Limits</h3>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                      <ul className="space-y-2 text-sm text-zinc-400">
                        <li className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-[#00fff0]"></span>
                          Standard: 100 requests per minute
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-[#00fff0]"></span>
                          Pro: 1,000 requests per minute
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-[#00fff0]"></span>
                          Enterprise: Custom limits
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Webhooks</h3>
                    <p className="text-zinc-400 text-sm mb-4">
                      Receive real-time notifications when events occur.
                    </p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Available Events:</h4>
                      <ul className="space-y-2 text-sm text-zinc-400">
                        <li className="flex items-start gap-3 flex-wrap">
                          <code className="text-[#00fff0] text-xs break-all">message.received</code>
                          <span className="text-xs sm:text-sm">New message from customer</span>
                        </li>
                        <li className="flex items-start gap-3 flex-wrap">
                          <code className="text-[#00fff0] text-xs break-all">message.sent</code>
                          <span className="text-xs sm:text-sm">AI sent a response</span>
                        </li>
                        <li className="flex items-start gap-3 flex-wrap">
                          <code className="text-[#00fff0] text-xs break-all">conversation.escalated</code>
                          <span className="text-xs sm:text-sm">Conversation needs human attention</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-white/5">
                <p className="text-zinc-400 text-center">
                  Need more help? <Link href="#" className="text-[#00fff0] hover:underline">Contact our support team</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
