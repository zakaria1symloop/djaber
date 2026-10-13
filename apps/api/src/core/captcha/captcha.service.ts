// M11 (M6 carry-over) — provider-agnostic captcha of the public forms ("Signaler ce vendeur").
// Drivers: `none` (no check), `fake` (dev / test: the token `fake-pass` passes, anything else fails), `turnstile`
// (Cloudflare Turnstile siteverify; refused in development / test unless CAPTCHA_ALLOW_LIVE=true, like the other live drivers).
// A missing / refused token ⇒ 422 VALIDATION_ERROR `fields.captchaToken = validation.captcha`.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { FAKE_CAPTCHA_PASS, type CaptchaConfigDto } from '@djaber/shared';
import { ConfigService } from '../config/config.service';
import { AppException } from '../errors/app.exception';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

@Injectable()
export class CaptchaService implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get('CAPTCHA_DRIVER') === 'turnstile' && !this.config.isProd && !this.config.get('CAPTCHA_ALLOW_LIVE')) {
      throw new Error('CAPTCHA_DRIVER=turnstile is refused in development / test: set CAPTCHA_DRIVER=fake (or CAPTCHA_ALLOW_LIVE=true if you really mean to call Cloudflare)');
    }
  }

  publicConfig(): CaptchaConfigDto {
    const provider = this.config.get('CAPTCHA_DRIVER');
    return { provider, siteKey: provider === 'turnstile' ? (this.config.get('CAPTCHA_SITE_KEY') ?? null) : null };
  }

  /** Throws `VALIDATION_ERROR` when the token is missing or refused. */
  async assert(token: string | null | undefined, ip: string | null) {
    const driver = this.config.get('CAPTCHA_DRIVER');
    if (driver === 'none') return;
    const fail = () => new AppException('VALIDATION_ERROR', {}, { captchaToken: 'validation.captcha' });
    if (!token) throw fail();
    if (driver === 'fake') {
      if (token !== FAKE_CAPTCHA_PASS) throw fail();
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const body = new URLSearchParams({ secret: this.config.get('CAPTCHA_SECRET') ?? '', response: token, ...(ip ? { remoteip: ip } : {}) });
      const res = await fetch(SITEVERIFY, { method: 'POST', body, signal: ctrl.signal });
      const r = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!r.success) throw fail();
    } catch (e) {
      if (e instanceof AppException) throw e;
      throw new AppException('PROVIDER_UNAVAILABLE', { provider: 'captcha' });
    } finally {
      clearTimeout(timer);
    }
  }
}
