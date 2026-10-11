// AUTH-05 — TOTP 2FA (otplib, 30 s step, ±1 step drift), 10 single-use recovery codes stored as SHA-256.
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { prisma, TenantContext, type User } from '@djaber/db';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AppException, conflict } from '../../core/errors/app.exception';

const totp = authenticator.clone({ window: 1, step: 30, digits: 6 });
const RECOVERY_CODES = 10;
const normalize = (code: string) => code.replace(/[\s-]/g, '').toLowerCase();

@Injectable()
export class TwoFactorService {
  constructor(private readonly crypto: CryptoService) {}

  private secretOf(user: Pick<User, 'totpSecret'>): string | null {
    if (!user.totpSecret) return null;
    try {
      return this.crypto.decrypt(Buffer.from(user.totpSecret).toString('utf8'));
    } catch {
      return null;
    }
  }

  /** Code of a secret at a given time (tests; `offsetSteps` = -1 / +1 exercises the drift window). */
  static codeFor(secret: string, offsetSteps = 0) {
    return authenticator.clone({ step: 30, digits: 6, epoch: Date.now() + offsetSteps * 30_000 }).generate(secret);
  }

  verify(user: Pick<User, 'totpSecret'>, code: string | undefined | null): boolean {
    const secret = this.secretOf(user);
    if (!secret || !code || !/^\d{6}$/.test(code.trim())) return false;
    return totp.check(code.trim(), secret);
  }

  /** Step 1: a new secret is stored (encrypted) but 2FA stays off until `enable` proves possession. */
  async setup(userId: string) {
    return TenantContext.runSystem(async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.totpEnabled) throw conflict();
      const secret = totp.generateSecret();
      await prisma.user.update({
        where: { id: userId },
        data: { totpSecret: Buffer.from(this.crypto.encrypt(secret), 'utf8') },
      });
      return { secret, otpauthUrl: totp.keyuri(user.email, 'Djaber', secret) };
    });
  }

  private newRecoveryCodes() {
    const codes = Array.from({ length: RECOVERY_CODES }, () => {
      const raw = randomBytes(5).toString('hex');
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    return { codes, hashes: codes.map((c) => this.crypto.sha256(normalize(c))) };
  }

  /** Step 2: valid code ⇒ 2FA on + the 10 recovery codes (shown once). */
  async enable(userId: string, code: string) {
    return TenantContext.runSystem(async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.totpEnabled) throw conflict();
      if (!this.verify(user, code)) throw new AppException('AUTH_2FA_INVALID', {}, { code: 'validation.invalid' });
      const { codes, hashes } = this.newRecoveryCodes();
      await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true, recoveryCodes: hashes } });
      return { recoveryCodes: codes };
    });
  }

  async disable(userId: string) {
    await TenantContext.runSystem(() =>
      prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null, recoveryCodes: [] } }),
    );
  }

  async regenerateRecoveryCodes(userId: string) {
    const { codes, hashes } = this.newRecoveryCodes();
    await TenantContext.runSystem(() => prisma.user.update({ where: { id: userId }, data: { recoveryCodes: hashes } }));
    return { recoveryCodes: codes };
  }

  /** A recovery code works once: it is removed atomically when it matches. */
  async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hash = this.crypto.sha256(normalize(code));
    return TenantContext.runSystem(() =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ recoveryCodes: unknown }[]>`SELECT "recoveryCodes" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        const list = Array.isArray(rows[0]?.recoveryCodes) ? (rows[0]!.recoveryCodes as string[]) : [];
        if (!list.includes(hash)) return false;
        await tx.user.update({ where: { id: userId }, data: { recoveryCodes: list.filter((h) => h !== hash) } });
        return true;
      }),
    );
  }
}
