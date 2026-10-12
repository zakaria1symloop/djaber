// Notification preferences calls (06 §2 `GET|PUT /notification-preferences`, api-contract §3.12) and the personal
// preference "son sur nouveau message" (`PATCH /me/prefs { soundOnMessage }`, 06 §8.1).
import type { NotificationPreferenceView } from '@djaber/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserPrefs } from '@/lib/contracts';
import { useWorkspaceId } from '@/lib/session';
import type { PrefPatch } from './preferences';

export const preferencesApi = {
  list: () => api<NotificationPreferenceView[]>('/notification-preferences'),
  /** answers the whole table (or nothing): the caller keeps its optimistic copy when no array comes back */
  update: (preferences: PrefPatch[]) => api<NotificationPreferenceView[] | null>('/notification-preferences', { method: 'PUT', body: { preferences } }),
  patchMyPrefs: (b: Partial<UserPrefs>) => api<UserPrefs | { prefs: UserPrefs } | null>('/me/prefs', { method: 'PATCH', body: b }),
};

export const preferencesKey = (ws: string) => [ws, 'notification-preferences'] as const;
export const usePreferences = () => {
  const ws = useWorkspaceId();
  return useQuery({ queryKey: preferencesKey(ws), queryFn: preferencesApi.list, enabled: !!ws });
};

/** `PATCH /me/prefs` may answer the prefs, `{ prefs }` or the whole user: read what is there. */
export const prefsOf = (r: unknown): Partial<UserPrefs> | null => {
  if (!r || typeof r !== 'object') return null;
  const o = r as { prefs?: Partial<UserPrefs> } & Partial<UserPrefs>;
  if (o.prefs && typeof o.prefs === 'object') return o.prefs;
  return 'soundOnMessage' in o || 'listDensity' in o ? o : null;
};
