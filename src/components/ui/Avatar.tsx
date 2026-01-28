'use client';

import { HTMLAttributes, forwardRef } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, initials, size = 'md', className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          relative rounded-full overflow-hidden flex-shrink-0
          bg-zinc-800 flex items-center justify-center
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-semibold text-white">
            {initials || '?'}
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
