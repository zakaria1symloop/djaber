'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  /** Kept for API compatibility — all values collapse to the neutral chip scheme. */
  iconColor?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function StatsCard({ title, value, icon, iconColor }: StatsCardProps) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <div className="bg-white/5 text-zinc-300 rounded-lg p-1.5">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
