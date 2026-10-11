'use client';
// /onboarding/{welcome|stock-mode|first-product|agent|connect|ready} — ONB-01 (02-next-route-map §3.3).
import { useParams } from 'next/navigation';
import { OnboardingStep } from '@/features/onboarding/tunnel';
import { isOnboardingSlug } from '@/lib/guards';

export default function OnboardingStepPage() {
  const { step } = useParams<{ step: string }>();
  // unknown slugs are redirected to the saved step by the layout guard
  return isOnboardingSlug(step) ? <OnboardingStep slug={step} /> : null;
}
