'use client';

import { useTranslation } from '@/contexts/LanguageContext';
import { LANGS, type Lang } from '@/lib/i18n';

interface Props {
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: Props) {
  const { lang, setLang } = useTranslation();

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      role="group"
      aria-label="Language selector"
    >
      {LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code as Lang)}
            aria-pressed={active}
            aria-label={l.label}
            className={`px-2.5 py-1 rounded-full font-medium transition-all duration-200 ${
              active
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {l.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
