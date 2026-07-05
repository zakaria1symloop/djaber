import React from 'react';

/**
 * A single hero figure in the ledger band. Monochrome only — the delta uses a
 * zinc arrow, never green/red. Background is the hairline-gap cell (#0c0c0e) so
 * StatTileRow can render a clean 1px grid between cells.
 */
export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  /** Signed change. Rendered with an up/down arrow in neutral zinc — never colored. */
  delta?: number;
  prefix?: string;
  suffix?: string;
}

export function StatTile({ label, value, hint, delta, prefix, suffix }: StatTileProps) {
  const display = typeof value === 'number' ? value.toLocaleString() : value;
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const up = hasDelta && (delta as number) > 0;
  const down = hasDelta && (delta as number) < 0;

  return (
    <div className="h-full bg-[#0c0c0e] p-5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2">{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: 'Syne, sans-serif' }}>
          {prefix}
          {display}
          {suffix}
        </p>
        {hasDelta && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
            {(up || down) && (
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                aria-hidden="true"
                className={down ? 'rotate-180' : undefined}
              >
                <path d="M4 1 L7 6 L1 6 Z" fill="currentColor" />
              </svg>
            )}
            <span className="tabular-nums">{Math.abs(delta as number).toLocaleString()}</span>
          </span>
        )}
      </div>
      {hint && <p className="text-xs mt-1.5 text-zinc-600">{hint}</p>}
    </div>
  );
}

/**
 * Responsive ledger band that lays StatTiles on a 1px hairline grid.
 * The gap-px + bg-white/10 wrapper shows through as hairlines between the
 * #0c0c0e cells.
 */
export function StatTileRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-xl overflow-hidden">
      {children}
    </div>
  );
}

export default StatTile;
