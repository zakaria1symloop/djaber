'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
    warning: (m) => show(m, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100%-2rem)] sm:w-auto sm:min-w-[320px]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // trigger enter animation on next frame
    const f = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(f);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    window.setTimeout(() => onDismiss(toast.id), 200);
  };

  const variantStyles: Record<ToastVariant, { bg: string; border: string; iconColor: string; icon: ReactNode }> = {
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      iconColor: 'text-red-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      iconColor: 'text-yellow-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const v = variantStyles[toast.variant];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl backdrop-blur-md ${v.bg} border ${v.border} shadow-2xl transition-all duration-200 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <div className={`flex-shrink-0 w-6 h-6 rounded-full ${v.bg} ${v.iconColor} flex items-center justify-center mt-0.5`}>
        {v.icon}
      </div>
      <p className="flex-1 text-sm text-white leading-relaxed">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-zinc-500 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
