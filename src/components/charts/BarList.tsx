import React from 'react';

export interface BarListRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  /** Optional comparison value, shown as a thin marker on the track. */
  secondary?: number;
}

export interface BarListProps {
  rows: BarListRow[];
  /** Formats the right-aligned value. Defaults to a thousands-separated integer. */
  valueFormat?: (n: number) => string;
  /** Track scale. Defaults to the largest value across the rows. */
  max?: number;
  showSecondary?: boolean;
  secondaryLabel?: string;
  emptyText?: string;
}

/**
 * Ranked horizontal list — the workhorse chart. Magnitude is encoded by bar
 * length (white fill on a white/10 track), never by color. An optional thin
 * zinc marker overlays a comparison value.
 */
export function BarList({
  rows,
  valueFormat = (n) => n.toLocaleString(),
  max,
  showSecondary = false,
  secondaryLabel,
  emptyText = 'No data yet',
}: BarListProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-white">{emptyText}</p>
        <p className="text-xs text-zinc-500 mt-1">Rows will appear here as data comes in.</p>
      </div>
    );
  }

  const scale =
    max ??
    Math.max(
      1,
      ...rows.map((r) => r.value),
      ...(showSecondary ? rows.map((r) => r.secondary ?? 0) : []),
    );

  return (
    <div>
      {showSecondary && secondaryLabel && (
        <div className="flex items-center gap-4 mb-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded-full bg-white" />
            Value
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-0.5 h-3 rounded-full bg-zinc-500" />
            {secondaryLabel}
          </span>
        </div>
      )}

      <div className="-mx-2">
        {rows.map((r) => {
          const pct = Math.min(100, Math.max(0, (r.value / scale) * 100));
          const secPct =
            showSecondary && typeof r.secondary === 'number'
              ? Math.min(100, Math.max(0, (r.secondary / scale) * 100))
              : null;
          const formatted = valueFormat(r.value);
          return (
            <div
              key={r.id}
              title={`${r.label} · ${formatted}`}
              className="rounded-lg px-2 py-2 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-sm text-white truncate">{r.label}</span>
                  {r.sublabel && (
                    <span className="text-[11px] text-zinc-500 shrink-0 truncate">{r.sublabel}</span>
                  )}
                </div>
                <span className="text-sm text-white tabular-nums whitespace-nowrap">{formatted}</span>
              </div>
              <div className="relative mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 start-0 bg-white rounded-full"
                  style={{ width: `${pct}%` }}
                />
                {secPct !== null && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-zinc-500"
                    style={{ insetInlineStart: `${secPct}%` }}
                    title={secondaryLabel ? `${secondaryLabel}: ${(r.secondary as number).toLocaleString()}` : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BarList;
