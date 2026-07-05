import React from 'react';

export interface FunnelStage {
  label: string;
  value: number;
  /** 'good' -> white fill, 'dead' -> zinc-700 + muted label, default -> zinc-500. */
  tone?: 'good' | 'dead';
}

export interface FunnelBarsProps {
  stages: FunnelStage[];
}

/**
 * Horizontal funnel. Every bar is scaled to the first stage's value, so each
 * row reads as a share of the top of the funnel. Tone is encoded by fill
 * brightness only (white / zinc-500 / zinc-700) — never color.
 */
export function FunnelBars({ stages }: FunnelBarsProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-white">No funnel data yet</p>
        <p className="text-xs text-zinc-500 mt-1">Stages will appear here as data comes in.</p>
      </div>
    );
  }

  const first = stages[0]?.value || 0;

  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pct = first > 0 ? Math.min(100, Math.max(0, (s.value / first) * 100)) : 0;
        const dead = s.tone === 'dead';
        const fill = dead ? 'bg-zinc-700' : s.tone === 'good' ? 'bg-white' : 'bg-zinc-500';
        return (
          <div key={i} title={`${s.label} · ${s.value.toLocaleString()} (${Math.round(pct)}%)`}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className={`text-sm truncate min-w-0 ${dead ? 'text-zinc-500' : 'text-white'}`}>
                {s.label}
              </span>
              <span className="text-xs tabular-nums whitespace-nowrap shrink-0">
                <span className={dead ? 'text-zinc-500' : 'text-white'}>{s.value.toLocaleString()}</span>
                <span className="text-zinc-500"> · {Math.round(pct)}%</span>
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${fill}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FunnelBars;
