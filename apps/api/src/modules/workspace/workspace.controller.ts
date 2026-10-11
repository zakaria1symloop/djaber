// 06-api "Workspace & team" + §8.1 — workspace profile/settings, onboarding, danger zone, ownership transfer.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Authenticated, CurrentUser, RequirePermission, type AuthUser } from '../../core/auth/decorators';
import { clientOf } from '../auth/session.service';
import type { UploadedFile as Incoming } from '../uploads/image-upload.service';
import { imageInterceptor } from '../uploads/uploads.controller';
import {
  CreateWorkspaceDto,
  DeleteWorkspaceDto,
  OnboardingDto,
  ResetSystemMessageDto,
  SystemMessagesDto,
  TransferOwnershipDto,
  UpdateWorkspaceDto,
} from './dto';
import { OwnershipTransferService } from './ownership-transfer.service';
import { OnboardingService, SystemMessagesService } from './settings.service';
import { WorkspaceDeletionService } from './workspace-deletion.service';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly transfers: OwnershipTransferService,
  ) {}

  /** Only when `ownedWorkspaceId` is null (D30); creates the same 14-day Pro trial as sign-up (D60). */
  @Post()
  @Authenticated()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto, @Req() req: any) {
    return this.workspaces.createForUser(user.id, dto, req.locale);
  }

  @Post(':id/transfer-ownership')
  @RequirePermission('workspace.transfer')
  @HttpCode(200)
  transfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferOwnershipDto, @Req() req: any) {
    return this.transfers.transfer(id, dto, clientOf(req));
  }
}

@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly deletion: WorkspaceDeletionService,
    private readonly onboarding: OnboardingService,
    private readonly systemMessages: SystemMessagesService,
  ) {}

  @Get()
  @RequirePermission('workspace.read')
  get(@Req() req: any) {
    return this.workspaces.get(req.locale);
  }

  @Patch()
  @RequirePermission('workspace.settings')
  update(@Body() dto: UpdateWorkspaceDto, @Req() req: any) {
    return this.workspaces.update(dto, req.locale, clientOf(req));
  }

  /** Direct logo upload (multipart `file`); the two-step flow `POST /uploads` + `PATCH /workspace { logoUploadId }` also works. */
  @Post('logo')
  @RequirePermission('workspace.settings')
  @HttpCode(200)
  @UseInterceptors(imageInterceptor())
  logo(@UploadedFile() file: Incoming | undefined, @Req() req: any) {
    return this.workspaces.setLogo(file, req.locale, clientOf(req));
  }

  @Delete()
  @RequirePermission('workspace.delete')
  @HttpCode(200)
  remove(@Body() dto: DeleteWorkspaceDto, @Req() req: any) {
    return this.deletion.schedule(dto, clientOf(req));
  }

  @Post('deletion/cancel')
  @RequirePermission('workspace.delete')
  @HttpCode(200)
  cancelDeletion(@Req() req: any) {
    return this.deletion.cancel(clientOf(req));
  }

  // --- onboarding (ONB-01 / ONB-02) ---------------------------------------------------------------------------------
  @Get('onboarding')
  @RequirePermission('workspace.read')
  getOnboarding() {
    return this.onboarding.get();
  }

  @Patch('onboarding')
  @RequirePermission('workspace.settings')
  setOnboarding(@Body() dto: OnboardingDto) {
    return this.onboarding.setStep(dto.step);
  }

  // --- system messages (11 §9.1) --------------------------------------------------------------------------------------
  @Get('system-messages')
  @RequirePermission('workspace.read')
  getSystemMessages() {
    return this.systemMessages.get();
  }

  @Put('system-messages')
  @RequirePermission('workspace.settings')
  putSystemMessages(@Body() dto: SystemMessagesDto) {
    return this.systemMessages.put(dto);
  }

  @Post('system-messages/reset')
  @RequirePermission('workspace.settings')
  @HttpCode(200)
  resetSystemMessage(@Body() dto: ResetSystemMessageDto) {
    return this.systemMessages.reset(dto.key);
  }
}
