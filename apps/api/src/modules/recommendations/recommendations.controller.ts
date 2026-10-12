// 06 "Recommendations", §8.6 `/stock-recommendations*` (FIG GDS-10, DLG GDS II "Règle de recommandation").
// Read `catalog.read`; generate / rules / apply / dismiss / snooze / mute `catalog.write` (01 §3.2).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApplyStockRecoSchema, CreateRecommendationSchema, MuteStockRecoSchema, RecommendationsQuerySchema, SnoozeStockRecoSchema, StockRecoHistoryQuerySchema, StockRecosQuerySchema, UpdateRecommendationSchema } from '@djaber/shared';
import { Audited, RequirePermission } from '../../core/auth/decorators';
import { CrossSellService } from './cross-sell.service';
import { StockRecoService } from './stock-reco.service';

const optionalBody = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => v ?? {}, schema) as unknown as T;
class StockRecosQueryDto extends createZodDto(StockRecosQuerySchema) {}
class StockRecoHistoryQueryDto extends createZodDto(StockRecoHistoryQuerySchema) {}
class ApplyStockRecoDto extends createZodDto(optionalBody(ApplyStockRecoSchema)) {}
class SnoozeStockRecoDto extends createZodDto(optionalBody(SnoozeStockRecoSchema)) {}
class MuteStockRecoDto extends createZodDto(MuteStockRecoSchema) {}
class RecommendationsQueryDto extends createZodDto(RecommendationsQuerySchema) {}
class CreateRecommendationDto extends createZodDto(CreateRecommendationSchema) {}
class UpdateRecommendationDto extends createZodDto(UpdateRecommendationSchema) {}
const Id = () => Param('id', ParseUUIDPipe);

@Controller('stock-recommendations')
export class StockRecommendationsController {
  constructor(private readonly recos: StockRecoService) {}

  @Get()
  @RequirePermission('catalog.read')
  list(@Query() q: StockRecosQueryDto) {
    return this.recos.list(q);
  }

  @Get('stats')
  @RequirePermission('catalog.read')
  stats() {
    return this.recos.stats();
  }

  @Get('history')
  @RequirePermission('catalog.read')
  history(@Query() q: StockRecoHistoryQueryDto) {
    return this.recos.history(q);
  }

  @Post('generate')
  @HttpCode(202)
  @RequirePermission('catalog.write')
  generate() {
    return this.recos.requestGenerate();
  }

  @Post('mute')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  async mute(@Body() dto: MuteStockRecoDto) {
    await this.recos.mute(dto);
  }

  @Delete('mute')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  async unmute(@Query() q: MuteStockRecoDto) {
    await this.recos.unmute(q);
  }

  @Post(':id/apply')
  @HttpCode(200)
  @RequirePermission('catalog.write')
  apply(@Id() id: string, @Body() dto: ApplyStockRecoDto) {
    return this.recos.apply(id, dto);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  @RequirePermission('catalog.write')
  dismiss(@Id() id: string) {
    return this.recos.dismiss(id);
  }

  @Post(':id/snooze')
  @HttpCode(200)
  @RequirePermission('catalog.write')
  snooze(@Id() id: string, @Body() dto: SnoozeStockRecoDto) {
    return this.recos.snooze(id, dto.days);
  }
}

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly xsell: CrossSellService) {}

  @Get()
  @RequirePermission('catalog.read')
  list(@Query() q: RecommendationsQueryDto) {
    return this.xsell.list(q);
  }

  @Get('stats')
  @RequirePermission('catalog.read')
  stats() {
    return this.xsell.stats();
  }

  @Post('generate')
  @HttpCode(202)
  @RequirePermission('catalog.write')
  generate() {
    return this.xsell.requestGenerate();
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Recommendation', action: 'recommendation.create', idFrom: 'result.id' })
  create(@Body() dto: CreateRecommendationDto) {
    return this.xsell.create(dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Recommendation', action: 'recommendation.update' })
  update(@Id() id: string, @Body() dto: UpdateRecommendationDto) {
    return this.xsell.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Recommendation', action: 'recommendation.delete' })
  async remove(@Id() id: string) {
    await this.xsell.remove(id);
  }
}
