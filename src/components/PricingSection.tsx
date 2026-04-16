'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001';

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  maxPages: number;
  maxProducts: number;
  maxConversations: number;
  features: string[];
  isFeatured: boolean;
}

export default function PricingSection() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-96 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-full p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              billing === 'monthly' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('pricing.monthly')}
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              billing === 'yearly' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('pricing.yearly')}
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className={`grid gap-8 max-w-6xl mx-auto ${plans.length === 1 ? 'md:grid-cols-1 max-w-md' : plans.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'}`}>
        {plans.map((plan) => {
          const price = billing === 'yearly' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
          const isFree = price === 0;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 border transition-all ${
                plan.isFeatured
                  ? 'border-white/30 bg-white/[0.03]'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              {plan.isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-white text-black text-xs font-bold rounded-full uppercase tracking-wider">
                    {t('pricing.popular')}
                  </span>
                </div>
              )}

              <h3
                className="text-xl font-bold text-white mb-2"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {plan.name}
              </h3>

              {plan.description && (
                <p className="text-sm text-zinc-400 mb-4">{plan.description}</p>
              )}

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {isFree ? t('pricing.free') : price.toLocaleString()}
                </span>
                {!isFree && (
                  <span className="text-zinc-500 text-sm">
                    {plan.currency}/{billing === 'yearly' ? t('pricing.perYear') : t('pricing.perMonth')}
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full text-center px-6 py-3 rounded-full text-sm font-semibold transition-all ${
                  plan.isFeatured
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                }`}
              >
                {isFree ? t('pricing.getStartedFree') : t('pricing.subscribe')}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
