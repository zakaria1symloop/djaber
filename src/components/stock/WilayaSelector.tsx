'use client';

import { useState, useRef, useEffect } from 'react';

interface Wilaya {
  id: number;
  code: string;
  name: string;
  nameFr: string;
  nameEn: string;
}

interface WilayaSelectorProps {
  wilayas: Wilaya[];
  value: number | null;
  onChange: (wilayaId: number | null) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

export function WilayaSelector({
  wilayas,
  value,
  onChange,
  label,
  error,
  placeholder = 'Select wilaya...',
}: WilayaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = wilayas.find(w => w.id === value);

  const filtered = wilayas.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.code.includes(q) ||
      w.name.includes(q) ||
      w.nameFr.toLowerCase().includes(q) ||
      w.nameEn.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-zinc-400 mb-2">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          className={`
            w-full px-4 py-2.5 bg-black border rounded-lg text-left
            transition-all duration-200 ease-out
            focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
            ${error ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'}
          `}
        >
          {selected ? (
            <span className="text-white">
              {selected.code} - {selected.nameFr} ({selected.name})
            </span>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
          <svg
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
            <div className="p-2 border-b border-white/10">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search wilayas..."
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
                  placeholder:text-zinc-500"
              />
            </div>
            <div className="overflow-y-auto max-h-48">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
                >
                  Clear selection
                </button>
              )}
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-zinc-500">No wilayas found</div>
              ) : (
                filtered.map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onChange(w.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2 ${
                      w.id === value ? 'bg-white/10 text-white' : 'text-zinc-300'
                    }`}
                  >
                    <span className="text-zinc-500 w-6 text-right">{w.code}</span>
                    <span>{w.nameFr}</span>
                    <span className="text-zinc-500 text-xs mr-auto" dir="rtl">{w.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
