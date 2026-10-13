'use client';
// Skeletons of the public pages while the server renders them (12 §27 [S]); same column widths and section rhythm as
// the content they stand for, so nothing moves when it arrives.
import { PlanCardsSkeleton, Skeleton } from '@djaber/ui';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';

const Busy = ({ children, testid = 'public-skeleton' }: { children: ReactNode; testid?: string }) => {
  const t = useT();
  return (
    // at least one screen tall: the footer stays below the fold until the content of unknown length replaces the skeleton
    <div role="status" aria-label={t('common.loading')} aria-busy="true" className="flex min-h-[calc(100dvh-88px)] w-full flex-col" data-testid={testid}>
      {children}
    </div>
  );
};
const Band = ({ children }: { children: ReactNode }) => (
  <div className="w-full border-b border-line-hairline">
    <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-8 px-4 py-14 md:py-20">{children}</div>
  </div>
);
const Blocks = () => (
  <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} className="h-[150px] w-full" />
    ))}
  </div>
);

export function LandingSkeleton() {
  const t = useT();
  return (
    <Busy>
      <Band>
        <Skeleton className="h-9 w-[min(560px,90%)]" />
        <Skeleton className="h-4 w-[min(420px,80%)]" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </Band>
      <Band>
        <Skeleton className="h-8 w-48" />
        <Blocks />
      </Band>
      <Band>
        <Skeleton className="h-8 w-[min(520px,90%)]" />
        <div className="w-full">
          <PlanCardsSkeleton label={t('common.loading')} />
        </div>
      </Band>
    </Busy>
  );
}

export function FeaturesSkeleton() {
  return (
    <Busy>
      <Band>
        <Skeleton className="h-9 w-56" />
        <Blocks />
        <Skeleton className="h-10 w-36" />
      </Band>
    </Busy>
  );
}

export function PricingSkeleton() {
  const t = useT();
  return (
    <Busy>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-5 px-4 py-12">
        <Skeleton className="h-9 w-[min(620px,90%)]" />
        <Skeleton className="h-3 w-[min(520px,80%)]" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="w-full">
          <PlanCardsSkeleton label={t('common.loading')} />
        </div>
        <Skeleton className="h-3 w-[min(520px,80%)]" />
        <Skeleton className="h-[230px] w-full max-w-[760px]" />
      </div>
    </Busy>
  );
}

export function HelpSkeleton() {
  return (
    <Busy>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-10 md:py-12">
        <Skeleton className="mx-auto h-9 w-56" />
        <Skeleton className="mx-auto h-3 w-[min(480px,80%)]" />
        <Skeleton className="mx-auto h-10 w-full max-w-[640px]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[70px]" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Busy>
  );
}
