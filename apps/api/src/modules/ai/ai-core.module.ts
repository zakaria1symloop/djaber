import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service';
import { CatalogueService } from './catalogue.service';
import { createAiGateway } from './provider/ai-gateway.factory';
import { AI_GATEWAY } from './provider/ai.gateway';
import { RoutingService } from './routing.service';
import { RoutedImageCaptionProvider, RoutedProductVisionProvider, VisionService } from './vision.service';

/**
 * The provider side of the AI (04-ai-pipeline §6, §9): the port + its adapter, the platform routing, the agent-scoped
 * catalogue reads and vision. Global and free of feature-module imports, so the catalogue module can bind its caption /
 * create-from-photo providers to it without a module cycle.
 */
@Global()
@Module({
  providers: [
    {
      provide: AI_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const gateway = createAiGateway(config.all);
        new Logger('AiCoreModule').log(`AI adapter: ${gateway.driver}`);
        return gateway;
      },
    },
    RoutingService,
    CatalogueService,
    VisionService,
    RoutedImageCaptionProvider,
    RoutedProductVisionProvider,
  ],
  exports: [AI_GATEWAY, RoutingService, CatalogueService, VisionService, RoutedImageCaptionProvider, RoutedProductVisionProvider],
})
export class AiCoreModule {}
