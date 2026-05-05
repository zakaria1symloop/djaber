'use client';

import { useTranslation } from '@/contexts/LanguageContext';

export default function MobileAppPage() {
  const { t, dir } = useTranslation();

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 sm:px-10 lg:px-16" dir={dir} style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--rule-strong)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--live)' }} />
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--paper-dim)' }}>Coming soon</span>
        </div>

        <h1 className="mt-6 font-medium tracking-[-0.03em] leading-[0.95]" style={{ fontFamily: 'Geist, sans-serif', fontSize: 'clamp(40px, 6vw, 76px)' }}>
          The Djaber app<span style={{ color: 'var(--live)' }}>.</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg max-w-[58ch]" style={{ color: 'var(--paper-dim)' }}>
          Manage your Messenger and Instagram conversations, approve orders, and track delivery — all from your phone. We&apos;re polishing the iOS and Android apps right now.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <button disabled className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 cursor-not-allowed">
            <span className="text-2xl">🍎</span>
            <span className="text-start">
              <span className="block text-[10px] uppercase tracking-wider" style={{ color: 'var(--paper-dim)' }}>Coming to</span>
              <span className="block text-sm font-semibold">App Store</span>
            </span>
          </button>
          <button disabled className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 cursor-not-allowed">
            <span className="text-2xl">▶</span>
            <span className="text-start">
              <span className="block text-[10px] uppercase tracking-wider" style={{ color: 'var(--paper-dim)' }}>Coming to</span>
              <span className="block text-sm font-semibold">Google Play</span>
            </span>
          </button>
        </div>

        <p className="mt-10 text-sm" style={{ color: 'var(--paper-dim)' }}>
          In the meantime, the full dashboard works perfectly on mobile browsers.
        </p>
      </div>
    </main>
  );
}
