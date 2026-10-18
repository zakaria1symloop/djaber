import { NO_LIMITS, TenantContext } from '@djaber/db';
import { freePlanName, pickLocal } from './admin.util';

const inRequest = <T>(requestLocale: 'fr' | 'ar' | 'en' | undefined, fn: () => T) =>
  TenantContext.run({ workspaceId: '', readOnly: false, locale: 'fr', stockMode: 'simple', suspended: false, limits: NO_LIMITS, bypass: true, requestLocale }, fn);

describe('admin names follow the language the admin is viewed in', () => {
  const name = { fr: 'Gratuit', ar: 'مجاني', en: 'Free' };
  it('picks the request language, also inside a system scope', () => {
    expect(inRequest('en', () => pickLocal(name))).toBe('Free');
    expect(inRequest('ar', () => TenantContext.runSystem(() => pickLocal(name)))).toBe('مجاني');
    expect(inRequest('en', () => TenantContext.runAs('w', () => freePlanName()))).toBe('Free');
  });
  it('falls back to French (empty translation, no request, no context)', () => {
    expect(inRequest('en', () => pickLocal({ fr: '500 crédits', ar: '', en: '' }))).toBe('500 crédits');
    expect(inRequest(undefined, () => pickLocal(name))).toBe('Gratuit');
    expect(pickLocal(name)).toBe('Gratuit');
  });
});
