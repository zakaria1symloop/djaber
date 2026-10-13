'use client';
// Platform role of the signed-in user and the UI mirror of the platform permission table (01 §3.2). The API enforces
// every key with `@RequirePlatformRole`; the UI hides write controls the role does not hold (02 §2.3).
import { platformCan, type PlatformPermission } from '@djaber/shared';
import { useCallback } from 'react';
import { useSession } from '@/lib/session';

export type PlatformRoleValue = 'super_admin' | 'support' | 'moderator' | 'finance' | 'read';

export function usePlatform() {
  const { me } = useSession();
  const role = (me?.platformRole && me.platformRole !== 'none' ? me.platformRole : null) as PlatformRoleValue | null;
  const can = useCallback((key: PlatformPermission) => platformCan(role, key), [role]);
  return { role, can, userId: me?.id ?? null };
}

/** Query-key root of every admin query (not workspace scoped). */
export const ADMIN_KEY = 'admin' as const;
