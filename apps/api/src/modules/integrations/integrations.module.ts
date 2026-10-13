import { Module } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service';
import { RedisService } from '../../core/redis/redis.provider';
import { ApiKeysService } from './api-keys.service';
import { DevGoogleController, DevWebhookReceiverController } from './dev-integrations.controllers';
import { ApiKeysController, SheetsController, WebhooksController } from './integrations.controllers';
import { FAKE_SHEETS } from './integrations.tokens';
import { SheetsSyncService } from './sheets/sheets-sync.service';
import { SHEETS_GATEWAY } from './sheets/sheets.gateway';
import { createSheetsGateway } from './sheets/sheets.provider';
import { SheetsService } from './sheets/sheets.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { WebhooksService } from './webhooks.service';

const SHEETS_BUNDLE = Symbol('SHEETS_BUNDLE');

/**
 * 01-nest-module-map `integrations` (M11): API keys (API-01/02), outbound webhooks (API-03: CRUD, HMAC, retries, deliveries
 * log, replay, auto-disable), Google Sheets (GSH-01…08) behind `SheetsGateway` (simulated Google unless SHEETS_DRIVER=google).
 * Registered last in FEATURE_MODULES so the literal inbound routes (`/webhooks/meta`, …) are matched before `/webhooks/:id`.
 */
@Module({
  controllers: [ApiKeysController, WebhooksController, SheetsController, DevGoogleController, DevWebhookReceiverController],
  providers: [
    { provide: SHEETS_BUNDLE, useFactory: (config: ConfigService, redis: RedisService) => createSheetsGateway(config.all, redis.client), inject: [ConfigService, RedisService] },
    { provide: SHEETS_GATEWAY, useFactory: (b: ReturnType<typeof createSheetsGateway>) => b.gateway, inject: [SHEETS_BUNDLE] },
    { provide: FAKE_SHEETS, useFactory: (b: ReturnType<typeof createSheetsGateway>) => b.fake, inject: [SHEETS_BUNDLE] },
    ApiKeysService,
    WebhookDispatchService,
    WebhooksService,
    SheetsSyncService,
    SheetsService,
  ],
  exports: [WebhookDispatchService, SheetsSyncService, FAKE_SHEETS],
})
export class IntegrationsModule {}
