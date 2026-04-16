'use client';

import PricingSection from '@/components/PricingSection';
import { useTranslation } from '@/contexts/LanguageContext';

export default function PricingPage() {
  const { t, dir } = useTranslation();
  return (
    <main className="min-h-screen pt-28" dir={dir}>
      <section className="relative py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1
              className="text-4xl sm:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {t('home.pricing.title')} <span className="gradient-text">{t('home.pricing.titleHighlight')}</span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              {t('home.pricing.subtitle')}
            </p>
          </div>
          <PricingSection />
        </div>
      </section>
    </main>
  );
}
