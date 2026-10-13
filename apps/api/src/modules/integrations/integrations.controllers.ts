// M11 — Settings › Intégrations (06 §2 "Integrations", §8.10; route map `/settings/integrations/[tab]`).
// Permission `integrations.manage` (Owner + Admin, 06 §9). API keys may manage webhooks with `webhooks:manage` (06 §5);
// API keys and Google Sheets are never reachable with an API key.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateApiKeySchema,
  CreateWebhookSchema,
  PutSheetsSchema,
  SheetsBackfillSchema,
  SheetsConnectQuerySchema,
  UpdateWebhookSchema,
  WebhookDeliveriesQuerySchema,
} from '@djaber/shared';
import { ApiScopes, Idempotent, Public, RequirePermission } from '../../core/auth/decorators';
import { ApiKeysService } from './api-keys.service';
import { SheetsService } from './sheets/sheets.service';
import { WebhooksService } from './webhooks.service';

class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {}
class CreateWebhookDto extends createZodDto(CreateWebhookSchema) {}
class UpdateWebhookDto extends createZodDto(UpdateWebhookSchema) {}
class DeliveriesQueryDto extends createZodDto(WebhookDeliveriesQuerySchema) {}
class PutSheetsDto extends createZodDto(PutSheetsSchema) {}
class SheetsBackfillDto extends createZodDto(SheetsBackfillSchema) {}
class SheetsConnectQueryDto extends createZodDto(SheetsConnectQuerySchema) {}
class SheetsCallbackQueryDto extends createZodDto(z.object({ code: z.string().max(2000).optional(), state: z.string().max(4000).optional(), error: z.string().max(200).optional(), scope: z.string().max(2000).optional() }).passthrough()) {}
class EmptyDto extends createZodDto(z.object({}).strict()) {}

const loc = (req: any): 'fr' | 'ar' | 'en' => (req.locale === 'ar' || req.locale === 'en' ? req.locale : 'fr');

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  @RequirePermission('integrations.manage')
  list() {
    return this.keys.overview();
  }

  /** The response carries the full key once: never cached by the idempotency layer. */
  @Post()
  @RequirePermission('integrations.manage')
  create(@Body() dto: CreateApiKeyDto) {
    return this.keys.create(dto);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto) {
    return this.keys.revoke(id);
  }

  /** 06 §2 `DELETE /api-keys/:id` = revoke (rows are kept for the audit trail). */
  @Delete(':id')
  @RequirePermission('integrations.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.keys.revoke(id);
  }
}

/** `/webhooks*` — merchant endpoints. The inbound provider webhooks live on literal sub-paths (`/webhooks/meta`, `/webhooks/chargily`, …). */
@ApiScopes({ read: 'webhooks:manage', write: 'webhooks:manage' })
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @RequirePermission('integrations.manage')
  list() {
    return this.webhooks.overview();
  }

  @Post()
  @RequirePermission('integrations.manage')
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooks.create(dto);
  }

  @Get('deliveries')
  @RequirePermission('integrations.manage')
  allDeliveries(@Query() q: DeliveriesQueryDto) {
    return this.webhooks.deliveries(q);
  }

  @Get('deliveries/:id')
  @RequirePermission('integrations.manage')
  delivery(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.delivery(id);
  }

  @Post('deliveries/:id/replay')
  @HttpCode(202)
  @Idempotent()
  @RequirePermission('integrations.manage')
  replay(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto) {
    return this.webhooks.replay(id);
  }

  @Get(':id')
  @RequirePermission('integrations.manage')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.get(id);
  }

  @Patch(':id')
  @RequirePermission('integrations.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('integrations.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.webhooks.remove(id);
  }

  @Get(':id/deliveries')
  @RequirePermission('integrations.manage')
  deliveries(@Param('id', ParseUUIDPipe) id: string, @Query() q: DeliveriesQueryDto) {
    return this.webhooks.deliveries(q, id);
  }

  @Post(':id/test')
  @HttpCode(202)
  @Idempotent()
  @RequirePermission('integrations.manage')
  test(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto) {
    return this.webhooks.test(id);
  }

  @Post(':id/enable')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  enable(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto) {
    return this.webhooks.enable(id);
  }

  @Post(':id/rotate-secret')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  rotate(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto) {
    return this.webhooks.rotateSecret(id);
  }
}

@Controller('integrations/google-sheets')
export class SheetsController {
  constructor(private readonly sheets: SheetsService) {}

  @Get()
  @RequirePermission('integrations.manage')
  get(@Req() req: any) {
    return this.sheets.view(loc(req));
  }

  @Get('status')
  @RequirePermission('integrations.manage')
  status(@Req() req: any) {
    return this.sheets.status(loc(req));
  }

  @Get('connect')
  @RequirePermission('integrations.manage')
  connect(@Query() q: SheetsConnectQueryDto) {
    return this.sheets.connectUrl(q.returnTo);
  }

  /** Google redirects the browser here (no bearer token): the signed `state` carries the workspace and the user. */
  @Public()
  @Get('callback')
  async callback(@Query() q: SheetsCallbackQueryDto, @Res() res: any) {
    res.redirect(302, await this.sheets.callback(q));
  }

  @Post('picker-token')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  picker(@Body() _dto: EmptyDto) {
    return this.sheets.pickerToken();
  }

  @Put()
  @RequirePermission('integrations.manage')
  put(@Body() dto: PutSheetsDto, @Req() req: any) {
    return this.sheets.choose(dto, loc(req));
  }

  @Post('backfill')
  @HttpCode(202)
  @Idempotent()
  @RequirePermission('integrations.manage')
  backfill(@Body() dto: SheetsBackfillDto) {
    return this.sheets.backfill(dto);
  }

  @Delete()
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  disconnect(@Req() req: any) {
    return this.sheets.disconnect(loc(req));
  }
}

