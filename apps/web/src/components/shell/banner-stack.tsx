'use client';
// One banner at a time, by priority (02-next-route-map §2.1, GLOBAL frame "Bandeaux").
import { Banner, type StateAction, type Tone } from '@djaber/ui';
import type { ReactNode } from 'react';

export const BANNER_PRIORITY = [
  'maintenance',
  'suspended',
  'reconnect',
  'credits100',
  'negativeCredits',
  'planExpired',
  'credits80',
  'planExpiring',
  'approvalPending',
  'emailUnverified',
  'readOnly',
  'newVersion',
  'offline',
  'announcement',
] as const;
export type BannerId = (typeof BANNER_PRIORITY)[number];

export type ShellBanner = {
  id: BannerId;
  tone: Tone;
  content: ReactNode;
  action?: StateAction;
  onDismiss?: () => void;
};

/** Picks the highest-priority banner of the list. */
export const pickBanner = (banners: ShellBanner[]): ShellBanner | undefined =>
  [...banners].sort((a, b) => BANNER_PRIORITY.indexOf(a.id) - BANNER_PRIORITY.indexOf(b.id))[0];

export function BannerStack({ banners, dismissLabel }: { banners: ShellBanner[]; dismissLabel: string }) {
  const b = pickBanner(banners);
  if (!b) return null;
  return (
    <div className="px-4 pt-3 md:px-8">
      <Banner tone={b.tone} action={b.action} onDismiss={b.onDismiss} dismissLabel={dismissLabel}>
        {b.content}
      </Banner>
    </div>
  );
}
