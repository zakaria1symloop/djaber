'use client';

/**
 * Reusable loader components.
 *
 * - <Spinner />        : a small inline spinner
 * - <PageLoader />     : a centered fullscreen loader for entire pages
 * - <Skeleton />       : a single shimmering placeholder block
 * - <SkeletonCard />   : a card-shaped skeleton
 * - <SkeletonTable />  : a 6-row table skeleton
 */

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin text-current`}
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function PageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <div className="relative w-10 h-10">
        {/* outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        {/* spinning arc */}
        <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent border-r-transparent animate-spin" />
      </div>
      <p className="text-xs text-zinc-500 tracking-wider uppercase">{message}</p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-zinc-900/50 border border-white/5 rounded-lg ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-28 ${className}`} />;
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-4 ${
            i < rows - 1 ? 'border-b border-white/5' : ''
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-white/5 rounded" />
            <div className="h-2 w-1/4 bg-white/[0.03] rounded" />
          </div>
          <div className="h-6 w-16 bg-white/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
