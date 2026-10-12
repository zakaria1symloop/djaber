import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AiRunService } from './ai-run.service';
import { AiController, DevAiController } from './ai.controller';
import { InsightService } from './insight.service';
import { PlaygroundService } from './playground.service';
import { ReplyProcessor } from './reply.processor';
import { ORDER_TOOLS, UnavailableOrderTools } from './tools/order-tools';
import { ToolRegistry } from './tools/tool-registry';
import { TranscriptionService } from './transcription.service';
import { TurnContextService } from './turn-context.service';

/**
 * 01-nest-module-map `ai` (M4, 04-ai-pipeline): idempotent runs with tool replay, the `ai-reply / reply` job, voice
 * transcription, insights (creation side) and the playground dry run. The provider port, routing, catalogue reads and
 * vision live in the global `AiCoreModule`. `ORDER_TOOLS` is the seam of M5: the orders module rebinds it.
 */
@Module({
  imports: [ChannelsModule, MessagingModule],
  controllers: [AiController, DevAiController],
  providers: [{ provide: ORDER_TOOLS, useClass: UnavailableOrderTools }, ToolRegistry, AiRunService, TurnContextService, InsightService, TranscriptionService, ReplyProcessor, PlaygroundService],
  exports: [ORDER_TOOLS, ToolRegistry, AiRunService, TurnContextService, InsightService, TranscriptionService, ReplyProcessor, PlaygroundService],
})
export class AiModule {}
