import type { NotificationPreferenceView } from '@djaber/shared';
import { describe, expect, it } from 'vitest';
import { applyPatch, familyCell, familyPatch, familyRows, PREF_FAMILIES } from './preferences';

type Mode = NotificationPreferenceView['emailMode'];
const row = (type: NotificationPreferenceView['type'], group: NotificationPreferenceView['group'], o: { email?: boolean; push?: boolean; sound?: boolean; emailMode?: Mode; pushMode?: Mode; inApp?: boolean } = {}): NotificationPreferenceView => ({
  type,
  group,
  inApp: o.inApp ?? true,
  email: o.email ?? true,
  push: o.push ?? true,
  sound: o.sound ?? false,
  emailMode: o.emailMode ?? 'pref',
  pushMode: o.pushMode ?? 'pref',
});

const prefs = [
  row('stock_low', 'stock', { emailMode: 'pref', pushMode: 'never' }),
  row('stock_out', 'stock', { emailMode: 'pref', pushMode: 'never', email: false }),
  row('order_ai_created', 'orders', { emailMode: 'pref', pushMode: 'always' }),
  row('order_status_changed', 'orders', { emailMode: 'never', pushMode: 'never' }),
  row('member_joined', 'members', { emailMode: 'never', pushMode: 'never' }),
  row('account_verify_reminder', 'platform', { inApp: false, emailMode: 'always', pushMode: 'never' }),
];

describe('notification preference matrix (NTF-02)', () => {
  it('has the 11 rows of the frame, in its order', () => {
    expect(PREF_FAMILIES.map((f) => f.group)).toEqual(['orders', 'queue', 'ai', 'stock', 'parcels', 'payments', 'pages', 'credits_plan', 'members', 'integrations', 'jobs']);
  });
  it('lists the in-app types of a family only', () => {
    expect(familyRows(prefs, 'stock').map((r) => r.type)).toEqual(['stock_low', 'stock_out']);
    expect(familyRows(prefs, 'platform')).toEqual([]);
  });
  it('reads a cell: mixed when only some editable types are on, locked when none is editable', () => {
    expect(familyCell(prefs, 'stock', 'email')).toEqual({ value: false, mixed: true, locked: null });
    expect(familyCell(prefs, 'stock', 'push')).toEqual({ value: false, mixed: false, locked: 'never' });
    expect(familyCell(prefs, 'orders', 'push')).toEqual({ value: true, mixed: false, locked: 'always' });
    expect(familyCell(prefs, 'orders', 'email')).toEqual({ value: true, mixed: false, locked: null });
    expect(familyCell(prefs, 'members', 'email').locked).toBe('never');
    expect(familyCell(prefs, 'jobs', 'email')).toEqual({ value: false, mixed: false, locked: 'never' });
  });
  it('toggling a family writes every editable type of it (AT-NTF-04: e-mail off for stock.low)', () => {
    expect(familyPatch(prefs, 'stock', 'email', false)).toEqual([
      { type: 'stock_low', email: false },
      { type: 'stock_out', email: false },
    ]);
    // `always` / `never` cells are never sent
    expect(familyPatch(prefs, 'orders', 'push', false)).toEqual([]);
    expect(familyPatch(prefs, 'orders', 'email', false)).toEqual([{ type: 'order_ai_created', email: false }]);
  });
  it('sound is a per-member choice on every in-app type of the family', () => {
    expect(familyPatch(prefs, 'orders', 'sound', true).map((p) => p.type)).toEqual(['order_ai_created', 'order_status_changed']);
    expect(familyCell(prefs, 'orders', 'sound')).toEqual({ value: false, mixed: false, locked: null });
  });
  it('applies a patch optimistically without touching other channels', () => {
    const next = applyPatch(prefs, [{ type: 'stock_low', email: false }]);
    expect(next.find((p) => p.type === 'stock_low')).toMatchObject({ email: false, push: true });
    expect(familyCell(next, 'stock', 'email')).toEqual({ value: false, mixed: false, locked: null });
  });
});
