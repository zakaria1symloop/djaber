// AUTH-01…05, 08, 09 — register, login (+ 2FA step), refresh, logout, forgot / reset password, e-mail verification.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { prisma, TenantContext, type DevicePlatform, type User } from '@djaber/db';
import type { AppLocale } from '@djaber/shared';
import { AuditService } from '../../core/audit/audit.service';
import { TokenService } from '../../core/auth/token.service';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AppException } from '../../core/errors/app.exception';
import { MailOutbox } from '../../core/mail/mail.outbox';
import { RedisService } from '../../core/redis/redis.provider';
import { TenantResolver } from '../../core/tenancy/tenant.resolver';
import { RateLimitGuard } from '../../core/throttle/rate-limit.guard';
import { InvitationService } from '../workspace/invitation.service';
import { LegalService } from '../workspace/legal.service';
import { defaultWorkspaceName, ProvisioningService } from '../workspace/provisioning.service';
import type { LoginInput, RegisterInput } from './dto';
import { EmailTokenService } from './email-token.service';
import { MeService } from './me.service';
import { SessionService, type ClientInfo, type IssuedTokens } from './session.service';
import { TwoFactorService } from './two-factor.service';

const LOGIN_LIMIT = { name: 'auth-login', max: 5, windowSeconds: 15 * 60 };
const MFA_LIMIT = { name: 'auth-2fa', max: 5, windowSeconds: 15 * 60 };
const MFA_TTL_S = 5 * 60;
const RESEND_COOLDOWN_S = 60;

export type AuthClient = ClientInfo & { platform: DevicePlatform; locale: AppLocale };
export type AuthResult = { kind: 'tokens'; tokens: IssuedTokens; user: Awaited<ReturnType<MeService['me']>> } | { kind: 'mfa'; mfaToken: string };

const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly crypto: CryptoService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly emailTokens: EmailTokenService,
    private readonly me: MeService,
    private readonly provisioning: ProvisioningService,
    private readonly invitations: InvitationService,
    private readonly legal: LegalService,
    private readonly mail: MailOutbox,
    private readonly audit: AuditService,
    private readonly limiter: RateLimitGuard,
    private readonly redis: RedisService,
    private readonly tenants: TenantResolver,
    private readonly config: ConfigService,
  ) {}

  private web(path: string) {
    return `${this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '')}${path}`;
  }

  private async tokensFor(user: User, client: AuthClient): Promise<AuthResult> {
    const tokens = await this.sessions.issue(user, client);
    await TenantContext.runSystem(() =>
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastSeenPlatform: client.platform } }),
    );
    return { kind: 'tokens', tokens, user: await this.me.me(user.id, undefined, undefined) };
  }

  // --- AUTH-01 register ---------------------------------------------------------------------------------------------
  async register(input: RegisterInput, client: AuthClient): Promise<AuthResult> {
    const locale = input.locale ?? client.locale;
    const passwordHash = await this.crypto.hashPassword(input.password);
    const invitation = input.invitationToken ? await this.invitations.byToken(input.invitationToken) : null;
    if (invitation && invitation.email !== input.email) throw new AppException('INVITATION_EMAIL_MISMATCH', { email: invitation.email });

    let user: User;
    try {
      user = await TenantContext.runSystem(() =>
        prisma.$transaction(async (tx) => {
          if (await tx.user.findUnique({ where: { email: input.email } })) throw new AppException('AUTH_EMAIL_TAKEN');
          const created = await tx.user.create({
            data: { email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, locale },
          });
          if (invitation) {
            // D30: sign-up through an invitation creates no workspace; the token proves the mailbox ⇒ verified
            await this.invitations.acceptInTx(tx, invitation, created);
            await this.legal.acceptCurrent(tx, created.id, invitation.role === 'admin' ? ['terms', 'privacy', 'content_rules'] : ['terms', 'privacy'], client.ip ?? null, client.platform);
          } else {
            await this.provisioning.createWorkspace(tx, {
              ownerId: created.id,
              name: input.workspaceName ?? defaultWorkspaceName(input.firstName, locale),
              locale,
            });
            await this.legal.acceptCurrent(tx, created.id, ['terms', 'privacy', 'content_rules'], client.ip ?? null, client.platform);
            const token = await this.emailTokens.create(created.id, 'verify', undefined, tx);
            await this.mail.send(
              {
                to: created.email,
                template: 'auth/verify',
                locale,
                params: { firstName: created.firstName },
                secret: { url: this.web(`/verify-email?token=${token}`) },
                key: `verify:${created.id}:signup`,
              },
              tx,
            );
          }
          return tx.user.findUniqueOrThrow({ where: { id: created.id } });
        }),
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppException('AUTH_EMAIL_TAKEN');
      throw e;
    }
    if (invitation) await this.tenants.invalidate(invitation.workspaceId);
    return this.tokensFor(user, client);
  }

  // --- AUTH-02 login ------------------------------------------------------------------------------------------------
  /** Unknown e-mail and wrong password cost the same argon2 verification and return the same error (AT-AUTH-03). */
  private async checkCredentials(emailAddress: string, password: string): Promise<User | null> {
    const user = await TenantContext.runSystem(() => prisma.user.findUnique({ where: { email: emailAddress } }));
    this.dummyHash ??= this.crypto.hashPassword(randomUUID());
    const ok = await this.crypto.verifyPassword(user && !user.deletedAt ? user.passwordHash : await this.dummyHash, password);
    return ok && user && !user.deletedAt ? user : null;
  }

  async login(input: LoginInput, client: AuthClient): Promise<AuthResult> {
    // AUTH-08: 5 failures / 15 min / IP+email; the 6th attempt answers 429 with retryAfter
    const subject = `${client.ip ?? 'unknown'}:${input.email}`;
    await this.limiter.assertBelow(LOGIN_LIMIT.name, subject, LOGIN_LIMIT.max, LOGIN_LIMIT.windowSeconds);
    const user = await this.checkCredentials(input.email, input.password);
    if (!user) {
      await this.limiter.hit(LOGIN_LIMIT.name, subject, LOGIN_LIMIT.max + 1, LOGIN_LIMIT.windowSeconds);
      throw new AppException('AUTH_INVALID_CREDENTIALS');
    }
    await this.limiter.reset(LOGIN_LIMIT.name, subject);
    if (user.status === 'blocked') throw new AppException('AUTH_USER_BLOCKED');
    if (user.totpEnabled) return { kind: 'mfa', mfaToken: await this.issueMfaToken(user.id) };
    return this.tokensFor(user, client);
  }

  // --- AUTH-05 2FA login step -------------------------------------------------------------------------------------------
  private issueMfaToken(userId: string) {
    return this.tokens.signPurpose('mfa', { sub: userId, jti: randomUUID() }, MFA_TTL_S);
  }

  /** `POST /auth/2fa/verify { mfaToken, code | recoveryCode }` — mfaToken: 5 min, single use, 5 attempts / 15 min. */
  async verifyMfa(input: { mfaToken: string; code?: string; recoveryCode?: string }, client: AuthClient): Promise<AuthResult> {
    let claims: { sub: string; jti: string };
    try {
      claims = await this.tokens.verifyPurpose<{ sub: string; jti: string }>(input.mfaToken, 'mfa');
    } catch {
      throw new AppException('AUTH_MFA_TOKEN_EXPIRED');
    }
    const usedKey = `mfa:used:${claims.jti}`;
    if (await this.redis.client.exists(usedKey)) throw new AppException('AUTH_MFA_TOKEN_EXPIRED');
    await this.limiter.hit(MFA_LIMIT.name, claims.jti, MFA_LIMIT.max, MFA_LIMIT.windowSeconds);

    const user = await TenantContext.runSystem(() => prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null } }));
    if (!user || !user.totpEnabled) throw new AppException('AUTH_MFA_TOKEN_EXPIRED');
    if (user.status === 'blocked') throw new AppException('AUTH_USER_BLOCKED');

    const ok = input.code
      ? this.twoFactor.verify(user, input.code)
      : input.recoveryCode
        ? await this.twoFactor.consumeRecoveryCode(user.id, input.recoveryCode)
        : false;
    if (!ok) throw new AppException('AUTH_2FA_INVALID', {}, { [input.code ? 'code' : 'recoveryCode']: 'validation.invalid' });

    // single use: only the first successful verification gets tokens
    const first = await this.redis.client.set(usedKey, '1', 'EX', MFA_TTL_S + 60, 'NX');
    if (!first) throw new AppException('AUTH_MFA_TOKEN_EXPIRED');
    return this.tokensFor(user, client);
  }

  // --- refresh / logout -------------------------------------------------------------------------------------------------
  async refresh(rawToken: string, client: ClientInfo) {
    return this.sessions.rotate(rawToken, client);
  }

  /** `POST /auth/logout?all` — revokes the session of the presented refresh token (or of the access token), or all of them. */
  async logout(opts: { rawToken?: string; userId?: string; sessionId?: string; all: boolean }) {
    const family = opts.rawToken ? await this.sessions.familyOf(opts.rawToken) : null;
    const userId = opts.userId ?? family?.userId;
    if (!userId) return;
    if (opts.all) await this.sessions.revokeAll(userId);
    else {
      const familyId = family?.familyId ?? opts.sessionId;
      if (familyId) await this.sessions.revokeFamily(userId, familyId);
    }
  }

  // --- AUTH-03 forgot / reset -------------------------------------------------------------------------------------------
  /** Always answers the same; a mail is sent only when the account exists and no link was sent in the last 60 s. */
  async forgotPassword(emailAddress: string) {
    await TenantContext.runSystem(async () => {
      const user = await prisma.user.findUnique({ where: { email: emailAddress } });
      if (!user || user.deletedAt || user.status === 'blocked') return;
      const cooldown = await this.redis.client.set(`cooldown:reset:${user.id}`, '1', 'EX', RESEND_COOLDOWN_S, 'NX');
      if (!cooldown) return;
      await prisma.$transaction(async (tx) => {
        const token = await this.emailTokens.create(user.id, 'reset', undefined, tx);
        await this.mail.send(
          { to: user.email, template: 'auth/reset', locale: user.locale, secret: { url: this.web(`/reset-password?token=${token}`) }, key: `reset:${user.id}:${Date.now()}` },
          tx,
        );
      });
    });
  }

  /** `GET /auth/reset-password/:token` — the reset page validates the link before showing the form. */
  async checkResetToken(token: string) {
    const row = await this.emailTokens.peek(token, 'reset');
    return { valid: true, expiresAt: row.expiresAt.toISOString() };
  }

  /** `POST /auth/reset-password` — single use; revokes every session, then signs the user in (2FA step kept when enabled). */
  async resetPassword(token: string, newPassword: string, client: AuthClient): Promise<AuthResult> {
    const passwordHash = await this.crypto.hashPassword(newPassword);
    const user = await TenantContext.runSystem(() =>
      prisma.$transaction(async (tx) => {
        const row = await this.emailTokens.consume(token, 'reset', tx);
        const u = await tx.user.findUniqueOrThrow({ where: { id: row.userId } });
        // the link was received in the mailbox: it also proves the e-mail address
        const updated = await tx.user.update({
          where: { id: u.id },
          data: { passwordHash, ...(u.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) },
        });
        await this.sessions.revokeAll(u.id, {}, tx);
        return updated;
      }),
    );
    await this.audit.write({ actorType: 'user', actorId: user.id, action: 'auth.password_reset', entity: 'User', entityId: user.id, ip: client.ip, userAgent: client.userAgent });
    if (user.status === 'blocked') throw new AppException('AUTH_USER_BLOCKED');
    if (user.totpEnabled) return { kind: 'mfa', mfaToken: await this.issueMfaToken(user.id) };
    return this.tokensFor(user, client);
  }

  // --- AUTH-09 e-mail verification (and confirmation of an e-mail change) ---------------------------------------------------
  /** `POST /auth/verify-email { token }` — handles both the sign-up verification link and the e-mail-change link. */
  async verifyEmail(token: string, client: ClientInfo) {
    const result = await TenantContext.runSystem(() =>
      prisma.$transaction(async (tx) => {
        const found = await tx.emailToken.findUnique({ where: { tokenHash: this.crypto.sha256(token) } });
        if (found?.kind === 'change_email') {
          const row = await this.emailTokens.consume(token, 'change_email', tx);
          const newEmail = String((row.payload as { newEmail?: string } | null)?.newEmail ?? '');
          if (!newEmail) throw new AppException('AUTH_VERIFY_TOKEN_EXPIRED');
          if (await tx.user.findUnique({ where: { email: newEmail } })) throw new AppException('AUTH_EMAIL_TAKEN');
          const before = await tx.user.findUniqueOrThrow({ where: { id: row.userId } });
          const u = await tx.user.update({ where: { id: row.userId }, data: { email: newEmail, emailVerifiedAt: new Date() } });
          return { user: u, changedFrom: before.email };
        }
        const row = await this.emailTokens.consume(token, 'verify', tx);
        const u = await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
        return { user: u, changedFrom: null as string | null };
      }),
    ).catch((e) => {
      if (isUniqueViolation(e)) throw new AppException('AUTH_EMAIL_TAKEN');
      throw e;
    });
    if (result.changedFrom) {
      await this.audit.write({ actorType: 'user', actorId: result.user.id, action: 'auth.email_change', entity: 'User', entityId: result.user.id, ip: client.ip, userAgent: client.userAgent });
    }
    return { email: result.user.email, emailVerifiedAt: result.user.emailVerifiedAt!.toISOString() };
  }

  /** `POST /auth/verify-email/resend` — 60 s cooldown (RATE_LIMITED with retryAfter). */
  async resendVerification(userId: string) {
    const user = await TenantContext.runSystem(() => prisma.user.findFirst({ where: { id: userId, deletedAt: null } }));
    if (!user) throw new AppException('UNAUTHORIZED');
    if (user.emailVerifiedAt) return { sent: false, emailVerifiedAt: user.emailVerifiedAt.toISOString() };
    await this.limiter.hit('verify-resend', user.id, 1, RESEND_COOLDOWN_S);
    await this.sendVerification(user, 'auth/verify', `verify:${user.id}:${Date.now()}`);
    return { sent: true, emailVerifiedAt: null };
  }

  async sendVerification(user: User, template: 'auth/verify' | 'auth/verify-reminder', key: string) {
    await TenantContext.runSystem(() =>
      prisma.$transaction(async (tx) => {
        const token = await this.emailTokens.create(user.id, 'verify', undefined, tx);
        await this.mail.send(
          { to: user.email, template, locale: user.locale, params: { firstName: user.firstName }, secret: { url: this.web(`/verify-email?token=${token}`) }, key },
          tx,
        );
      }),
    );
  }
}
