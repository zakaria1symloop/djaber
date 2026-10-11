// api-contract §1.2 "Sensitive actions": re-authentication by password and/or TOTP code in the body.
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext, type User } from '@djaber/db';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AppException } from '../../core/errors/app.exception';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class ReauthService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async user(userId: string): Promise<User> {
    const user = await TenantContext.runSystem(() => prisma.user.findFirst({ where: { id: userId, deletedAt: null } }));
    if (!user) throw new AppException('UNAUTHORIZED');
    return user;
  }

  /**
   * `AUTH_CURRENT_PASSWORD_INCORRECT` (422, inline on the field) for account dialogs;
   * `AUTH_INVALID_CREDENTIALS` where the spec names it (ownership transfer, 04 §16).
   */
  async assertPassword(
    userId: string,
    password: string,
    code: 'AUTH_CURRENT_PASSWORD_INCORRECT' | 'AUTH_INVALID_CREDENTIALS',
    field = 'password',
  ) {
    const user = await this.user(userId);
    if (!(await this.crypto.verifyPassword(user.passwordHash, password))) {
      throw new AppException(code, {}, { [field]: 'validation.invalid' });
    }
    return user;
  }

  /** 04 §16: `totpCode` is required when the user has 2FA enabled (missing or wrong ⇒ TWO_FA_CONFIRMATION_REQUIRED), ignored otherwise. */
  assertTotpIfEnabled(user: User, totpCode: string | undefined | null) {
    if (!user.totpEnabled) return;
    if (!totpCode || !this.twoFactor.verify(user, totpCode)) {
      throw new AppException('TWO_FA_CONFIRMATION_REQUIRED', {}, { totpCode: totpCode ? 'validation.invalid' : 'validation.required' });
    }
  }
}
