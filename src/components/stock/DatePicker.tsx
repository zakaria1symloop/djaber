'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CalendarIcon } from '@/components/ui/icons';

interface DatePickerProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}

export function DatePicker({ value, onChange, label, placeholder = 'Select date', className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const parsed = parseDate(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  // Sync view when value changes externally
  useEffect(() => {
    const p = parseDate(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  // Calculate fixed position for dropdown
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 340;
    const top = spaceBelow >= dropdownHeight ? rect.bottom + 6 : rect.top - dropdownHeight - 6;
    const left = Math.min(rect.left, window.innerWidth - 290);
    setDropdownPos({ top, left });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = useCallback((day: number) => {
    onChange(formatDate(viewYear, viewMonth, day));
    setOpen(false);
  }, [viewYear, viewMonth, onChange]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const displayValue = parsed
    ? `${parsed.day} ${MONTH_NAMES[parsed.month]?.slice(0, 3)} ${parsed.year}`
    : '';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 bg-black border rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 min-w-[150px] ${
          open ? 'border-white/30 ring-2 ring-white/20' : 'border-white/10 hover:border-white/20'
        } ${displayValue ? 'text-white' : 'text-zinc-500'}`}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span className="flex-1 text-left truncate">{displayValue || placeholder}</span>
        {displayValue && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
          >
            &times;
          </span>
        )}
      </button>

      {open && dropdownPos && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-[280px] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-3 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {/* Month/Year nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-zinc-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDate(viewYear, viewMonth, day);
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all duration-100 ${
                    isSelected
                      ? 'bg-white text-black font-semibold'
                      : isToday
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => { onChange(todayStr); setOpen(false); }}
              className="w-full text-center text-xs text-zinc-400 hover:text-white py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
