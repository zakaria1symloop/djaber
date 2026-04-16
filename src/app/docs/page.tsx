'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

export default function DocsPage() {
  const { t, dir } = useTranslation();

  const navItems = [
    { id: 'getting-started', label: t('docs.nav.start') },
    { id: 'connect-your-pages', label: t('docs.nav.connect') },
    { id: 'train-your-ai', label: t('docs.nav.train') },
    { id: 'manage-conversations', label: t('docs.nav.manage') },
    { id: 'analytics', label: t('docs.nav.analytics') },
    { id: 'api-reference', label: t('docs.nav.api') },
  ];

  return (
    <main className="min-h-screen pt-28 overflow-x-hidden" dir={dir}>
      <section className="relative py-16 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">{t('docs.title')}</span>
            </h1>
            <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto px-4">
              {t('docs.subtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-24 space-y-2">
                <h3 className="text-sm font-semibold text-white mb-4 px-4">{t('docs.contents')}</h3>
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-12 min-w-0">
              <div id="getting-started" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('docs.nav.start')}
                </h2>
                <div className="prose prose-invert max-w-none">
                  <p className="text-zinc-400 mb-6">{t('docs.start.intro')}</p>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 mb-6">
                    <h4 className="text-lg font-semibold text-white mb-4">{t('docs.start.quickSetup')}</h4>
                    <ol className="space-y-4 text-zinc-400">
                      {(['s1', 's2', 's3'] as const).map((k, i) => (
                        <li key={k} className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00fff0]/20 text-[#00fff0] flex items-center justify-center text-sm font-semibold">{i + 1}</span>
                          <div>
                            <strong className="text-white">{t(`docs.start.${k}.title`)}</strong>
                            <p className="text-sm mt-1">{t(`docs.start.${k}.desc`)}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              <div id="connect-your-pages" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('docs.nav.connect')}
                </h2>
                <p className="text-zinc-400 mb-6">{t('docs.connect.intro')}</p>
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">{t('docs.connect.fb')}</h4>
                  <ul className="space-y-3 text-zinc-400">
                    {(['step1', 'step2', 'step3'] as const).map((k) => (
                      <li key={k} className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-[#00fff0] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t(`docs.connect.${k}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div id="train-your-ai" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('docs.nav.train')}
                </h2>
                <p className="text-zinc-400 mb-6">{t('docs.train.intro')}</p>
                <div className="grid gap-6 mb-8">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">{t('docs.train.voice.title')}</h4>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.train.voice.desc')}</p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto">
                      <p className="text-xs text-zinc-500 mb-2">{t('docs.train.voice.example')}</p>
                      <code className="text-[#00fff0] text-xs sm:text-sm block break-words">
                        &quot;{t('docs.train.voice.sample')}&quot;
                      </code>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">{t('docs.train.faq.title')}</h4>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.train.faq.desc')}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <svg className="w-4 h-4 text-[#00fff0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('docs.train.faq.formats')}
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">{t('docs.train.catalog.title')}</h4>
                    <p className="text-zinc-400 text-sm">{t('docs.train.catalog.desc')}</p>
                  </div>
                </div>
              </div>

              <div id="manage-conversations" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('docs.nav.manage')}
                </h2>
                <p className="text-zinc-400 mb-6">{t('docs.manage.intro')}</p>

                <div className="space-y-6">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">{t('docs.manage.realtime.title')}</h4>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.manage.realtime.desc')}</p>
                    <ul className="space-y-2 text-sm text-zinc-500">
                      {(['i1', 'i2', 'i3'] as const).map((k) => (
                        <li key={k} className="flex items-start gap-2">
                          <span className="text-[#00fff0] mt-1">→</span>
                          {t(`docs.manage.realtime.${k}`)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">{t('docs.manage.human.title')}</h4>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.manage.human.desc')}</p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4">
                      <p className="text-xs text-zinc-500 mb-2">{t('docs.manage.human.when')}</p>
                      <ul className="text-xs sm:text-sm text-zinc-400 space-y-1">
                        {(['i1', 'i2', 'i3', 'i4'] as const).map((k) => (
                          <li key={k}>• {t(`docs.manage.human.${k}`)}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div id="analytics" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('docs.nav.analytics')}
                </h2>
                <p className="text-zinc-400 mb-6">{t('docs.analytics.intro')}</p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">{t('docs.analytics.metrics.title')}</h4>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-zinc-400">{t('docs.analytics.metrics.responseTime')}</span>
                        <span className="text-[#00fff0] font-semibold">{t('docs.analytics.metrics.average')}</span>
                      </li>
                      <li className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-zinc-400">{t('docs.analytics.metrics.resolutionRate')}</span>
                        <span className="text-[#00fff0] font-semibold">{t('docs.analytics.metrics.percentage')}</span>
                      </li>
                      <li className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-zinc-400">{t('docs.analytics.metrics.csat')}</span>
                        <span className="text-[#00fff0] font-semibold">{t('docs.analytics.metrics.csatScore')}</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-zinc-400">{t('docs.analytics.metrics.messages')}</span>
                        <span className="text-[#00fff0] font-semibold">{t('docs.analytics.metrics.total')}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                    <h4 className="text-lg font-semibold text-white mb-3">{t('docs.analytics.sentiment.title')}</h4>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.analytics.sentiment.desc')}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-zinc-400">{t('docs.analytics.sentiment.positive')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm text-zinc-400">{t('docs.analytics.sentiment.neutral')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm text-zinc-400">{t('docs.analytics.sentiment.negative')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div id="api-reference" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {t('docs.nav.api')}
                </h2>
                <p className="text-zinc-400 mb-6">{t('docs.api.intro')}</p>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{t('docs.api.auth.title')}</h3>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.api.auth.desc')}</p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6 overflow-x-auto" dir="ltr">
                      <pre className="text-[#00fff0] text-xs sm:text-sm whitespace-pre-wrap break-all">
                        <code>{`Authorization: Bearer YOUR_API_KEY`}</code>
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{t('docs.api.endpoints.title')}</h3>

                    <div className="space-y-6">
                      {[
                        { id: 'send', method: 'POST', path: '/api/v1/messages', badge: 'bg-green-500/20 text-green-400', body: `{\n  "page_id": "123456789",\n  "recipient_id": "user_123",\n  "message": "Hello, how can I help?"\n}`, bodyLabel: t('docs.api.endpoints.send.body') },
                        { id: 'get', method: 'GET', path: '/api/v1/conversations', badge: 'bg-blue-500/20 text-blue-400', body: `page_id (required): string\nlimit (optional): number (default: 50)\noffset (optional): number (default: 0)`, bodyLabel: t('docs.api.endpoints.get.params') },
                        { id: 'put', method: 'PUT', path: '/api/v1/training', badge: 'bg-yellow-500/20 text-yellow-400', body: `{\n  "page_id": "123456789",\n  "brand_voice": "Friendly and casual",\n  "faqs": [\n    {\n      "question": "What are your hours?",\n      "answer": "We're open 9am-5pm Mon-Fri"\n    }\n  ]\n}`, bodyLabel: t('docs.api.endpoints.send.body') },
                        { id: 'analytics', method: 'GET', path: '/api/v1/analytics', badge: 'bg-blue-500/20 text-blue-400', body: `{\n  "total_messages": 1234,\n  "avg_response_time": 0.8,\n  "satisfaction_score": 4.5,\n  "resolution_rate": 0.92\n}`, bodyLabel: t('docs.api.endpoints.analytics.response') },
                      ].map((ep) => (
                        <div key={ep.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-base sm:text-lg font-semibold text-white mb-2">
                                {t(`docs.api.endpoints.${ep.id}.title`)}
                              </h4>
                              <code className="text-[#00fff0] text-xs sm:text-sm break-all" dir="ltr">
                                {ep.method} {ep.path}
                              </code>
                            </div>
                            <span className={`px-3 py-1 text-xs rounded-full font-semibold self-start ${ep.badge}`}>
                              {ep.method}
                            </span>
                          </div>
                          <p className="text-zinc-400 text-sm mb-4">{t(`docs.api.endpoints.${ep.id}.desc`)}</p>
                          <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 sm:p-4 overflow-x-auto" dir="ltr">
                            <p className="text-xs text-zinc-500 mb-2">{ep.bodyLabel}</p>
                            <pre className="text-[#00fff0] text-xs whitespace-pre overflow-x-auto">
                              <code>{ep.body}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{t('docs.api.limits.title')}</h3>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                      <ul className="space-y-2 text-sm text-zinc-400">
                        {(['standard', 'pro', 'enterprise'] as const).map((k) => (
                          <li key={k} className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-[#00fff0]"></span>
                            {t(`docs.api.limits.${k}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{t('docs.api.webhooks.title')}</h3>
                    <p className="text-zinc-400 text-sm mb-4">{t('docs.api.webhooks.desc')}</p>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 sm:p-6">
                      <h4 className="text-sm font-semibold text-white mb-3">{t('docs.api.webhooks.available')}</h4>
                      <ul className="space-y-2 text-sm text-zinc-400">
                        {([
                          { code: 'message.received', key: 'received' },
                          { code: 'message.sent', key: 'sent' },
                          { code: 'conversation.escalated', key: 'escalated' },
                        ] as const).map((ev) => (
                          <li key={ev.code} className="flex items-start gap-3 flex-wrap">
                            <code className="text-[#00fff0] text-xs break-all" dir="ltr">{ev.code}</code>
                            <span className="text-xs sm:text-sm">{t(`docs.api.webhooks.${ev.key}`)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-white/5">
                <p className="text-zinc-400 text-center">
                  {t('docs.moreHelp')}{' '}
                  <Link href="/help" className="text-[#00fff0] hover:underline">{t('docs.contactSupport')}</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
