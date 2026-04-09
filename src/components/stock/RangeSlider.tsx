'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  formatLabel?: (value: number) => string;
}

export function RangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  formatLabel = (v) => v.toLocaleString(),
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);
  const [localMin, setLocalMin] = useState(String(value[0]));
  const [localMax, setLocalMax] = useState(String(value[1]));

  useEffect(() => {
    setLocalMin(String(value[0]));
    setLocalMax(String(value[1]));
  }, [value]);

  const range = max - min || 1;
  const leftPercent = ((value[0] - min) / range) * 100;
  const rightPercent = ((value[1] - min) / range) * 100;

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * range;
      return Math.round(raw / step) * step;
    },
    [min, range, step],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const val = getValueFromPosition(e.clientX);
      const distToMin = Math.abs(val - value[0]);
      const distToMax = Math.abs(val - value[1]);
      // Grab whichever thumb is closer
      const thumb = distToMin <= distToMax ? 'min' : 'max';
      setDragging(thumb);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      if (thumb === 'min') {
        const clamped = Math.max(min, Math.min(val, value[1] - step));
        onChange([clamped, value[1]]);
      } else {
        const clamped = Math.min(max, Math.max(val, value[0] + step));
        onChange([value[0], clamped]);
      }
    },
    [getValueFromPosition, value, min, max, step, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const val = getValueFromPosition(e.clientX);
      if (dragging === 'min') {
        const clamped = Math.max(min, Math.min(val, value[1] - step));
        onChange([clamped, value[1]]);
      } else {
        const clamped = Math.min(max, Math.max(val, value[0] + step));
        onChange([value[0], clamped]);
      }
    },
    [dragging, getValueFromPosition, value, min, max, step, onChange],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const commitMin = () => {
    let v = Number(localMin);
    if (isNaN(v)) v = min;
    v = Math.max(min, Math.min(v, value[1] - step));
    v = Math.round(v / step) * step;
    onChange([v, value[1]]);
    setLocalMin(String(v));
  };

  const commitMax = () => {
    let v = Number(localMax);
    if (isNaN(v)) v = max;
    v = Math.min(max, Math.max(v, value[0] + step));
    v = Math.round(v / step) * step;
    onChange([value[0], v]);
    setLocalMax(String(v));
  };

  return (
    <div className="space-y-3">
      {/* Slider track — pointer-based, no overlapping inputs */}
      <div
        ref={trackRef}
        className="relative h-7 flex items-center cursor-pointer touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Background track */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-700" />
        {/* Active range */}
        <div
          className="absolute h-1.5 rounded-full bg-blue-500"
          style={{ left: `${leftPercent}%`, width: `${rightPercent - leftPercent}%` }}
        />
        {/* Min thumb */}
        <div
          className={`absolute w-[18px] h-[18px] rounded-full bg-white border-2 border-blue-500 shadow-md -translate-x-1/2 transition-shadow ${
            dragging === 'min' ? 'shadow-blue-500/30 shadow-lg scale-110' : 'hover:shadow-blue-500/20 hover:shadow-lg'
          }`}
          style={{ left: `${leftPercent}%` }}
        />
        {/* Max thumb */}
        <div
          className={`absolute w-[18px] h-[18px] rounded-full bg-white border-2 border-blue-500 shadow-md -translate-x-1/2 transition-shadow ${
            dragging === 'max' ? 'shadow-blue-500/30 shadow-lg scale-110' : 'hover:shadow-blue-500/20 hover:shadow-lg'
          }`}
          style={{ left: `${rightPercent}%` }}
        />
      </div>

      {/* Number inputs */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          onBlur={commitMin}
          onKeyDown={(e) => e.key === 'Enter' && commitMin()}
          min={min}
          max={value[1] - step}
          step={step}
          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs text-center focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-zinc-500 text-xs shrink-0">to</span>
        <input
          type="number"
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          onBlur={commitMax}
          onKeyDown={(e) => e.key === 'Enter' && commitMax()}
          min={value[0] + step}
          max={max}
          step={step}
          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs text-center focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      {/* Range labels */}
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  );
}
