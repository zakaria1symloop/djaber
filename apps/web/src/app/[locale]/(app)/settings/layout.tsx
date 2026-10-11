import type { ReactNode } from 'react';
import { SettingsShell } from '@/features/settings/settings-shell';

// SettingsShell (02-next-route-map §2.2).
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
