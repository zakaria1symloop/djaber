'use client';

import { useRouter } from 'next/navigation';
import { BoxIcon, ShoppingCartIcon, BotIcon, MegaphoneIcon } from '@/components/ui/icons';
import { useTranslation } from '@/contexts/LanguageContext';

const servicesBase = [
  { id: 'products', nameKey: 'page.services.products.title', descKey: 'page.services.products.desc', icon: BoxIcon, href: '/dashboard/stock', active: true, accent: 'emerald' },
  { id: 'sales', nameKey: 'page.services.sales.title', descKey: 'page.services.sales.desc', icon: ShoppingCartIcon, href: null, active: false, accent: 'blue' },
  { id: 'bot', nameKey: 'page.services.bot.title', descKey: 'page.services.bot.desc', icon: BotIcon, href: null, active: false, accent: 'purple' },
  { id: 'commercial', nameKey: 'page.services.commercial.title', descKey: 'page.services.commercial.desc', icon: MegaphoneIcon, href: null, active: false, accent: 'amber' },
] as const;

// All accent keys intentionally collapse to a single neutral scheme (accent field kept for compatibility).
const NEUTRAL_ACCENT = {
  border: 'border-white/10 hover:border-white/20',
  bg: 'bg-white/5',
  icon: 'text-zinc-300',
  badge: 'border border-white/10 text-zinc-500',
};
const accentMap: Record<string, { border: string; bg: string; icon: string; badge: string }> = {
  emerald: NEUTRAL_ACCENT,
  blue: NEUTRAL_ACCENT,
  purple: NEUTRAL_ACCENT,
  amber: NEUTRAL_ACCENT,
};

export default function ServicesPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const services = servicesBase.map(s => ({ ...s, name: t(s.nameKey), description: t(s.descKey) }));

  return (
    <div dir={dir}>
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {t('page.services.title')}
        </h1>
        <p className="text-zinc-400">
          {t('page.services.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => {
          const Icon = service.icon;
          const colors = accentMap[service.accent];

          return (
            <button
              key={service.id}
              onClick={() => service.href && router.push(service.href)}
              disabled={!service.active}
              className={`group relative text-start p-6 rounded-xl border transition-all duration-200 ${
                service.active
                  ? `${colors.border} bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer`
                  : 'border-white/5 bg-zinc-900/30 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${colors.icon}`} />
                </div>
                {!service.active && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                    {t('page.services.soon')}
                  </span>
                )}
                {service.active && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/[0.03] text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    {t('page.services.active')}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold text-white mb-1">{service.name}</h3>
              <p className="text-sm text-zinc-500">{service.description}</p>

              {service.active && (
                <div className="mt-4 flex items-center gap-1 text-sm text-zinc-400 group-hover:text-white transition-colors">
                  <span>{t('page.services.open')}</span>
                  <svg className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
