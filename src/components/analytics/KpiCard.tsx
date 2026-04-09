import React from 'react';

export type KpiColor = 'violet' | 'emerald' | 'orange' | 'blue' | 'red' | 'zinc' | 'yellow' | 'pink';

const iconAccent: Record<KpiColor, string> = {
  violet:  'bg-violet-500/10 text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  orange:  'bg-orange-500/10 text-orange-400',
  blue:    'bg-blue-500/10 text-blue-400',
  red:     'bg-red-500/10 text-red-400',
  yellow:  'bg-yellow-500/10 text-yellow-400',
  pink:    'bg-pink-500/10 text-pink-400',
  zinc:    'bg-white/5 text-zinc-300',
};

export interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  /** Accent color used only for the small icon chip. The card itself stays neutral. */
  color?: KpiColor;
}

export function KpiCard({ label, value, hint, icon, color = 'zinc' }: KpiCardProps) {
  return (
    <div className="relative bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconAccent[color]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
      {hint && <p className="text-xs mt-1 text-zinc-500">{hint}</p>}
    </div>
  );
}

/**
 * Compact period selector button group used by analytics pages.
 */
export interface PeriodSelectorProps {
  value: 'today' | 'week' | 'month' | 'year';
  onChange: (value: 'today' | 'week' | 'month' | 'year') => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex items-center bg-zinc-900/60 border border-white/10 rounded-lg p-1">
      {(['today', 'week', 'month', 'year'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            value === p ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {p === 'today' ? 'Today' : p === 'week' ? '7D' : p === 'month' ? '30D' : '1Y'}
        </button>
      ))}
    </div>
  );
}
