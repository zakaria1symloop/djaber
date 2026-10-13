// ADM-13 (D39, D58): platform settings, app versions, feature flags, legal documents, Meta permissions / app, providers,
// maintenance and incident banner. The request gates (maintenance, version, feature) live in `core/platform`.
import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../../auth/auth-core.module';
import { ChannelsModule } from '../../channels/channels.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { SmsModule } from '../sms/sms.module';
import { AdminSettingsController, FeatureFlagsController } from './settings.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [AuthCoreModule, ChannelsModule, WorkspaceModule, SmsModule],
  controllers: [AdminSettingsController, FeatureFlagsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
