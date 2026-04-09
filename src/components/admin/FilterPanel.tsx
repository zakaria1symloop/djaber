'use client';

import { ReactNode, useEffect } from 'react';
import { CloseIcon, FilterIcon } from '@/components/ui/icons';

/**
 * Right-side slide-in filter panel for admin pages.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <FilterPanelTrigger open={open} setOpen={setOpen} activeCount={3} />
 *   <FilterPanel open={open} onClose={() => setOpen(false)} title="Filters" onClear={...}>
 *     ... filter inputs ...
 *   </FilterPanel>
 */

export function FilterPanelTrigger({
  open,
  setOpen,
  activeCount = 0,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  activeCount?: number;
}) {
  return (
    <button
      onClick={() => setOpen(!open)}
      className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
        open
          ? 'bg-white text-black border-white'
          : 'bg-zinc-900/60 text-zinc-300 border-white/10 hover:border-white/20 hover:text-white'
      }`}
    >
      <FilterIcon className="w-4 h-4" />
      <span>Filters</span>
      {activeCount > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
          {activeCount}
        </span>
      )}
    </button>
  );
}

export function FilterPanel({
  open,
  onClose,
  title = 'Filters',
  onClear,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  onClear?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-zinc-950 border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {onClear && (
              <button
                onClick={onClear}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

        {/* Footer */}
        {footer && <div className="border-t border-white/10 p-4">{footer}</div>}
      </aside>
    </>
  );
}

/** Section header inside a filter panel */
export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

/** Pill-style filter chip */
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-white text-black border-white'
          : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}
