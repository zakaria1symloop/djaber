'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
        {...props}
      >
        {icon && (
          <div className="mb-4 text-zinc-600">
            {icon}
          </div>
        )}
        <h3
          className="text-lg font-semibold text-white mb-2"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {title}
        </h3>
        {description && (
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            {description}
          </p>
        )}
        {action}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
