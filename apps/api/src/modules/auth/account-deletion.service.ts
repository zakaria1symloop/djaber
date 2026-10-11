// AUTH-07 / DEL-01…03 / 04 §16 — in-app account deletion request, 30-day grace, cancel, anonymisation at the date.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { prisma, TenantContext, type AccountDeletionRequest } from '@djaber/db';
import { AuditService } from '../../core/audit/audit.service';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AppException, notFound } from '../../core/errors/app.exception';
import { MailOutbox } from '../../core/mail/mail.outbox';
import { TenantResolver } from '../../core/tenancy/tenant.resolver';
import { ReauthService } from './reauth.service';
import { SessionService, type ClientInfo } from './session.service';

const DAY = 86_400_000;
type BlockedReason = 'ACCOUNT_OWNS_WORKSPACE' | 'WORKSPACE_HAS_DEBT';

export const toDeletionDto = (r: AccountDeletionRequest) => ({
  id: r.id,
  status: r.status,
  requestedAt: r.requestedAt.toISOString(),
  scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
  blockedReason: (r.blockedReason as BlockedReason | null) ?? null,
  exportUrl: null as string | null, // data export job (`GET /me/data-export`) arrives with the jobs module
});

@Injectable()
export class AccountDeletionService {
  private readonly log = new Logger(AccountDeletionService.name);
  constructor(
    private readonly reauth: ReauthService,
    private readonly sessions: SessionService,
    private readonly mail: MailOutbox,
    private readonly audit: AuditService,
    private readonly tenants: TenantResolver,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  /** `GET /me/deletion-request` — the open request (grace / blocked), `null` when there is none. */
  async current(userId: string) {
    const row = await TenantContext.runSystem(() =>
      prisma.accountDeletionRequest.findFirst({ where: { userId, status: { in: ['pending_confirmation', 'grace', 'blocked'] } } }),
    );
    return row ? toDeletionDto(row) : null;
  }

  /**
   * `POST /me/deletion-request { password, totpCode? }` → 202.
   * Guards (04 §16): owner of a live workspace ⇒ ACCOUNT_OWNS_WORKSPACE; unpaid invoice on an owned workspace ⇒
   * WORKSPACE_HAS_DEBT; a request already in grace ⇒ ACCOUNT_DELETION_PENDING. A guard hit is recorded as a
   * `blocked` request (admin queue "BLOQUÉE") and answered with the error.
   */
  async request(userId: string, input: { password: string; totpCode?: string | null }, client: ClientInfo) {
    const user = await this.reauth.assertPassword(userId, input.password, 'AUTH_CURRENT_PASSWORD_INCORRECT');
    this.reauth.assertTotpIfEnabled(user, input.totpCode);

    const outcome = await TenantContext.runSystem(async () => {
      const open = await prisma.accountDeletionRequest.findFirst({
        where: { userId, status: { in: ['pending_confirmation', 'grace', 'blocked'] } },
      });
      if (open?.status === 'grace') {
        return { error: new AppException('ACCOUNT_DELETION_PENDING', { scheduledAt: open.scheduledAt?.toISOString() ?? '' }) };
      }

      let blocked: { reason: BlockedReason; error: AppException } | null = null;
      if (user.ownedWorkspaceId) {
        const ws = await prisma.workspace.findUnique({ where: { id: user.ownedWorkspaceId } });
        // a workspace already in its own 30-day deletion grace no longer blocks (FL-14 comes first)
        if (ws && !ws.deletedAt && ws.status !== 'deletion_scheduled') {
          blocked = { reason: 'ACCOUNT_OWNS_WORKSPACE', error: new AppException('ACCOUNT_OWNS_WORKSPACE') };
        } else if (ws) {
          const debt = await prisma.invoice.aggregate({ where: { workspaceId: ws.id, status: 'unpaid' }, _sum: { amount: true } });
          if (debt._sum.amount) blocked = { reason: 'WORKSPACE_HAS_DEBT', error: new AppException('WORKSPACE_HAS_DEBT', { amount: debt._sum.amount }) };
        }
      }
      if (blocked) {
        const data = { status: 'blocked' as const, blockedReason: blocked.reason, ip: client.ip ?? null };
        if (open) await prisma.accountDeletionRequest.update({ where: { id: open.id }, data });
        else await prisma.accountDeletionRequest.create({ data: { userId, source: 'app', ...data } });
        return { error: blocked.error };
      }

      const now = new Date();
      const settings = await prisma.platformSetting.findUnique({ where: { key: 'limits' } });
      const days = (settings?.value as { deletionGraceDays?: number } | null)?.deletionGraceDays ?? 30;
      const scheduledAt = new Date(now.getTime() + days * DAY);
      const memberships = await prisma.membership.findMany({ where: { userId, role: { not: 'owner' } } });
      const row = await prisma.$transaction(async (tx) => {
        const data = { status: 'grace' as const, blockedReason: null, confirmedAt: now, scheduledAt, ip: client.ip ?? null };
        const req = open
          ? await tx.accountDeletionRequest.update({ where: { id: open.id }, data })
          : await tx.accountDeletionRequest.create({ data: { userId, source: 'app', ...data } });
        await tx.user.update({ where: { id: userId }, data: { status: 'deletion_scheduled' } });
        // memberships removed (assignments cleared, authored content kept); sessions and device tokens revoked
        for (const m of memberships) {
          await tx.conversation.updateMany({ where: { workspaceId: m.workspaceId, assigneeId: userId }, data: { assigneeId: null } });
          await tx.order.updateMany({ where: { workspaceId: m.workspaceId, assigneeId: userId }, data: { assigneeId: null } });
        }
        await tx.membership.deleteMany({ where: { userId, role: { not: 'owner' } } });
        await tx.deviceToken.deleteMany({ where: { userId } });
        await this.sessions.revokeAll(userId, {}, tx);
        await this.mail.send(
          {
            to: user.email,
            template: 'auth/account-deletion-confirm',
            locale: user.locale,
            params: { scheduledAt: scheduledAt.toISOString(), url: `${this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '')}/login` },
            key: `account-deletion:${req.id}:${now.getTime()}`,
          },
          tx,
        );
        return req;
      });
      for (const m of memberships) await this.tenants.invalidate(m.workspaceId);
      return { row };
    });
    if ('error' in outcome && outcome.error) throw outcome.error;
    await this.audit.write({ actorType: 'user', actorId: userId, action: 'account.deletion_requested', entity: 'User', entityId: userId, after: { scheduledAt: outcome.row!.scheduledAt?.toISOString() }, ip: client.ip, userAgent: client.userAgent });
    return toDeletionDto(outcome.row!);
  }

  /** `DELETE /me/deletion-request` — cancel during the grace period; memberships are not restored (04 §16). */
  async cancel(userId: string, client: ClientInfo) {
    const row = await TenantContext.runSystem(async () => {
      const open = await prisma.accountDeletionRequest.findFirst({ where: { userId, status: { in: ['pending_confirmation', 'grace', 'blocked'] } } });
      if (!open) throw notFound();
      return prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { status: 'active' } });
        return tx.accountDeletionRequest.update({ where: { id: open.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
      });
    });
    await this.audit.write({ actorType: 'user', actorId: userId, action: 'account.deletion_cancelled', entity: 'User', entityId: userId, ip: client.ip, userAgent: client.userAgent });
    return toDeletionDto(row);
  }

  /**
   * Part of `sched-workspace-purge`: requests past their grace ⇒ irreversible anonymisation (04 §16).
   * Safe to run twice: an anonymised request no longer matches.
   */
  async anonymiseDue(now = new Date()): Promise<number> {
    return TenantContext.runSystem(async () => {
      const due = await prisma.accountDeletionRequest.findMany({ where: { status: 'grace', scheduledAt: { lte: now } } });
      let done = 0;
      for (const req of due) {
        try {
          await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id: req.userId } });
            // an account that still owns a workspace is not anonymised: the request goes back to "blocked"
            if (user?.ownedWorkspaceId) {
              await tx.accountDeletionRequest.update({ where: { id: req.id }, data: { status: 'blocked', blockedReason: 'ACCOUNT_OWNS_WORKSPACE' } });
              return;
            }
            await tx.membership.deleteMany({ where: { userId: req.userId } });
            await tx.refreshToken.deleteMany({ where: { userId: req.userId } });
            await tx.deviceToken.deleteMany({ where: { userId: req.userId } });
            await tx.emailToken.deleteMany({ where: { userId: req.userId } });
            await tx.user.update({
              where: { id: req.userId },
              data: {
                firstName: 'Membre supprimé',
                lastName: '',
                email: `deleted+${req.userId}@anon.djaber.ai`,
                phone: null,
                avatarUrl: null,
                totpEnabled: false,
                totpSecret: null,
                recoveryCodes: [],
                passwordHash: this.crypto.sha256(randomUUID()), // not an argon2 hash: no password can match
                prefs: {},
                deletedAt: now,
              },
            });
            await tx.accountDeletionRequest.update({ where: { id: req.id }, data: { status: 'anonymised', processedAt: now } });
            done++;
          });
        } catch (e) {
          this.log.error({ requestId: req.id, err: String(e) }, 'account anonymisation failed');
        }
      }
      return done;
    });
  }
}
