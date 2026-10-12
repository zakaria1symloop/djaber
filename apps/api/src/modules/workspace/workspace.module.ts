import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth-core.module';
import { UploadsModule } from '../uploads/uploads.module';
import { InvitationService } from './invitation.service';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { InvitationsController, MembersController } from './members.controller';
import { MembershipService } from './membership.service';
import { OwnershipTransferService } from './ownership-transfer.service';
import { ProvisioningService } from './provisioning.service';
import { QuickReplyController } from './quick-reply.controller';
import { QuickReplyRepository } from './quick-reply.repository';
import { QuickReplyService } from './quick-reply.service';
import { OnboardingService, SystemMessagesService } from './settings.service';
import { WorkspaceDeletionService } from './workspace-deletion.service';
import { WorkspaceController, WorkspacesController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

/** 01-nest-module-map §6 `workspace`: tenancy, members, invitations, settings, legal, onboarding, danger zone. */
@Module({
  imports: [AuthCoreModule, UploadsModule],
  controllers: [
    WorkspacesController,
    // literal sub-paths of `/workspace` (quick replies, members, invitations) are declared before the generic controller
    QuickReplyController,
    MembersController,
    WorkspaceController,
    InvitationsController,
    LegalController,
  ],
  providers: [
    ProvisioningService,
    WorkspaceService,
    MembershipService,
    InvitationService,
    OwnershipTransferService,
    QuickReplyRepository,
    QuickReplyService,
    SystemMessagesService,
    OnboardingService,
    LegalService,
    WorkspaceDeletionService,
  ],
  exports: [ProvisioningService, WorkspaceService, InvitationService, LegalService, WorkspaceDeletionService, OnboardingService],
})
export class WorkspaceModule {}
