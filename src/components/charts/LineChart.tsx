'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fmtNum } from './format';

export type LinePoint = { label: string } & Record<string, number | string>;

export interface LineSeries {
  key: string;
  label: string;
}

export interface LineChartProps {
  points: LinePoint[];
  /** One or two series. series[0] renders white, series[1] renders zinc. */
  series: LineSeries[];
  height?: number;
  format?: (n: number) => string;
}

const PAD_X = 10;
const PAD_Y = 14;
const SURFACE = '#0a0a0a';

/**
 * Responsive inline-SVG line chart. Single axis, 2px lines (white primary,
 * zinc secondary), a faint white area fill under the primary line, end dots
 * with a surface ring, and a crosshair + floating tooltip on hover.
 */
export function LineChart({ points, series, height = 220, format = fmtNum }: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(el.clientWidth || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const num = (p: LinePoint, k: string) => {
    const n = Number(p[k]);
    return Number.isFinite(n) ? n : 0;
  };

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = wrapRef.current;
      if (!el || points.length === 0) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const inner = Math.max(1, rect.width - PAD_X * 2);
      const ratio = (px - PAD_X) / inner;
      const idx = Math.round(ratio * (points.length - 1));
      setHover(Math.min(points.length - 1, Math.max(0, idx)));
    },
    [points.length],
  );

  if (!points || points.length === 0) {
    return (
      <div className="py-10 text-center" style={{ minHeight: height }}>
        <p className="text-sm font-bold text-white">No data yet</p>
        <p className="text-xs text-zinc-500 mt-1">The trend line will appear here as data comes in.</p>
      </div>
    );
  }

  const active = series.slice(0, 2);
  const allValues = active.flatMap((s) => points.map((p) => num(p, s.key)));
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min === max) {
    // Flat series — pad so the line sits mid-height.
    min -= 1;
    max += 1;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }
  const span = max - min || 1;

  const n = points.length;
  const x = (i: number) => (n === 1 ? w / 2 : PAD_X + (i / (n - 1)) * (w - PAD_X * 2));
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (height - PAD_Y * 2);

  const strokes = ['#ffffff', '#71717a'];

  const linePath = (key: string) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(num(p, key)).toFixed(2)}`).join(' ');

  const areaPath = (key: string) => {
    const top = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(num(p, key)).toFixed(2)}`)
      .join(' ');
    const baseY = (height - PAD_Y).toFixed(2);
    return `${top} L ${x(n - 1).toFixed(2)} ${baseY} L ${x(0).toFixed(2)} ${baseY} Z`;
  };

  const hoverPoint = hover != null ? points[hover] : null;
  // Keep the tooltip inside the plot; flip to the start side near the end edge.
  const tipLeft = hover != null ? x(hover) : 0;
  const flip = hover != null && tipLeft > w * 0.6;

  return (
    <div>
      {active.length > 1 && (
        <div className="flex items-center gap-4 mb-3 text-[11px] text-zinc-500">
          {active.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ backgroundColor: strokes[i] }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${w} ${height}`}
          preserveAspectRatio="none"
          className="block overflow-visible"
        >
          {/* hairline baseline */}
          <line
            x1={PAD_X}
            x2={w - PAD_X}
            y1={height - PAD_Y}
            y2={height - PAD_Y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />

          {/* area under primary */}
          <path d={areaPath(active[0].key)} fill="rgba(255,255,255,0.08)" stroke="none" />

          {/* secondary line first so primary sits on top */}
          {active[1] && (
            <path
              d={linePath(active[1].key)}
              fill="none"
              stroke={strokes[1]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* primary line */}
          <path
            d={linePath(active[0].key)}
            fill="none"
            stroke={strokes[0]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* crosshair */}
          {hover != null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_Y}
              y2={height - PAD_Y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          )}

          {/* hovered markers */}
          {hover != null &&
            active.map((s, i) => (
              <circle
                key={s.key}
                cx={x(hover)}
                cy={y(num(points[hover], s.key))}
                r={3.5}
                fill={strokes[i]}
                stroke={SURFACE}
                strokeWidth={2}
              />
            ))}

          {/* end dots with surface ring */}
          {active.map((s, i) => (
            <circle
              key={s.key}
              cx={x(n - 1)}
              cy={y(num(points[n - 1], s.key))}
              r={4.5}
              fill={strokes[i]}
              stroke={SURFACE}
              strokeWidth={2}
            />
          ))}
        </svg>

        {/* floating tooltip */}
        {hoverPoint && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[7rem] rounded-lg border border-white/10 bg-[#0c0c0e]/95 px-2.5 py-2 shadow-xl"
            style={{
              left: tipLeft,
              transform: `translateX(${flip ? '-100%' : '0'}) translateX(${flip ? '-8px' : '8px'})`,
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">{hoverPoint.label}</p>
            {active.map((s, i) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-400">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: strokes[i] }}
                  />
                  {s.label}
                </span>
                <span className="text-white tabular-nums">{format(num(hoverPoint, s.key))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LineChart;
