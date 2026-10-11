// Every notification type renders without a raw `{placeholder}` given the parameters its producers send
// (NOTIFICATION_PARAMS). Table-driven from the enum and the catalogue: a new type or a new template placeholder is
// covered — and fails here — without touching this file.
import { getMessages, NotificationTypeValues, type AppLocale } from '@djaber/shared';
import type { NotificationType } from '@djaber/db';
import { missingNotificationParams, NOTIFICATION_PARAMS, NOTIFICATION_VARIANTS, notificationDeepLink, notificationGroup, notificationSlug, renderNotification } from './notification.catalog';

const LOCALES: AppLocale[] = ['fr', 'ar', 'en'];
const sample = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, ['stock', 'min', 'minutes', 'failures', 'used', 'limit', 'count', 'credits', 'imported', 'skipped', 'total', 'amount'].includes(k) ? 7 : `<${k}>`]));
const cases = NotificationTypeValues.flatMap((type) => LOCALES.map((locale) => [type, locale] as [NotificationType, AppLocale]));

describe('notification catalogue', () => {
  it('declares the text parameters of every enum value', () => {
    expect(Object.keys(NOTIFICATION_PARAMS).sort()).toEqual([...NotificationTypeValues].sort());
  });

  it.each(cases)('%s (%s) renders with its declared parameters, no placeholder left', (type, locale) => {
    const missing: string[] = [];
    const data = sample(NOTIFICATION_PARAMS[type]);
    expect(missingNotificationParams(type, data)).toEqual([]);
    const { title, body } = renderNotification(type, data, locale, (_t, p) => missing.push(p));
    expect(missing).toEqual([]); // every placeholder of the templates is a declared parameter
    expect(`${title}\n${body}`).not.toMatch(/[{}]/);
    expect(title.length).toBeGreaterThan(0);
    // each declared parameter is really used by a text of the type (no dead parameter) — in at least one locale
    if (locale === 'fr') {
      const templates = Object.entries(getMessages('fr'))
        .filter(([k]) => k.startsWith(`notification.${notificationSlug(type)}.`))
        .map(([, v]) => v)
        .join('\n');
      const variantParams = new Set((NOTIFICATION_VARIANTS[type] ?? []).flatMap((v) => v.params));
      for (const key of NOTIFICATION_PARAMS[type]) if (!variantParams.has(key) && templates) expect(templates).toContain(`{${key}`);
    }
  });

  it.each(Object.entries(NOTIFICATION_VARIANTS).flatMap(([type, variants]) => variants!.flatMap((v) => LOCALES.map((locale) => [type as NotificationType, v.suffix, locale] as const))))('variant %s.%s (%s) renders without a placeholder', (type, suffix, locale) => {
    const variant = NOTIFICATION_VARIANTS[type]!.find((v) => v.suffix === suffix)!;
    const data = { ...sample([...NOTIFICATION_PARAMS[type], ...variant.params]), kind: 'import' };
    expect(variant.when(data)).toBe(true);
    const missing: string[] = [];
    const { title, body } = renderNotification(type, data, locale, (_t, p) => missing.push(p));
    expect(missing).toEqual([]);
    expect(`${title}\n${body}`).not.toMatch(/[{}]/);
    expect(title).toBe(renderNotification(type, data, locale).title);
    expect(title).not.toBe(renderNotification(type, sample(NOTIFICATION_PARAMS[type]), locale).title); // the variant text, not the generic one
  });

  it('a parameter missing at runtime renders as an empty string and is reported with the type — never `{name}`', () => {
    const missing: [string, string][] = [];
    const out = renderNotification('stock_low', { stock: 3 }, 'fr', (t, p) => missing.push([t, p]));
    expect(out.title).toBe('Stock faible : (3 restants)');
    expect(out.body).toBe('Seuil : . Une seule alerte par jour et par produit.');
    expect(missing).toEqual([['stock_low', 'product'], ['stock_low', 'min']]);
    expect(missingNotificationParams('stock_low', { stock: 3 })).toEqual(['product', 'min']);
    // the default reporter only logs: nothing throws
    expect(() => renderNotification('stock_out', {}, 'fr')).not.toThrow();
  });

  it('what the producers send renders the expected texts', () => {
    expect(renderNotification('stock_low', { product: 'Robe kabyle · M', stock: 2, min: 5 }, 'fr')).toEqual({ title: 'Stock faible : Robe kabyle · M (2 restants)', body: 'Seuil : 5. Une seule alerte par jour et par produit.' });
    expect(renderNotification('stock_out', { product: 'Robe kabyle' }, 'fr').title).toBe('Rupture : Robe kabyle');
    // rows stored before the parameters were named like the placeholders still read correctly
    expect(renderNotification('stock_low', { name: 'Théière', stock: 1, minStock: 4 }, 'fr').title).toBe('Stock faible : Théière (1 restants)');
    expect(renderNotification('job_finished', { name: 'export', kind: 'export' }, 'fr').title).toBe('Tâche terminée : export');
    expect(renderNotification('job_finished', { label: 'product-import-commit', kind: 'import', imported: 12, skipped: 3 }, 'fr')).toEqual({
      title: 'Import terminé : 12 produits importés, 3 lignes ignorées',
      body: 'Téléchargez le rapport d\'erreurs pour corriger les 3 lignes.',
    });
    // member roles are shown with their label
    expect(renderNotification('member_role_changed', { role: 'admin' }, 'fr').title).toBe(`Votre rôle est maintenant ${getMessages('fr')['enum.Membership.role.admin']}`);
    expect(renderNotification('member_joined', { name: 'Amine Benali', role: 'operator' }, 'en').title).toContain(getMessages('en')['enum.Membership.role.operator']);
  });

  it('every type has a family and a deep link', () => {
    for (const type of NotificationTypeValues) {
      expect(notificationGroup(type)).toBeTruthy();
      const link = notificationDeepLink(type, {});
      expect(link.web.startsWith('/')).toBe(true);
      expect(link.mobile).toBe(`djaber://${link.web.slice(1)}`);
    }
  });
});
