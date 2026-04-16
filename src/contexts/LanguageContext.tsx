'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getLang, setLang as storeLang, translateFor, type Lang } from '@/lib/i18n';

interface LanguageContextValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (lang: Lang) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR-safe default; real value hydrates in useEffect
  const [lang, setLangState] = useState<Lang>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getLang());
    setMounted(true);
    const handler = () => setLangState(getLang());
    window.addEventListener('lang-change', handler);
    return () => window.removeEventListener('lang-change', handler);
  }, []);

  // Sync <html dir> and <html lang> when language changes
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang, mounted]);

  const setLang = useCallback((next: Lang) => {
    storeLang(next);
    setLangState(next);
  }, []);

  const t = useCallback((key: string, fallback?: string) => translateFor(lang, key, fallback), [lang]);

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Allow non-wrapped use (e.g., utilities) — returns defaults based on localStorage
    return {
      lang: 'en',
      dir: 'ltr',
      setLang: storeLang,
      t: (key, fb) => translateFor('en', key, fb),
    };
  }
  return ctx;
}
