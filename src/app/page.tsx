'use client';

import Link from 'next/link';
import AnimatedDashboard from '@/components/AnimatedDashboard';
import PricingSection from '@/components/PricingSection';
import AnimatedSlogan from '@/components/AnimatedSlogan';
import { useTranslation } from '@/contexts/LanguageContext';

export default function Home() {
  const { t, dir, lang } = useTranslation();

  return (
    <main className="min-h-screen relative" dir={dir} style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
      {/* ──────────────────────────────────────────────── HERO ─── */}
      <section className="relative pt-28 sm:pt-32 pb-20 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1280px] mx-auto">
          {/* Status row — feels like a real product page */}
          <div className="flex flex-wrap items-center gap-3 mb-12">
            <span className="status-live">{t('home.hero.badge')}</span>
            <span className="label">v1.2 · {new Date().getFullYear()}</span>
            <span className="label hidden sm:inline">DZ · {lang.toUpperCase()}</span>
          </div>

          {/* Main grid: headline left, live chat preview right */}
          <div className="grid grid-cols-12 gap-x-6 gap-y-12 lg:gap-y-0">
            {/* LEFT: Headline */}
            <div className="col-span-12 lg:col-span-7">
              <h1
                className="font-medium tracking-[-0.03em] leading-[0.95]"
                style={{
                  color: 'var(--paper)',
                  fontSize: 'clamp(48px, 7vw, 104px)',
                  fontFamily: 'Geist, sans-serif',
                }}
              >
                {t('home.hero.title.top')}
                <br />
                <span className="font-bold">{t('home.hero.title.highlight')}</span>
                <span style={{ color: 'var(--live)' }}>.</span>
              </h1>

              <div className="mt-8 pl-4 border-s-2" style={{ borderColor: 'var(--rule-strong)' }}>
                <p className="text-2xl sm:text-3xl leading-snug font-medium tracking-tight" style={{ color: 'var(--paper)' }}>
                  <AnimatedSlogan />
                </p>
              </div>

              <p className="mt-8 text-base sm:text-lg leading-relaxed max-w-[58ch]" style={{ color: 'var(--paper-dim)' }}>
                {t('home.hero.subtitle')}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="btn-flat">
                  <span>{t('home.hero.cta.primary')}</span>
                  <span className="mono">{dir === 'rtl' ? '←' : '→'}</span>
                </Link>
                <Link href="#demo" className="btn-line">
                  <span>{t('home.hero.cta.secondary')}</span>
                </Link>
              </div>
            </div>

            {/* RIGHT: Live Messenger preview — concrete product imagery */}
            <div className="col-span-12 lg:col-span-5 lg:pl-4">
              <ChatPreview />
            </div>
          </div>

          {/* Stats bar — dense, mono, no card chrome */}
          <div className="mt-24 sm:mt-28">
            <div className="rule mb-6" />
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {[
                { value: '10K+', label: t('home.stats.messages') },
                { value: '500+', label: t('home.stats.pages') },
                { value: '99.9%', label: t('home.stats.uptime') },
                { value: '<1s', label: t('home.stats.response') },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="px-1 py-6 lg:py-8 lg:border-s first:lg:border-s-0"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <p className="text-4xl lg:text-5xl font-bold tracking-tight leading-none mb-3" style={{ color: 'var(--paper)' }}>
                    {stat.value}
                  </p>
                  <p className="label">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="rule" />
          </div>

          {/* Dashboard preview */}
          <div className="mt-20 sm:mt-24" id="demo">
            <div className="flex items-baseline justify-between mb-5">
              <p className="label">DASHBOARD · 01</p>
              <p className="label hidden sm:block">SCROLL ↓</p>
            </div>
            <AnimatedDashboard />
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────── FEATURES ─── */}
      <section id="features" className="relative py-28 sm:py-36 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-12 gap-6 items-end mb-12">
            <div className="col-span-12 lg:col-span-7">
              <p className="label mb-5">FEATURES · 06</p>
              <h2 className="font-medium tracking-[-0.02em] leading-[1.05]" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}>
                {t('home.features.title')}
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <p className="text-base leading-relaxed max-w-[44ch]" style={{ color: 'var(--paper-dim)' }}>
                {t('home.features.subtitle')}
              </p>
            </div>
          </div>

          <div className="rule" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {(['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] as const).map((key, i) => {
              const num = String(i + 1).padStart(2, '0');
              return (
                <article
                  key={key}
                  className="relative px-1 py-10 sm:py-12 border-b md:[&:nth-child(2n)]:border-s lg:[&:nth-child(2n)]:border-s-0 lg:[&:not(:nth-child(3n+1))]:border-s"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <span className="mono text-xs" style={{ color: 'var(--mute)' }}>F{num}</span>
                    <span className="rule flex-1" />
                  </div>
                  <h3 className="text-xl lg:text-2xl font-medium mb-3 tracking-tight leading-snug" style={{ color: 'var(--paper)' }}>
                    {t(`home.features.${key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--paper-dim)' }}>
                    {t(`home.features.${key}.desc`)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────── HOW IT WORKS ─── */}
      <section className="relative py-28 sm:py-36 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-12 gap-6 mb-14">
            <div className="col-span-12 lg:col-span-7">
              <p className="label mb-5">SETUP · 03 STEPS</p>
              <h2 className="font-medium tracking-[-0.02em] leading-[1.05]" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}>
                {t('home.how.title')} <span className="font-bold">{t('home.how.titleHighlight')}</span>
                <span style={{ color: 'var(--live)' }}>.</span>
              </h2>
              <p className="mt-6 text-base max-w-[52ch]" style={{ color: 'var(--paper-dim)' }}>
                {t('home.how.subtitle')}
              </p>
            </div>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--rule)' }}>
            {(['s1', 's2', 's3'] as const).map((key, i) => {
              const num = String(i + 1).padStart(2, '0');
              return (
                <div
                  key={key}
                  className="grid grid-cols-12 gap-6 py-10 border-b items-baseline"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <div className="col-span-3 sm:col-span-2">
                    <p className="mono text-sm" style={{ color: 'var(--live)' }}>STEP {num}</p>
                  </div>
                  <div className="col-span-9 sm:col-span-7 lg:col-span-7">
                    <h3 className="text-2xl lg:text-3xl font-medium tracking-tight mb-3" style={{ color: 'var(--paper)' }}>
                      {t(`home.how.${key}.title`)}
                    </h3>
                    <p className="text-base leading-relaxed max-w-[56ch]" style={{ color: 'var(--paper-dim)' }}>
                      {t(`home.how.${key}.desc`)}
                    </p>
                  </div>
                  <div className="hidden sm:block sm:col-span-3 text-end">
                    <span className="text-6xl lg:text-7xl font-light tracking-tighter" style={{ color: 'var(--rule-strong)' }}>{num}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────── PRICING ─── */}
      <section id="pricing" className="relative py-28 sm:py-36 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-12 gap-6 items-end mb-14">
            <div className="col-span-12 lg:col-span-7">
              <p className="label mb-5">PRICING</p>
              <h2 className="font-medium tracking-[-0.02em] leading-[1.05]" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}>
                {t('home.pricing.title')} <span className="font-bold">{t('home.pricing.titleHighlight')}</span>
              </h2>
              <p className="mt-6 text-base max-w-[52ch]" style={{ color: 'var(--paper-dim)' }}>
                {t('home.pricing.subtitle')}
              </p>
            </div>
          </div>

          <div className="rule mb-12" />

          <PricingSection />
        </div>
      </section>

      {/* ──────────────────────────────────────────── FINAL CTA ─── */}
      <section className="relative py-28 sm:py-36 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1280px] mx-auto">
          <div className="rule mb-10" />
          <div className="grid grid-cols-12 gap-6 items-end">
            <div className="col-span-12 lg:col-span-8">
              <p className="label mb-5">START · 24/7</p>
              <h2 className="font-medium tracking-[-0.03em] leading-[0.95]" style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}>
                {t('home.cta.title.top')}{' '}
                <span className="font-bold">{t('home.cta.title.highlight')}</span>{' '}
                {t('home.cta.title.bottom')}
                <span style={{ color: 'var(--live)' }}>.</span>
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <p className="text-base leading-relaxed mb-8 max-w-[44ch]" style={{ color: 'var(--paper-dim)' }}>
                {t('home.cta.subtitle')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/signup" className="btn-flat">
                  <span>{t('home.cta.primary')}</span>
                  <span className="mono">{dir === 'rtl' ? '←' : '→'}</span>
                </Link>
                <Link href="/contact" className="btn-line">
                  <span>{t('home.cta.secondary')}</span>
                </Link>
              </div>
            </div>
          </div>
          <div className="rule mt-14" />
        </div>
      </section>

      {/* ──────────────────────────────────────────── FOOTER ─── */}
      <footer className="relative py-12 px-6 sm:px-10 lg:px-16">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-4">
              <p className="text-2xl font-medium tracking-tight mb-3" style={{ color: 'var(--paper)' }}>
                Djaber<span style={{ color: 'var(--live)' }}>.</span>ai
              </p>
              <p className="text-sm leading-relaxed max-w-[36ch]" style={{ color: 'var(--paper-dim)' }}>
                {t('footer.tagline')}
              </p>
            </div>

            <div className="col-span-6 md:col-span-2 md:col-start-7">
              <p className="label mb-4">{t('footer.product')}</p>
              <ul className="space-y-3">
                {[
                  { name: t('header.features'), href: '/features' },
                  { name: t('header.pricing'), href: '/pricing' },
                  { name: t('header.docs'), href: '/docs' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors" style={{ color: 'var(--paper-dim)' }}>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-6 md:col-span-2">
              <p className="label mb-4">{t('footer.company')}</p>
              <ul className="space-y-3">
                {[
                  { name: 'About', href: '/about' },
                  { name: 'Blog', href: '/blog' },
                  { name: 'Careers', href: '/careers' },
                  { name: 'Contact', href: '/contact' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors" style={{ color: 'var(--paper-dim)' }}>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-12 md:col-span-2">
              <p className="label mb-4">{t('footer.legal')}</p>
              <ul className="space-y-3">
                {[
                  { name: t('footer.legal.privacy'), href: '/privacy' },
                  { name: t('footer.legal.terms'), href: '/terms' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors" style={{ color: 'var(--paper-dim)' }}>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rule mt-12 mb-5" />

          <div className="flex flex-col md:flex-row justify-between gap-3">
            <p className="label">© {new Date().getFullYear()} DJABER.AI · {t('footer.rights')}</p>
            <p className="label">v1.2 · BUILT IN ALGER</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ──────────────────────────────────────────────────────────
// Live chat preview — concrete product imagery, no abstract AI
// Shows a Messenger-style conversation between a customer and the AI agent
// ──────────────────────────────────────────────────────────
function ChatPreview() {
  return (
    <div
      className="relative w-full max-w-[460px] mx-auto"
      style={{ background: 'var(--ink-2)', border: '1px solid var(--rule)' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: '#1877F2', color: '#fff' }}>
            f
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight">Ibtissama-Soft</p>
            <p className="text-[10px] leading-tight mono" style={{ color: 'var(--mute)' }}>MESSENGER · LIVE</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 3px var(--live-dim)' }} />
          <span className="mono text-[10px]" style={{ color: 'var(--paper-dim)' }}>AI</span>
        </div>
      </div>

      {/* Messages */}
      <div className="px-4 py-5 space-y-3 min-h-[280px]" style={{ background: 'var(--ink)' }}>
        {/* Customer */}
        <div className="flex justify-start">
          <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-bl-sm text-sm" style={{ background: 'var(--ink-3)', color: 'var(--paper)' }}>
            slm, 3andkom hadak l-produit b 4500 da?
          </div>
        </div>

        {/* AI reply */}
        <div className="flex justify-end">
          <div
            className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm text-sm"
            style={{ background: 'var(--paper)', color: 'var(--ink)' }}
          >
            Marhba bik 👋 Eh oui, kayen f stock. 4500 DA + 600 DA livraison li wilayat Alger. T7eb tatlab?
          </div>
        </div>

        {/* Customer */}
        <div className="flex justify-start">
          <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-bl-sm text-sm" style={{ background: 'var(--ink-3)', color: 'var(--paper)' }}>
            Wah, ndir commande. Ismi Karim, 0555 12 34 56
          </div>
        </div>

        {/* AI typing */}
        <div className="flex justify-end">
          <div
            className="px-3.5 py-3 rounded-2xl rounded-br-sm flex items-center gap-1"
            style={{ background: 'var(--paper)', color: 'var(--ink)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>

      {/* Footer status */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: 'var(--rule)' }}>
        <span className="mono text-[10px]" style={{ color: 'var(--mute)' }}>
          ● ORDER#2871 CREATED
        </span>
        <span className="mono text-[10px]" style={{ color: 'var(--live)' }}>
          0.8s
        </span>
      </div>
    </div>
  );
}
