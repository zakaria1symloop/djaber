'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-zinc-400 mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5 bg-black border rounded-lg text-white
            placeholder-zinc-500
            transition-all duration-200 ease-out
            focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
