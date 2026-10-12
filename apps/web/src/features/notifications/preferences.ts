// Notification preferences (NTF-02, Figma "SET — Settings — … Notifications" › "Préférences de notifications (vous)"):
// one row per family of the frame × IN-APP (always on) / E-MAIL / PUSH / SON. The API stores one row per
// `NotificationType` (`NotificationPreferenceView`, with the 03 §15 modes): a family cell reads and writes every type
// of the family. `always` cells are on and locked, `never` cells are off and locked (—). Pure functions, unit tested.
import type { NotificationGroup, NotificationPreferenceView } from '@djaber/shared';
import { groupOfType } from './logic';

/** The 11 rows of the frame, in its order. Families without a row (moderation, safety, support, platform) keep their defaults. */
export const PREF_FAMILIES: readonly { group: NotificationGroup; labelKey: string }[] = [
  { group: 'orders', labelKey: 'notifPrefs.family.orders' },
  { group: 'queue', labelKey: 'notifPrefs.family.queue' },
  { group: 'ai', labelKey: 'notifPrefs.family.ai' },
  { group: 'stock', labelKey: 'notifPrefs.family.stock' },
  { group: 'parcels', labelKey: 'notifPrefs.family.parcels' },
  { group: 'payments', labelKey: 'notifPrefs.family.payments' },
  { group: 'pages', labelKey: 'notifPrefs.family.pages' },
  { group: 'credits_plan', labelKey: 'notifPrefs.family.credits_plan' },
  { group: 'members', labelKey: 'notifPrefs.family.members' },
  { group: 'integrations', labelKey: 'notifPrefs.family.integrations' },
  { group: 'jobs', labelKey: 'notifPrefs.family.jobs' },
];

export type PrefChannel = 'email' | 'push' | 'sound';
export type PrefCell = { value: boolean; mixed: boolean; locked: 'always' | 'never' | null };
export type PrefPatch = { type: NotificationPreferenceView['type']; email?: boolean; push?: boolean; sound?: boolean };

const familyOf = (p: Pick<NotificationPreferenceView, 'type' | 'group'>): NotificationGroup | null => p.group ?? groupOfType(p.type);
/** In-app types of a family (e-mail / push only types have no row in the table). */
export const familyRows = (prefs: readonly NotificationPreferenceView[], group: NotificationGroup) => prefs.filter((p) => p.inApp && familyOf(p) === group);

/** Rows of a family whose cell can be changed by the member for this channel. */
const editable = (rows: readonly NotificationPreferenceView[], channel: PrefChannel) =>
  channel === 'sound' ? rows : rows.filter((r) => (channel === 'email' ? r.emailMode : r.pushMode) === 'pref');

/** State of a family cell: on when every editable type is on, "mixed" when only some are, locked when none is editable. */
export function familyCell(prefs: readonly NotificationPreferenceView[], group: NotificationGroup, channel: PrefChannel): PrefCell {
  const rows = familyRows(prefs, group);
  if (!rows.length) return { value: false, mixed: false, locked: 'never' };
  const open = editable(rows, channel);
  if (!open.length) {
    const always = rows.some((r) => (channel === 'email' ? r.emailMode : r.pushMode) === 'always');
    return always ? { value: true, mixed: false, locked: 'always' } : { value: false, mixed: false, locked: 'never' };
  }
  const on = open.filter((r) => r[channel]).length;
  return { value: on === open.length, mixed: on > 0 && on < open.length, locked: null };
}

/** `PUT /notification-preferences` body items for one family cell (only the editable types change). */
export const familyPatch = (prefs: readonly NotificationPreferenceView[], group: NotificationGroup, channel: PrefChannel, value: boolean): PrefPatch[] =>
  editable(familyRows(prefs, group), channel).map((r) => ({ type: r.type, [channel]: value }));

/** Optimistic copy of the table after a patch (rolled back if the server refuses). */
export const applyPatch = (prefs: readonly NotificationPreferenceView[], patch: readonly PrefPatch[]): NotificationPreferenceView[] => {
  const byType = new Map(patch.map((p) => [p.type, p]));
  return prefs.map((p) => {
    const c = byType.get(p.type);
    if (!c) return p;
    return { ...p, ...(c.email !== undefined ? { email: c.email } : {}), ...(c.push !== undefined ? { push: c.push } : {}), ...(c.sound !== undefined ? { sound: c.sound } : {}) };
  });
};
