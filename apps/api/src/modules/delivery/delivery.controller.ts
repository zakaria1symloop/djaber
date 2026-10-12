// 06-api "Delivery" (M5 half: fee grid, quote, stop-desks). Read + quote `delivery.send` (every member), grid edits
// `delivery.manage` (Admin+) — 01-nest-module-map §3.2. Couriers, shipments and tracking arrive with M6.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { FeeQuoteQuerySchema, SeedFeesSchema, StopdesksQuerySchema, UpdateFeeRuleSchema } from '@djaber/shared';
import { RequirePermission } from '../../core/auth/decorators';
import { RawResponse } from '../../core/http/envelope.interceptor';
import { FeeService } from './fee.service';
import { GeoService } from './geo.service';

class UpdateFeeRuleDto extends createZodDto(UpdateFeeRuleSchema) {}
class SeedFeesDto extends createZodDto(SeedFeesSchema) {}
class FeeQuoteQueryDto extends createZodDto(FeeQuoteQuerySchema) {}
class StopdesksQueryDto extends createZodDto(StopdesksQuerySchema) {}

const wilaya = () => Param('wilayaId', ParseIntPipe);

@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly fees: FeeService,
    private readonly geo: GeoService,
  ) {}

  /** `{ data: FeeRuleView[58], meta: { freeDeliveryThreshold, custom, inactive, missing, warnings } }`. */
  @Get('fees')
  @RequirePermission('delivery.send')
  async grid() {
    const g = await this.fees.grid();
    return new RawResponse({ data: g.data, meta: { ...g.meta, warnings: [] } });
  }

  @Get('fees/quote')
  @RequirePermission('delivery.send')
  quote(@Query() q: FeeQuoteQueryDto) {
    return this.fees.quote({ wilayaId: q.wilayaId, isStopdesk: q.stopdesk === true, subtotal: q.subtotal ?? null });
  }

  @Post('fees/seed')
  @HttpCode(200)
  @RequirePermission('delivery.manage')
  async seed(@Body() dto: SeedFeesDto) {
    const r = await this.fees.seed(dto.overwrite ?? false);
    return new RawResponse({ data: r.data, meta: { ...r.meta, written: r.written, warnings: [] } });
  }

  @Put('fees/:wilayaId')
  @RequirePermission('delivery.manage')
  update(@wilaya() wilayaId: number, @Body() dto: UpdateFeeRuleDto) {
    return this.fees.update(wilayaId, dto);
  }

  @Delete('fees/:wilayaId')
  @RequirePermission('delivery.manage')
  reset(@wilaya() wilayaId: number) {
    return this.fees.reset(wilayaId);
  }

  @Get('stopdesks')
  @RequirePermission('delivery.send')
  stopdesks(@Query() q: StopdesksQueryDto) {
    return this.geo.stopdesks(q);
  }
}
