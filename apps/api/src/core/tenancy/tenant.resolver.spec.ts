import { resetConfigCache } from '../config/config.service';
import { twoFaExempt } from './tenant.resolver';

describe('D41 testing exemption (PLATFORM_2FA_EXEMPT_EMAILS)', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    resetConfigCache();
  });
  const withEnv = (nodeEnv: string, list: string) => {
    process.env.NODE_ENV = nodeEnv;
    process.env.PLATFORM_2FA_EXEMPT_EMAILS = list;
    resetConfigCache();
  };

  it('exempts only the listed e-mails, case-insensitively, outside production', () => {
    withEnv('staging', ' Super@Test.local , other@x.dz');
    expect(twoFaExempt('super@test.local')).toBe(true);
    expect(twoFaExempt('OTHER@x.dz')).toBe(true);
    expect(twoFaExempt('admin@djaber.local')).toBe(false);
  });
  it('exempts nobody when the list is empty', () => {
    withEnv('staging', '');
    expect(twoFaExempt('super@test.local')).toBe(false);
  });
  it('is ignored in production', () => {
    withEnv('production', 'super@test.local');
    expect(twoFaExempt('super@test.local')).toBe(false);
  });
});
