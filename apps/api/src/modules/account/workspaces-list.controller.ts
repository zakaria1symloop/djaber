// api-contract — GET /workspaces: memberships of the current user (workspace picker).
import { Controller, Get } from '@nestjs/common';
import { prisma } from '@djaber/db';
import { Authenticated, CurrentUser, type AuthUser } from '../../core/auth/decorators';

@Controller('workspaces')
export class WorkspacesListController {
  @Get()
  @Authenticated()
  async list(@CurrentUser() user: AuthUser) {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, workspace: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      include: {
        workspace: {
          include: { subscriptions: { where: { status: { in: ['trial', 'active', 'dunning'] } }, include: { plan: true }, take: 1 } },
        },
      },
    });
    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      logoUrl: m.workspace.logoUrl,
      role: m.role,
      status: m.workspace.status,
      planSlug: m.workspace.subscriptions[0]?.plan.slug ?? 'free',
    }));
  }
}
