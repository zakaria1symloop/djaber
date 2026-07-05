import React, { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';

export type KpiColor = 'violet' | 'emerald' | 'orange' | 'blue' | 'red' | 'zinc' | 'yellow' | 'pink';

// All accent values intentionally collapse to a single neutral chip scheme (color prop kept for compatibility).
const NEUTRAL_CHIP = 'bg-white/5 text-zinc-300';
const iconAccent: Record<KpiColor, string> = {
  violet:  NEUTRAL_CHIP,
  emerald: NEUTRAL_CHIP,
  orange:  NEUTRAL_CHIP,
  blue:    NEUTRAL_CHIP,
  red:     NEUTRAL_CHIP,
  yellow:  NEUTRAL_CHIP,
  pink:    NEUTRAL_CHIP,
  zinc:    NEUTRAL_CHIP,
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
 *
 * Backward compatible: existing callers pass only { value, onChange } with a
 * preset period. Pass `onRangeChange` (plus optional `startDate`/`endDate`) to
 * unlock a "Custom" button that reveals two monochrome date inputs.
 */
export type PeriodPreset = 'today' | 'week' | 'month' | 'year';
export type PeriodValue = PeriodPreset | 'custom';

/** Shared state shape callers can hold for a period + optional custom range. */
export type DateRangeState = {
  period: PeriodValue;
  startDate?: string;
  endDate?: string;
};

export interface PeriodSelectorProps {
  value: PeriodValue;
  /** Called when a preset button is clicked (never called with 'custom'). */
  onChange: (value: PeriodPreset) => void;
  /** Current custom range bounds (YYYY-MM-DD). */
  startDate?: string;
  endDate?: string;
  /** Provide to enable the Custom range button + date inputs. */
  onRangeChange?: (start: string, end: string) => void;
}

const PRESETS: PeriodPreset[] = ['today', 'week', 'month', 'year'];
// English fallbacks; live labels come from the `rep.c.period.*` keys at render.
const PRESET_LABEL: Record<PeriodPreset, string> = { today: 'Today', week: '7D', month: '30D', year: '1Y' };
const DATE_INPUT_CLASS =
  'bg-black/50 border border-white/10 rounded-lg text-white text-sm px-2 py-1.5 focus:border-white/30 focus:outline-none [color-scheme:dark]';

export function PeriodSelector({ value, onChange, startDate, endDate, onRangeChange }: PeriodSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(value === 'custom');
  const showCustom = !!onRangeChange;
  const showInputs = showCustom && (open || value === 'custom');

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center bg-zinc-900/60 border border-white/10 rounded-lg p-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setOpen(false);
              onChange(p);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              value === p ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t(`rep.c.period.${p}`, PRESET_LABEL[p])}
          </button>
        ))}
        {showCustom && (
          <button
            onClick={() => setOpen(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              value === 'custom' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('rep.c.period.custom')}
          </button>
        )}
      </div>

      {showInputs && (
        <div className="inline-flex items-center gap-2">
          <input
            type="date"
            value={startDate || ''}
            max={endDate || undefined}
            onChange={(e) => onRangeChange!(e.target.value, endDate || '')}
            className={DATE_INPUT_CLASS}
          />
          <span className="text-zinc-500 text-xs">—</span>
          <input
            type="date"
            value={endDate || ''}
            min={startDate || undefined}
            onChange={(e) => onRangeChange!(startDate || '', e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
