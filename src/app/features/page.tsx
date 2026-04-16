'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

export default function FeaturesPage() {
  const { t, dir } = useTranslation();
  const featureKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] as const;

  return (
    <main className="min-h-screen pt-28" dir={dir}>
      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">{t('features.page.title')}</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              {t('features.page.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureKeys.map((key) => (
              <div
                key={key}
                className="group relative p-8 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-white/30 transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00fff0]/5 to-[#a855f7]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <h3
                    className="text-2xl font-bold text-white mb-4"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {t(`features.page.${key}.title`)}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed mb-6">
                    {t(`features.page.${key}.desc`)}
                  </p>
                  <ul className="space-y-2">
                    {(['i1', 'i2', 'i3'] as const).map((iKey) => (
                      <li key={iKey} className="flex items-center gap-2 text-sm text-zinc-500">
                        <svg className="w-4 h-4 text-[#00fff0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t(`features.page.${key}.${iKey}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
            <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('features.page.cta.title')}
            </h2>
            <p className="text-lg text-zinc-400 mb-10">
              {t('features.page.cta.subtitle')}
            </p>
            <Link
              href="/signup"
              className="btn-primary px-8 py-4 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2"
            >
              <span>{t('features.page.cta.button')}</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
