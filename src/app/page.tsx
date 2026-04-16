'use client';

import Link from 'next/link';
import AnimatedDashboard from '@/components/AnimatedDashboard';
import PricingSection from '@/components/PricingSection';
import AnimatedSlogan from '@/components/AnimatedSlogan';
import { useTranslation } from '@/contexts/LanguageContext';

export default function Home() {
  const { t, dir } = useTranslation();

  return (
    <main className="min-h-screen" dir={dir}>
      <section className="relative pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00fff0] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00fff0]"></span>
              </span>
              <span className="text-sm text-zinc-400">{t('home.hero.badge')}</span>
            </div>

            <h1
              className="animate-fade-in-delay-1 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="text-white">{t('home.hero.title.top')}</span>
              <br />
              <span className="gradient-text">{t('home.hero.title.highlight')}</span>
            </h1>

            <div
              className="animate-fade-in-delay-2 text-2xl sm:text-3xl lg:text-4xl mb-8 h-[1.5em]"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <AnimatedSlogan />
            </div>

            <p className="animate-fade-in-delay-2 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              {t('home.hero.subtitle')}
            </p>

            <div className="animate-fade-in-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="btn-primary px-8 py-4 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 group"
              >
                <span>{t('home.hero.cta.primary')}</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${
                    dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="#demo"
                className="btn-glow px-8 py-4 rounded-full text-base font-medium text-white inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-[#00fff0]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {t('home.hero.cta.secondary')}
              </Link>
            </div>
          </div>

          <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { value: '10K+', label: t('home.stats.messages') },
              { value: '500+', label: t('home.stats.pages') },
              { value: '99.9%', label: t('home.stats.uptime') },
              { value: '<1s', label: t('home.stats.response') },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-6 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-white/20 transition-colors duration-300"
              >
                <div
                  className="text-3xl sm:text-4xl font-bold text-white mb-2"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <AnimatedDashboard />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">{t('home.features.title')}</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              {t('home.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                key: 'f1',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
              },
              {
                key: 'f2',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                ),
              },
              {
                key: 'f3',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
              },
              {
                key: 'f4',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                key: 'f5',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                ),
              },
              {
                key: 'f6',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div
                key={feature.key}
                className="group relative p-8 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-white/30 transition-all duration-300 hover:bg-[#141414]"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00fff0]/5 to-[#a855f7]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00fff0]/20 to-[#a855f7]/20 flex items-center justify-center mb-6 text-[#00fff0] group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-3"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {t(`home.features.${feature.key}.title`)}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {t(`home.features.${feature.key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {t('home.how.title')} <span className="gradient-text">{t('home.how.titleHighlight')}</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              {t('home.how.subtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            {[
              { key: 's1', step: '01', color: 'from-[#00fff0] to-[#3b82f6]' },
              { key: 's2', step: '02', color: 'from-[#3b82f6] to-[#a855f7]' },
              { key: 's3', step: '03', color: 'from-[#a855f7] to-[#00fff0]' },
            ].map((item, index) => (
              <div key={item.key} className="relative">
                <div className="text-center">
                  <div
                    className={`inline-block text-8xl font-bold mb-6 bg-gradient-to-br ${item.color} bg-clip-text text-transparent opacity-20`}
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {item.step}
                  </div>
                  <h3
                    className="text-2xl font-bold text-white mb-4"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {t(`home.how.${item.key}.title`)}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {t(`home.how.${item.key}.desc`)}
                  </p>
                </div>
                {index < 2 && (
                  <div
                    className={`hidden lg:block absolute top-20 w-12 h-px bg-gradient-to-r from-[#00fff0]/50 to-transparent ${
                      dir === 'rtl' ? '-left-6 rotate-180' : '-right-6'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {t('home.pricing.title')} <span className="gradient-text">{t('home.pricing.titleHighlight')}</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              {t('home.pricing.subtitle')}
            </p>
          </div>

          <PricingSection />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00fff0]/10 to-[#a855f7]/10" />
            <div className="relative">
              <h2
                className="text-4xl sm:text-5xl font-bold mb-6"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {t('home.cta.title.top')}{' '}
                <span className="gradient-text">{t('home.cta.title.highlight')}</span>{' '}
                {t('home.cta.title.bottom')}
              </h2>
              <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto">
                {t('home.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="btn-primary px-8 py-4 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 group"
                >
                  <span>{t('home.cta.primary')}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${
                      dir === 'rtl' ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  href="/contact"
                  className="btn-glow px-8 py-4 rounded-full text-base font-medium text-white inline-flex items-center justify-center"
                >
                  {t('home.cta.secondary')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="logo-glow">
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="url(#footerLogoGradient)" strokeWidth="1.5" fill="none" />
                    <circle cx="20" cy="12" r="3" fill="#00fff0" />
                    <circle cx="12" cy="24" r="3" fill="#00fff0" />
                    <circle cx="28" cy="24" r="3" fill="#00fff0" />
                    <defs>
                      <linearGradient id="footerLogoGradient" x1="0" y1="0" x2="40" y2="40">
                        <stop offset="0%" stopColor="#00fff0" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <span className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  <span className="text-white">Djaber</span>
                  <span className="text-[#00fff0]">.ai</span>
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                {t('footer.tagline')}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">{t('footer.product')}</h4>
              <ul className="space-y-3">
                {[
                  { name: t('header.features'), href: '/features' },
                  { name: t('header.pricing'), href: '/pricing' },
                  { name: t('header.docs'), href: '/docs' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">{t('footer.company')}</h4>
              <ul className="space-y-3">
                {[
                  { name: 'About', href: '/about' },
                  { name: 'Blog', href: '/blog' },
                  { name: 'Careers', href: '/careers' },
                  { name: 'Contact', href: '/contact' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">{t('footer.legal')}</h4>
              <ul className="space-y-3">
                {[
                  { name: 'Privacy', href: '/privacy' },
                  { name: 'Terms', href: '/terms' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-zinc-500">
              © 2026 Djaber.ai. {t('footer.rights')}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
