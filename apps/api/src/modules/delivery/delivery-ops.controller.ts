// 06 "Delivery" (M6 half): `GET /delivery/overview` (the only overview endpoint), courier live rates, "copy courier
// rates into my grid"; the public parcel tracking page and the courier webhooks; the product label sheet (M2 carry-over).
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { CopyFeesFromCourierSchema, ProductLabelsSchema, PublicTrackingReportSchema, RatesQuerySchema, type ProductLabelsInput, type RatesQuery } from '@djaber/shared';
import { Public, RateLimit, RequirePermission } from '../../core/auth/decorators';
import { RawResponse } from '../../core/http/envelope.interceptor';
import { DeliveryOverviewService } from './delivery-overview.service';
import { LabelService } from './label.service';
import { PublicTrackingService } from './public-tracking.service';
import { RatesService } from './rates.service';
import { TrackingService } from './tracking.service';

class RatesQueryDto extends createZodDto(RatesQuerySchema) {}
class CopyFeesDto extends createZodDto(CopyFeesFromCourierSchema) {}
class PublicReportDto extends createZodDto(PublicTrackingReportSchema) {}
class ProductLabelsDto extends createZodDto(ProductLabelsSchema) {}

@Controller('delivery')
export class DeliveryOpsController {
  constructor(
    private readonly overview: DeliveryOverviewService,
    private readonly rates: RatesService,
  ) {}

  @Get('overview')
  @RequirePermission('delivery.send')
  get(@Req() req: any) {
    return this.overview.overview(req.locale ?? 'fr');
  }

  /** Cached 1 h (`CourierRateCache`); `refreshing: true` ⇒ the worker is fetching them (refetch shortly). */
  @Get('rates')
  @RequirePermission('delivery.send')
  getRates(@Query() q: RatesQueryDto) {
    return this.rates.get(q as RatesQuery);
  }

  @Post('fees/copy-from-courier')
  @HttpCode(200)
  @RequirePermission('delivery.manage')
  copy(@Body() dto: CopyFeesDto) {
    return this.rates.copyToGrid(dto);
  }
}

/** Courier webhooks (06 §3): per-account secret checked on the raw body, events stored + queued, 200 at once. */
@Controller('webhooks/couriers')
export class CourierWebhookController {
  constructor(private readonly tracking: TrackingService) {}

  @Public()
  @Post(':courierAccountId')
  @HttpCode(200)
  async receive(@Param('courierAccountId') id: string, @Req() req: any) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new RawResponse({ received: 0 });
    const n = await this.tracking.ingestWebhook(id, req.headers, req.rawBody);
    return new RawResponse({ received: n });
  }
}

/** `/s/[code]` — public parcel tracking (no auth, mapped timeline only) + "Signaler ce vendeur". */
@Controller('track')
export class PublicTrackingController {
  constructor(private readonly tracking: PublicTrackingService) {}

  @Public()
  @Get(':publicToken')
  @RateLimit({ name: 'public-tracking', max: 60, windowSeconds: 60, by: 'ip' })
  get(@Param('publicToken') token: string, @Req() req: any) {
    return this.tracking.view(token, req.locale ?? 'fr');
  }

  @Public()
  @Post(':publicToken/report')
  @HttpCode(201)
  report(@Param('publicToken') token: string, @Body() dto: PublicReportDto, @Req() req: any) {
    return this.tracking.report(token, dto, String(req.ip ?? 'unknown'));
  }
}

/** M2 carry-over: `POST /products/bulk/labels { ids[], copies?, withPrice? }` → 202 (A4 label sheet). */
@Controller('products')
export class ProductLabelsController {
  constructor(private readonly labels: LabelService) {}

  @Post('bulk/labels')
  @HttpCode(202)
  @RequirePermission('catalog.read')
  request(@Body() dto: ProductLabelsDto) {
    return this.labels.requestProductLabels(dto as ProductLabelsInput);
  }
}
