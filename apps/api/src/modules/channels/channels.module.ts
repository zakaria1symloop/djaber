import { Module } from '@nestjs/common';
import { ChannelJobs } from './channel-jobs.service';
import { ChannelService } from './channel.service';
import { ChannelEvents, ChannelTokens } from './channel.util';
import { ChannelsController } from './channels.controller';
import { ConnectService } from './connect.service';

/**
 * 01-nest-module-map `channels` (M3): OAuth connect (Facebook pages + linked Instagram, Instagram Business Login),
 * channel list / detail / pause / disconnect, insights cache, token refresh and health schedulers, App Review status.
 * Page analysis and agent assignment arrive with M4 (agents).
 */
@Module({
  controllers: [ChannelsController],
  providers: [ChannelTokens, ChannelEvents, ChannelService, ConnectService, ChannelJobs],
  exports: [ChannelTokens, ChannelEvents, ChannelService, ChannelJobs],
})
export class ChannelsModule {}
