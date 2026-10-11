import { Suspense, type ReactNode } from 'react';
import { OnboardingFrame } from '@/features/onboarding/onboarding-frame';

// OnboardingLayout — frames "ONB-01 — Onboarding — step 1…6".
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <OnboardingFrame>{children}</OnboardingFrame>
    </Suspense>
  );
}
