// D51 / 04 §16 — POST /workspaces/:id/transfer-ownership { newOwnerUserId, password, totpCode? }
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext } from '@djaber/db';
import { AuditService } from '../../core/audit/audit.service';
import { ConfigService } from '../../core/config/config.service';
import { AppException, notFound } from '../../core/errors/app.exception';
import { MailOutbox } from '../../core/mail/mail.outbox';
import { OutboxService } from '../../core/outbox/outbox.service';
import { TenantResolver } from '../../core/tenancy/tenant.resolver';
import { ReauthService } from '../auth/reauth.service';
import type { ClientInfo } from '../auth/session.service';
import { NotificationProducer } from '../notifications/notification.producer';

@Injectable()
export class OwnershipTransferService {
  constructor(
    private readonly reauth: ReauthService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly mail: MailOutbox,
    private readonly tenants: TenantResolver,
    private readonly config: ConfigService,
    private readonly notifications: NotificationProducer,
  ) {}

  async transfer(workspaceId: string, input: { newOwnerUserId: string; password: string; totpCode?: string | null }, client: ClientInfo) {
    const t = TenantContext.get();
    if (workspaceId !== t.workspaceId) throw notFound(); // another workspace ⇒ 404, never 403

    // target must be an Admin member of this workspace who owns no workspace (one owned workspace per user, D30)
    const target = await prisma.membership.findFirst({ where: { userId: input.newOwnerUserId }, include: { user: true } });
    if (!target || target.role !== 'admin' || target.user.ownedWorkspaceId || target.user.status !== 'active') {
      throw new AppException('OWNERSHIP_TRANSFER_TARGET_INVALID', {}, { newOwnerUserId: 'validation.invalid' });
    }
    const owner = await this.reauth.assertPassword(t.userId!, input.password, 'AUTH_INVALID_CREDENTIALS');
    this.reauth.assertTotpIfEnabled(owner, input.totpCode);

    const workspace = await prisma.$transaction(async (tx) => {
      const ownerMembership = await tx.membership.findFirst({ where: { userId: owner.id, role: 'owner' } });
      if (!ownerMembership) throw new AppException('FORBIDDEN');
      // order matters: the partial unique index allows exactly one owner per workspace at any time
      await tx.membership.update({ where: { id: ownerMembership.id }, data: { role: 'admin' } });
      await tx.membership.update({ where: { id: target.id }, data: { role: 'owner', readOnly: false } });
      await tx.user.update({ where: { id: owner.id }, data: { ownedWorkspaceId: null, lastWorkspaceId: t.workspaceId } });
      await tx.user.update({ where: { id: target.userId }, data: { ownedWorkspaceId: t.workspaceId } });
      const ws = await tx.workspace.findUniqueOrThrow({ where: { id: t.workspaceId } });
      const names = {
        workspaceName: ws.name,
        newOwnerName: `${target.user.firstName} ${target.user.lastName}`.trim(),
        oldOwnerName: `${owner.firstName} ${owner.lastName}`.trim(),
      };
      const url = `${this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '')}/settings/members`;
      for (const u of [owner, target.user]) {
        await this.mail.send(
          {
            to: u.email,
            template: 'workspace/ownership-transferred',
            locale: u.locale,
            params: { ...names, url },
            key: `ownership:${ws.id}:${target.userId}:${u.id}:${Date.now()}`,
            workspaceId: ws.id,
          },
          tx,
        );
      }
      for (const m of [
        { id: ownerMembership.id, userId: owner.id, role: 'admin' },
        { id: target.id, userId: target.userId, role: 'owner' },
      ]) {
        await this.outbox.ws(tx, `ws:${ws.id}`, 'member.updated', { id: m.id, membership: { userId: m.userId, role: m.role, readOnly: false } });
        // 03-events §5.1 `member.role_changed`: both parties of the transfer
        await this.notifications.emit(tx, {
          type: 'member_role_changed',
          workspaceId: ws.id,
          userIds: [m.userId],
          key: `member_role_changed:${m.id}:transfer:${target.userId}:${Date.now()}`,
          data: { userId: m.userId, from: m.role === 'owner' ? 'admin' : 'owner', to: m.role, role: m.role },
        });
      }
      return ws;
    });
    await this.tenants.invalidate(workspace.id);
    await this.audit.write({
      workspaceId: workspace.id,
      actorType: 'user',
      actorId: owner.id,
      actorRole: 'owner',
      action: 'workspace.transfer_ownership',
      entity: 'Workspace',
      entityId: workspace.id,
      before: { ownerUserId: owner.id },
      after: { ownerUserId: target.userId },
      ip: client.ip,
      userAgent: client.userAgent,
    });
    return { workspaceId: workspace.id, ownerUserId: target.userId, previousOwnerUserId: owner.id };
  }
}
