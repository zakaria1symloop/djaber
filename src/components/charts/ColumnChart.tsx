'use client';

import React from 'react';
import { fmtNum } from './format';
import { useTranslation } from '@/contexts/LanguageContext';

export type ColumnPoint = { label: string } & Record<string, number | string>;

export interface ColumnChartProps<K extends string = string> {
  points: ColumnPoint[];
  /** Key of the primary series (white bars). */
  metric: K;
  /** Optional second series (zinc, thinner grouped bar). */
  metric2?: K;
  /** Optional override for x-axis tick labels, aligned to points. */
  labels?: string[];
  height?: number;
  format?: (n: number) => string;
}

/**
 * Vertical grouped columns growing from a single baseline. Primary series is a
 * white bar; the optional second series is a thinner zinc bar beside it. No
 * color — magnitude is length only.
 */
export function ColumnChart({
  points,
  metric,
  metric2,
  labels,
  height = 200,
  format = fmtNum,
}: ColumnChartProps) {
  const { t } = useTranslation();
  if (!points || points.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-white">{t('rep.hub.chart.noData')}</p>
        <p className="text-xs text-zinc-500 mt-1">{t('rep.hub.chart.columnsHint')}</p>
      </div>
    );
  }

  const val = (p: ColumnPoint, k: string) => {
    const n = Number(p[k]);
    return Number.isFinite(n) ? n : 0;
  };

  const max = Math.max(
    1,
    ...points.map((p) => val(p, metric)),
    ...(metric2 ? points.map((p) => val(p, metric2)) : []),
  );

  // Thin ~6-8 x-axis labels to avoid collisions.
  const step = Math.max(1, Math.ceil(points.length / 8));

  const barHeight = (v: number) => (v > 0 ? `max(3px, ${(v / max) * 100}%)` : '0px');

  return (
    <div>
      {metric2 && (
        <div className="flex items-center gap-4 mb-4 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-white" />
            {metric}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-zinc-500" />
            {metric2}
          </span>
        </div>
      )}

      <div className="flex items-end gap-1.5 border-b border-white/5" style={{ height }}>
        {points.map((p, i) => {
          const v1 = val(p, metric);
          const v2 = metric2 ? val(p, metric2) : null;
          const tip = metric2
            ? `${p.label} · ${metric} ${format(v1)} · ${metric2} ${format(v2 as number)}`
            : `${p.label} · ${format(v1)}`;
          return (
            <div
              key={i}
              title={tip}
              className="group flex-1 h-full flex items-end justify-center gap-0.5"
            >
              <div
                className="w-2.5 md:w-3 rounded-t bg-white transition-opacity group-hover:opacity-80"
                style={{ height: barHeight(v1) }}
              />
              {metric2 && (
                <div
                  className="w-1.5 md:w-2 rounded-t bg-zinc-500 transition-opacity group-hover:opacity-80"
                  style={{ height: barHeight(v2 as number) }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 mt-2">
        {points.map((p, i) => (
          <div key={i} className="flex-1 text-center">
            {i % step === 0 && (
              <span className="text-[10px] text-zinc-500 tabular-nums truncate block">
                {labels?.[i] ?? p.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ColumnChart;
