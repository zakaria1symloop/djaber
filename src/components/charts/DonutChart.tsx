import React from 'react';

export interface DonutSlice {
  label: string;
  value: number;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

// The one place multiple grays encode identity — always paired with the legend.
// Largest slice gets the brightest tone; ramp fades to zinc-700.
const RAMP = ['#ffffff', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46'];

/**
 * Monochrome donut. Slices are ranked and mapped to a white-to-zinc ramp, with
 * a 2px surface gap between arcs. More than six categories collapse into
 * "Other". Always rendered beside a legend so the grays stay legible.
 */
export function DonutChart({ slices, size = 160, centerLabel, centerValue }: DonutChartProps) {
  const clean = (slices ?? []).filter((s) => Number.isFinite(s.value) && s.value > 0);
  const sorted = [...clean].sort((a, b) => b.value - a.value);

  // Cap at 6 tones: keep top 5 and bucket the rest as "Other".
  let display: DonutSlice[] = sorted;
  if (sorted.length > 6) {
    const head = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((sum, s) => sum + s.value, 0);
    display = [...head, { label: 'Other', value: rest }];
  }

  const total = display.reduce((sum, s) => sum + s.value, 0);
  const stroke = Math.max(12, Math.round(size * 0.14));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const gap = display.length > 1 ? 2 : 0; // px of surface showing between arcs

  let acc = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          {/* track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          {total > 0 &&
            display.map((s, i) => {
              const frac = s.value / total;
              const len = Math.max(frac * C - gap, 0.001);
              const angle = acc * 360 - 90;
              acc += frac;
              return (
                <circle
                  key={`${s.label}-${i}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={RAMP[Math.min(i, RAMP.length - 1)]}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${C - len}`}
                  transform={`rotate(${angle} ${cx} ${cy})`}
                  strokeLinecap="butt"
                >
                  <title>{`${s.label} · ${s.value.toLocaleString()} (${Math.round(frac * 100)}%)`}</title>
                </circle>
              );
            })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            {centerValue && (
              <span
                className="text-xl font-bold text-white leading-tight"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-0.5">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {total === 0 && <p className="text-sm font-bold text-white">No data yet</p>}
        {display.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={`${s.label}-${i}`} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: RAMP[Math.min(i, RAMP.length - 1)] }}
              />
              <span className="text-zinc-300 truncate min-w-0 flex-1">{s.label}</span>
              <span className="text-white tabular-nums whitespace-nowrap">{s.value.toLocaleString()}</span>
              <span className="text-zinc-500 tabular-nums w-9 text-end whitespace-nowrap">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DonutChart;
