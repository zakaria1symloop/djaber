import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AccountDeletionService } from './account-deletion.service';
import { DataExportService } from './data-export.service';
import { AccountDeletionPublicController } from './account-deletion-public.controller';
import { AuthCoreModule } from './auth-core.module';
import { AuthController } from './auth.controller';
import { AuthScheduler } from './auth.scheduler';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';

/** 01-nest-module-map §6 `auth`: register / login / refresh / 2FA / e-mail tokens / sessions / profile. */
@Module({
  imports: [AuthCoreModule, WorkspaceModule, UploadsModule],
  controllers: [AuthController, MeController, AccountDeletionPublicController],
  providers: [AuthService, MeService, AccountDeletionService, DataExportService, AuthScheduler],
  exports: [AuthService, MeService, AccountDeletionService, DataExportService, AuthScheduler],
})
export class AuthModule {}
