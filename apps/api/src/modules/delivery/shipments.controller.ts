// 06 "Delivery" + §8.5 — parcels (DLV-05…08, 04 §22). Every route `delivery.send` (every member) except the marks that
// move the order (`orders.write`; `delivered → returned` checked by the status machine). Courier calls only happen in
// the worker: send / sync / cancel at the courier / retry answer 202. API-key scope `delivery:read` on the reads.
// Literal sub-paths (`bulk`, `bulk/*`, `labels`) are declared before `:id`.
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import {
  BulkSendSchema,
  BulkShipmentIdsSchema,
  CancelShipmentSchema,
  ChangeCourierSchema,
  CreateShipmentSchema,
  LabelQuerySchema,
  LabelsJobSchema,
  MarkDeliveredSchema,
  MarkFailedSchema,
  MarkReturnedSchema,
  RetryDeliverySchema,
  ShipmentsQuerySchema,
  type CreateShipmentInput,
  type LabelQuery,
  type LabelsJobInput,
  type ShipmentsQuery,
} from '@djaber/shared';
import { ApiScope, Idempotent, RequirePermission } from '../../core/auth/decorators';
import { addWarning } from '../../core/http/envelope.interceptor';
import { bulkCtx } from '../../core/http/bulk';
import { DeliveryOverviewService } from './delivery-overview.service';
import { LabelService } from './label.service';
import { ShipmentService } from './shipment.service';
import { TrackingService } from './tracking.service';

class ShipmentsQueryDto extends createZodDto(ShipmentsQuerySchema) {}
class CreateShipmentDto extends createZodDto(CreateShipmentSchema) {}
class BulkSendDto extends createZodDto(BulkSendSchema) {}
class BulkShipmentIdsDto extends createZodDto(BulkShipmentIdsSchema) {}
class CancelShipmentDto extends createZodDto(CancelShipmentSchema) {}
class ChangeCourierDto extends createZodDto(ChangeCourierSchema) {}
class MarkFailedDto extends createZodDto(MarkFailedSchema) {}
class MarkDeliveredDto extends createZodDto(MarkDeliveredSchema) {}
class MarkReturnedDto extends createZodDto(MarkReturnedSchema) {}
class RetryDeliveryDto extends createZodDto(RetryDeliverySchema) {}
class LabelQueryDto extends createZodDto(LabelQuerySchema) {}
class LabelsJobDto extends createZodDto(LabelsJobSchema) {}

const Id = () => Param('id', ParseUUIDPipe);
const loc = (req: any): string => req.locale ?? 'fr';

/** `POST /orders/:id/shipments` (the order page "Envoyer au transporteur"; GET stays in OrdersController). */
@Controller('orders')
export class OrderShipmentsController {
  constructor(private readonly shipments: ShipmentService) {}

  @Post(':id/shipments')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  @Idempotent({ required: true })
  send(@Id() id: string, @Body() dto: CreateShipmentDto, @Req() req: any) {
    return this.shipments.send(id, dto as CreateShipmentInput, loc(req));
  }
}

@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly overview: DeliveryOverviewService,
    private readonly labels: LabelService,
    private readonly tracking: TrackingService,
  ) {}

  // --- collection -----------------------------------------------------------------------------------------------------------
  @Get()
  @RequirePermission('delivery.send')
  @ApiScope('delivery:read')
  list(@Query() q: ShipmentsQueryDto, @Req() req: any) {
    return this.overview.list(q as ShipmentsQuery, loc(req));
  }

  @Post('bulk')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  @Idempotent({ required: true })
  bulkSend(@Body() dto: BulkSendDto) {
    return this.shipments.requestBulk(dto);
  }

  @Post('bulk/sync')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  bulkSync(@Body() dto: BulkShipmentIdsDto) {
    return this.tracking.requestBulkSync(dto.ids);
  }

  /** "Livraison propre" for several orders (`ids` = order ids) → per-row results. */
  @Post('bulk/ship-manual')
  @HttpCode(200)
  @RequirePermission('orders.write')
  @Idempotent()
  bulkShipManual(@Body() dto: BulkShipmentIdsDto, @Req() req: any) {
    return this.shipments.bulkShipManual(dto.ids, bulkCtx(req));
  }

  /** Merged labels (one PDF) → 202 job; orders without a created parcel are skipped (`SHIPMENT_NOT_CREATED`). */
  @Post('labels')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  labelsJob(@Body() dto: LabelsJobDto) {
    return this.labels.requestMerge(dto as LabelsJobInput);
  }

  // --- one parcel -------------------------------------------------------------------------------------------------------------
  @Get(':id')
  @RequirePermission('delivery.send')
  @ApiScope('delivery:read')
  get(@Id() id: string, @Req() req: any) {
    return this.shipments.view(id, loc(req));
  }

  /** Courier label or Djaber fallback (`meta.warnings: LABEL_UNAVAILABLE` for couriers without labels). */
  @Get(':id/label')
  @RequirePermission('delivery.send')
  async label(@Id() id: string, @Query() q: LabelQueryDto, @Req() req: any) {
    const r = await this.labels.single(id, q as LabelQuery);
    if (r.warning) addWarning(req, r.warning);
    return r.file;
  }

  /** "Actualiser" — 429 TRACKING_SYNC_RATE_LIMITED {retryAfter} within 5 min; else a queued sync (WS `shipment.updated`). */
  @Post(':id/sync')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  sync(@Id() id: string, @Req() req: any) {
    return this.shipments.requestSync(id, loc(req));
  }

  /** Re-send a parcel whose creation failed (or is waiting for an automatic retry). */
  @Post(':id/retry')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  retry(@Id() id: string, @Req() req: any) {
    return this.shipments.retry(id, loc(req));
  }

  @Post(':id/retry-delivery')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  retryDelivery(@Id() id: string, @Body() dto: RetryDeliveryDto, @Req() req: any) {
    return this.shipments.retryDelivery(id, dto.note, loc(req));
  }

  @Post(':id/change-courier')
  @HttpCode(202)
  @RequirePermission('delivery.send')
  changeCourier(@Id() id: string, @Body() dto: ChangeCourierDto, @Req() req: any) {
    return this.shipments.changeCourier(id, dto.courierAccountId, loc(req));
  }

  /** 200 when cancelled at once (not created yet / manual), 202 when the courier is asked (worker). */
  @Post(':id/cancel')
  @RequirePermission('delivery.send')
  async cancel(@Id() id: string, @Body() dto: CancelShipmentDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const r = await this.shipments.cancel(id, dto, loc(req));
    res.status(r.queued ? 202 : 200);
    return r.view;
  }

  @Post(':id/mark-failed')
  @HttpCode(200)
  @RequirePermission('delivery.send')
  markFailed(@Id() id: string, @Body() dto: MarkFailedDto, @Req() req: any) {
    return this.shipments.markFailed(id, dto, loc(req));
  }

  @Post(':id/mark-delivered')
  @HttpCode(200)
  @RequirePermission('orders.write')
  @Idempotent()
  markDelivered(@Id() id: string, @Body() dto: MarkDeliveredDto, @Req() req: any) {
    return this.shipments.markDelivered(id, dto, loc(req));
  }

  @Post(':id/mark-returned')
  @HttpCode(200)
  @RequirePermission('orders.write')
  @Idempotent()
  markReturned(@Id() id: string, @Body() dto: MarkReturnedDto, @Req() req: any) {
    return this.shipments.markReturned(id, dto, loc(req));
  }
}
