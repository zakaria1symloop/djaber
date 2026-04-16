'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

const FAQ_STRUCTURE = [
  { cat: 'cat1', count: 3 },
  { cat: 'cat2', count: 4 },
  { cat: 'cat3', count: 4 },
  { cat: 'cat4', count: 3 },
  { cat: 'cat5', count: 3 },
] as const;

export default function HelpPage() {
  const { t, dir } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const faqs = useMemo(() => {
    return FAQ_STRUCTURE.map((group) => ({
      cat: group.cat,
      name: t(`help.${group.cat}.name`),
      questions: Array.from({ length: group.count }, (_, i) => ({
        q: t(`help.${group.cat}.q${i + 1}`),
        a: t(`help.${group.cat}.a${i + 1}`),
      })),
    }));
  }, [t]);

  const toggleQuestion = (categoryIndex: number, questionIndex: number) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  const filteredFaqs = searchQuery
    ? faqs
        .map((category) => ({
          ...category,
          questions: category.questions.filter(
            (q) =>
              q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
              q.a.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((category) => category.questions.length > 0)
    : faqs;

  return (
    <main className="min-h-screen pt-28 overflow-x-hidden" dir={dir}>
      <section className="relative py-16 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="gradient-text">{t('help.title')}</span>
            </h1>
            <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto px-4 mb-8">
              {t('help.subtitle')}
            </p>

            <div className="max-w-2xl mx-auto px-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('help.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full px-6 py-4 ${dir === 'rtl' ? 'pr-12' : 'pl-12'} bg-[#0a0a0a] border border-white/10 rounded-full text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none transition-colors`}
                />
                <svg className={`w-5 h-5 text-zinc-500 absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            <Link href="/docs" className="p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl hover:bg-[#141414] hover:border-white/20 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white to-zinc-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{t('help.quick.docs.title')}</h3>
              <p className="text-sm text-zinc-400">{t('help.quick.docs.desc')}</p>
            </Link>

            <a href="mailto:support@djaber.ai" className="p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl hover:bg-[#141414] hover:border-white/20 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white to-zinc-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{t('help.quick.email.title')}</h3>
              <p className="text-sm text-zinc-400">{t('help.quick.email.desc')}</p>
            </a>

            <div className="p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl hover:bg-[#141414] hover:border-white/20 transition-all duration-300 group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white to-zinc-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{t('help.quick.chat.title')}</h3>
              <p className="text-sm text-zinc-400">{t('help.quick.chat.desc')}</p>
            </div>
          </div>

          {/* FAQ Sections */}
          <div className="space-y-8">
            {filteredFaqs.map((category, categoryIndex) => (
              <div key={category.cat}>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {category.name}
                </h2>
                <div className="space-y-3">
                  {category.questions.map((item, questionIndex) => {
                    const key = `${categoryIndex}-${questionIndex}`;
                    const isOpen = openIndex === key;

                    return (
                      <div
                        key={questionIndex}
                        className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300"
                      >
                        <button
                          onClick={() => toggleQuestion(categoryIndex, questionIndex)}
                          className="w-full p-6 text-start flex items-center justify-between gap-4 group"
                        >
                          <span className="text-base sm:text-lg font-semibold text-white group-hover:text-zinc-300 transition-colors">
                            {item.q}
                          </span>
                          <svg
                            className={`w-5 h-5 text-zinc-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div
                          className={`overflow-hidden transition-all duration-300 ${
                            isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                        >
                          <div className="px-6 pb-6 text-zinc-400 leading-relaxed">
                            {item.a}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Contact Section */}
          <div className="mt-16 bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
              {t('help.stillNeed.title')}
            </h2>
            <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">
              {t('help.stillNeed.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@djaber.ai"
                className="px-8 py-4 bg-gradient-to-br from-white to-zinc-600 text-black font-semibold rounded-full hover:scale-105 transition-transform duration-300"
              >
                {t('help.stillNeed.contact')}
              </a>
              <Link
                href="/docs"
                className="px-8 py-4 bg-white/5 border border-white/20 text-white font-semibold rounded-full hover:bg-white/10 transition-colors duration-300"
              >
                {t('help.stillNeed.docs')}
              </Link>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-white/5 text-center">
            <p className="text-zinc-400 text-sm">
              <Link href="/" className="text-white hover:underline">{t('help.footer.home')}</Link>
              {' • '}
              <Link href="/privacy" className="text-white hover:underline">{t('footer.legal.privacy')}</Link>
              {' • '}
              <Link href="/terms" className="text-white hover:underline">{t('footer.legal.terms')}</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
